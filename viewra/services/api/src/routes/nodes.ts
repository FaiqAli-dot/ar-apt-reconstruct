import type { FastifyInstance } from "fastify";
import {
  createNodeSchema,
  updateNodeSchema,
  ConnectionDirection,
} from "@viewra/types";
import { NodeModel } from "../models/Node.js";
import { RoomModel } from "../models/Room.js";
import { PhotoModel } from "../models/Photo.js";
import { ConnectionModel } from "../models/Connection.js";
import { ProcessingJobModel } from "../models/ProcessingJob.js";
import { findOrgProperty, findOrgNode } from "../middleware/tenant.js";
import { serializeDoc, serializeDocs } from "../utils/serialize.js";
import { validateBody } from "../utils/validation.js";

export async function nodeRoutes(app: FastifyInstance) {
  app.get(
    "/api/properties/:id/nodes",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const nodes = await NodeModel.find({ propertyId: property._id }).sort({
        sequence: 1,
      });
      return { items: serializeDocs(nodes) };
    },
  );

  app.post(
    "/api/properties/:id/nodes",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = await validateBody(createNodeSchema, request, reply);
      if (!body) return;

      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const room = await RoomModel.findOne({
        _id: body.roomId,
        propertyId: property._id,
      });
      if (!room) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Room not found on this property",
        });
      }

      let sequence = body.sequence;
      if (sequence === undefined) {
        const last = await NodeModel.findOne({ propertyId: property._id })
          .sort({ sequence: -1 })
          .select("sequence");
        sequence = last ? last.sequence + 1 : 0;
      }

      const node = await NodeModel.create({
        propertyId: property._id,
        roomId: room._id,
        label: body.label ?? `Node ${sequence + 1}`,
        sequence,
        approximatePosition: body.approximatePosition ?? { x: 0, y: 0 },
        captureMetadata: body.captureMetadata
          ? {
              ...body.captureMetadata,
              operatorId: request.authUser.id,
              capturedAt: body.captureMetadata.capturedAt
                ? new Date(body.captureMetadata.capturedAt)
                : undefined,
            }
          : { operatorId: request.authUser.id },
        status: "DRAFT",
      });

      let connection = null;
      if (body.connectFromNodeId) {
        const fromNode = await NodeModel.findOne({
          _id: body.connectFromNodeId,
          propertyId: property._id,
        });
        if (!fromNode) {
          await node.deleteOne();
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: "connectFromNodeId not found on this property",
          });
        }

        connection = await ConnectionModel.create({
          propertyId: property._id,
          fromNodeId: fromNode._id,
          toNodeId: node._id,
          direction: body.connectionDirection ?? ConnectionDirection.FORWARD,
          label: body.connectionLabel,
        });
      }

      return reply.status(201).send({
        ...serializeDoc(node),
        connection: connection ? serializeDoc(connection) : null,
      });
    },
  );

  app.patch(
    "/api/nodes/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = await validateBody(updateNodeSchema, request, reply);
      if (!body) return;

      const result = await findOrgNode(request.authUser, id, reply);
      if (!result) return;

      if (body.roomId !== undefined) {
        const room = await RoomModel.findOne({
          _id: body.roomId,
          propertyId: result.property._id,
        });
        if (!room) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: "Room not found on this property",
          });
        }
        result.node.roomId = room._id;
      }
      if (body.label !== undefined) result.node.label = body.label;
      if (body.sequence !== undefined) result.node.sequence = body.sequence;
      if (body.approximatePosition !== undefined) {
        result.node.approximatePosition = body.approximatePosition;
      }
      if (body.status !== undefined) result.node.status = body.status;
      if (body.skippedDirections !== undefined) {
        result.node.skippedDirections = [...new Set(body.skippedDirections)];
      }
      if (body.captureMetadata !== undefined) {
        result.node.captureMetadata = {
          ...result.node.captureMetadata,
          ...body.captureMetadata,
          capturedAt: body.captureMetadata.capturedAt
            ? new Date(body.captureMetadata.capturedAt)
            : result.node.captureMetadata?.capturedAt,
        };
      }

      await result.node.save();
      return serializeDoc(result.node);
    },
  );

  app.delete(
    "/api/nodes/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await findOrgNode(request.authUser, id, reply);
      if (!result) return;

      const photos = await PhotoModel.find({ nodeId: result.node._id });
      const photoIds = photos.map((p) => p._id);

      await Promise.all([
        PhotoModel.deleteMany({ nodeId: result.node._id }),
        ConnectionModel.deleteMany({
          $or: [
            { fromNodeId: result.node._id },
            { toNodeId: result.node._id },
          ],
        }),
        photoIds.length
          ? ProcessingJobModel.deleteMany({ photoId: { $in: photoIds } })
          : Promise.resolve(),
        result.node.deleteOne(),
      ]);

      return reply.status(204).send();
    },
  );
}
