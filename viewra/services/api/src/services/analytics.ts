import { AnalyticsEventModel } from "../models/AnalyticsEvent.js";
import { PropertyModel } from "../models/Property.js";
import { serializeDocs } from "../utils/serialize.js";

export async function trackAnalyticsEvent(input: {
  propertyId: string;
  organizationId: string;
  type: string;
  nodeId?: string;
  sessionId?: string;
  visitorId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const event = await AnalyticsEventModel.create(input);
  return event;
}

export async function getPropertyAnalytics(
  propertyId: string,
  organizationId: string,
) {
  const property = await PropertyModel.findOne({
    _id: propertyId,
    organizationId,
  });
  if (!property) return null;

  const events = await AnalyticsEventModel.find({ propertyId })
    .sort({ createdAt: -1 })
    .limit(500);

  const totals = await AnalyticsEventModel.aggregate([
    { $match: { propertyId: property._id } },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]);

  const uniqueVisitors = await AnalyticsEventModel.distinct("visitorId", {
    propertyId: property._id,
    visitorId: { $ne: null },
  });

  const uniqueSessions = await AnalyticsEventModel.distinct("sessionId", {
    propertyId: property._id,
    sessionId: { $ne: null },
  });

  return {
    propertyId,
    totals: Object.fromEntries(totals.map((t) => [t._id, t.count])),
    uniqueVisitors: uniqueVisitors.filter(Boolean).length,
    uniqueSessions: uniqueSessions.filter(Boolean).length,
    recent: serializeDocs(events),
  };
}
