import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const analyticsEventSchema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "TOUR_VIEW",
        "NODE_VIEW",
        "SESSION_END",
        "QR_SCAN",
        "MAP_OPEN",
        "MAP_JUMP",
      ],
      required: true,
    },
    nodeId: { type: Schema.Types.ObjectId, ref: "Node" },
    sessionId: { type: String, index: true },
    visitorId: { type: String, index: true },
    durationMs: { type: Number },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AnalyticsEventDocument = InferSchemaType<
  typeof analyticsEventSchema
> & {
  _id: Types.ObjectId;
};

export const AnalyticsEventModel = model("AnalyticsEvent", analyticsEventSchema);
