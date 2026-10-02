import type { FastifyInstance } from "fastify";
import { createConnectionSchema, ConnectionDirection } from "@viewra/types";
import { ConnectionModel } from "../models/Connection.js";
import { NodeModel } from "../models/Node.js";
import { findOrgProperty, findOrgConnection } from "../middleware/tenant.js";
import { serializeDoc, serializeDocs } from "../utils/serialize.js";
import { validateBody } from "../utils/validation.js";

export async function connectionRoutes(app: FastifyInstance) {
  app.get(
    "/api/properties/:id/connections",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const connections = await ConnectionModel.find({
        propertyId: property._id,
      });
      return { items: serializeDocs(connections) };
    },
  );

  app.post(
    "/api/connections",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = await validateBody(createConnectionSchema, request, reply);
      if (!body) return;

      const property = await findOrgProperty(
        request.authUser,
        body.propertyId,
        reply,
      );
      if (!property) return;

      const [fromNode, toNode] = await Promise.all([
        NodeModel.findOne({ _id: body.fromNodeId, propertyId: property._id }),
        NodeModel.findOne({ _id: body.toNodeId, propertyId: property._id }),
      ]);

      if (!fromNode || !toNode) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Both nodes must exist on the property",
        });
      }

      try {
        const forward = await ConnectionModel.create({
          propertyId: property._id,
          fromNodeId: fromNode._id,
          toNodeId: toNode._id,
          direction: body.direction,
          label: body.label,
        });

        let reverse = null;
        if (body.bidirectional) {
          const reverseDirection =
            body.direction === ConnectionDirection.FORWARD
              ? ConnectionDirection.BACK
              : body.direction === ConnectionDirection.BACK
                ? ConnectionDirection.FORWARD
                : body.direction === ConnectionDirection.LEFT
                  ? ConnectionDirection.RIGHT
                  : body.direction === ConnectionDirection.RIGHT
                    ? ConnectionDirection.LEFT
                    : body.direction === ConnectionDirection.UP
                      ? ConnectionDirection.DOWN
                      : body.direction === ConnectionDirection.DOWN
                        ? ConnectionDirection.UP
                        : ConnectionDirection.CUSTOM;

          reverse = await ConnectionModel.create({
            propertyId: property._id,
            fromNodeId: toNode._id,
            toNodeId: fromNode._id,
            direction: reverseDirection,
            label: body.label,
          });
        }

        return reply.status(201).send({
          connection: serializeDoc(forward),
          reverse: reverse ? serializeDoc(reverse) : null,
        });
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        if (code === 11000) {
          return reply.status(409).send({
            statusCode: 409,
            error: "Conflict",
            message: "Connection already exists",
          });
        }
        throw err;
      }
    },
  );

  app.delete(
    "/api/connections/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await findOrgConnection(request.authUser, id, reply);
      if (!result) return;

      await result.connection.deleteOne();
      return reply.status(204).send();
    },
  );
}
