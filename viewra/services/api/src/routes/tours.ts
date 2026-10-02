import type { FastifyInstance } from "fastify";
import { analyticsTrackSchema, PropertyStatus } from "@viewra/types";
import { PropertyModel } from "../models/Property.js";
import { NodeModel } from "../models/Node.js";
import { buildPublicTour } from "../services/publishing.js";
import { trackAnalyticsEvent } from "../services/analytics.js";
import { loadPropertyGraph } from "../services/graph.js";
import { validateBody, isMongoId } from "../utils/validation.js";

export async function tourRoutes(app: FastifyInstance) {
  app.get("/api/tours/:publicId", async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const result = await buildPublicTour(publicId, app.storage);
    return reply.status(result.status).send(result.body);
  });

  app.get("/api/tours/:publicId/nodes/:nodeId", async (request, reply) => {
    const { publicId, nodeId } = request.params as {
      publicId: string;
      nodeId: string;
    };

    if (!isMongoId(nodeId)) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Node not found",
      });
    }

    const property = await PropertyModel.findOne({ publicId });
    if (!property || property.status !== PropertyStatus.PUBLISHED) {
      if (property?.status === PropertyStatus.ARCHIVED) {
        return reply.status(410).send({
          statusCode: 410,
          error: "Gone",
          message: "This tour is no longer available",
        });
      }
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Tour not found",
      });
    }

    const graph = await loadPropertyGraph(property._id.toString());
    if (!graph) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Tour not found",
      });
    }

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Node not found",
      });
    }

    const room = graph.rooms.find((r) => r.id === node.roomId);
    const photos = await Promise.all(
      graph.photos
        .filter((p) => p.nodeId === node.id)
        .map(async (p) => ({
          id: p.id,
          direction: p.direction,
          url: await app.storage.resolveReadUrl(
            p.processedKey ?? p.originalKey,
          ),
          thumbnailUrl: await app.storage.resolveReadUrl(p.thumbnailKey),
          width: p.width,
          height: p.height,
        })),
    );

    const connections = graph.connections
      .filter((c) => c.fromNodeId === node.id)
      .map((c) => ({
        id: c.id,
        toNodeId: c.toNodeId,
        direction: c.direction,
        label: c.label,
      }));

    return {
      node: {
        id: node.id,
        label: node.label,
        sequence: node.sequence,
        roomId: node.roomId,
        roomName: room?.name,
        approximatePosition: node.approximatePosition,
        photos,
      },
      connections,
    };
  });

  app.post("/api/tours/:publicId/analytics", async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const body = await validateBody(analyticsTrackSchema, request, reply);
    if (!body) return;

    const property = await PropertyModel.findOne({ publicId });
    if (!property || property.status !== PropertyStatus.PUBLISHED) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Tour not found",
      });
    }

    if (body.nodeId) {
      if (!isMongoId(body.nodeId)) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid nodeId",
        });
      }
      const node = await NodeModel.findOne({
        _id: body.nodeId,
        propertyId: property._id,
      });
      if (!node) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Node not found on tour",
        });
      }
    }

    await trackAnalyticsEvent({
      propertyId: property._id.toString(),
      organizationId: property.organizationId.toString(),
      type: body.type,
      nodeId: body.nodeId,
      sessionId: body.sessionId,
      visitorId: body.visitorId,
      durationMs: body.durationMs,
      metadata: body.metadata,
    });

    return reply.status(204).send();
  });
}
