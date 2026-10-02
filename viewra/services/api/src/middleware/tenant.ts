import type { FastifyReply } from "fastify";
import { Types } from "mongoose";
import { UserRole } from "@viewra/types";
import type { AuthUser } from "../plugins/auth.js";
import { PropertyModel } from "../models/Property.js";
import { RoomModel } from "../models/Room.js";
import { NodeModel } from "../models/Node.js";
import { PhotoModel } from "../models/Photo.js";
import { ConnectionModel } from "../models/Connection.js";
import { isMongoId } from "../utils/validation.js";

export async function findOrgProperty(
  user: AuthUser,
  propertyId: string,
  reply: FastifyReply,
) {
  if (!isMongoId(propertyId)) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Property not found",
    });
    return null;
  }

  const filter: Record<string, unknown> = { _id: propertyId };
  if (user.role !== UserRole.SUPER_ADMIN) {
    filter.organizationId = user.organizationId;
  }

  const property = await PropertyModel.findOne(filter);
  if (!property) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Property not found",
    });
    return null;
  }
  return property;
}

export async function findOrgRoom(
  user: AuthUser,
  roomId: string,
  reply: FastifyReply,
) {
  if (!isMongoId(roomId)) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Room not found",
    });
    return null;
  }
  const room = await RoomModel.findById(roomId);
  if (!room) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Room not found",
    });
    return null;
  }
  const property = await findOrgProperty(
    user,
    room.propertyId.toString(),
    reply,
  );
  if (!property) return null;
  return { room, property };
}

export async function findOrgNode(
  user: AuthUser,
  nodeId: string,
  reply: FastifyReply,
) {
  if (!isMongoId(nodeId)) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Node not found",
    });
    return null;
  }
  const node = await NodeModel.findById(nodeId);
  if (!node) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Node not found",
    });
    return null;
  }
  const property = await findOrgProperty(
    user,
    node.propertyId.toString(),
    reply,
  );
  if (!property) return null;
  return { node, property };
}

export async function findOrgPhoto(
  user: AuthUser,
  photoId: string,
  reply: FastifyReply,
) {
  if (!isMongoId(photoId)) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Photo not found",
    });
    return null;
  }
  const photo = await PhotoModel.findById(photoId);
  if (!photo) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Photo not found",
    });
    return null;
  }
  const property = await findOrgProperty(
    user,
    photo.propertyId.toString(),
    reply,
  );
  if (!property) return null;
  return { photo, property };
}

export async function findOrgConnection(
  user: AuthUser,
  connectionId: string,
  reply: FastifyReply,
) {
  if (!isMongoId(connectionId)) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Connection not found",
    });
    return null;
  }
  const connection = await ConnectionModel.findById(connectionId);
  if (!connection) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Connection not found",
    });
    return null;
  }
  const property = await findOrgProperty(
    user,
    connection.propertyId.toString(),
    reply,
  );
  if (!property) return null;
  return { connection, property };
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
