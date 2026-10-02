import type { FastifyReply } from "fastify";
import { UserRole } from "@viewra/types";
import type { AuthUser } from "../plugins/auth.js";
import { PropertyModel } from "../models/Property.js";
import type { PropertyDocument } from "../models/Property.js";
import { isMongoId } from "./validation.js";

/**
 * Resolve a property by Mongo id, organization-scoped slug, or publicId.
 */
export async function findOrgPropertyRef(
  user: AuthUser,
  ref: string,
  reply: FastifyReply,
): Promise<PropertyDocument | null> {
  const trimmed = ref.trim();
  if (!trimmed) {
    await reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Property not found",
    });
    return null;
  }

  const orgFilter: Record<string, unknown> = {};
  if (user.role !== UserRole.SUPER_ADMIN) {
    orgFilter.organizationId = user.organizationId;
  }

  let property: PropertyDocument | null = null;

  if (isMongoId(trimmed)) {
    property = await PropertyModel.findOne({ ...orgFilter, _id: trimmed });
  } else {
    const slug = trimmed.toLowerCase();
    property = await PropertyModel.findOne({ ...orgFilter, slug });
    if (!property) {
      property = await PropertyModel.findOne({ ...orgFilter, publicId: trimmed });
    }
  }

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
