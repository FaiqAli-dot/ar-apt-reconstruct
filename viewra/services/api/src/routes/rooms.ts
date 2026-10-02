import type { FastifyInstance } from "fastify";
import { createRoomSchema, updateRoomSchema } from "@viewra/types";
import { RoomModel } from "../models/Room.js";
import { NodeModel } from "../models/Node.js";
import { findOrgProperty, findOrgRoom } from "../middleware/tenant.js";
import { serializeDoc, serializeDocs } from "../utils/serialize.js";
import { validateBody } from "../utils/validation.js";

export async function roomRoutes(app: FastifyInstance) {
  app.get(
    "/api/properties/:id/rooms",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const rooms = await RoomModel.find({ propertyId: property._id }).sort({
        order: 1,
      });
      return { items: serializeDocs(rooms) };
    },
  );

  app.post(
    "/api/properties/:id/rooms",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = await validateBody(createRoomSchema, request, reply);
      if (!body) return;

      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      let order = body.order;
      if (order === undefined) {
        const last = await RoomModel.findOne({ propertyId: property._id })
          .sort({ order: -1 })
          .select("order");
        order = last ? last.order + 1 : 0;
      }

      const room = await RoomModel.create({
        propertyId: property._id,
        name: body.name,
        type: body.type,
        order,
      });

      return reply.status(201).send(serializeDoc(room));
    },
  );

  app.patch(
    "/api/rooms/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = await validateBody(updateRoomSchema, request, reply);
      if (!body) return;

      const result = await findOrgRoom(request.authUser, id, reply);
      if (!result) return;

      if (body.name !== undefined) result.room.name = body.name;
      if (body.type !== undefined) result.room.type = body.type;
      if (body.order !== undefined) result.room.order = body.order;
      await result.room.save();
      return serializeDoc(result.room);
    },
  );

  app.delete(
    "/api/rooms/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await findOrgRoom(request.authUser, id, reply);
      if (!result) return;

      const nodeCount = await NodeModel.countDocuments({
        roomId: result.room._id,
      });
      if (nodeCount > 0) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Cannot delete room with nodes; move or delete nodes first",
        });
      }

      await result.room.deleteOne();
      return reply.status(204).send();
    },
  );
}
