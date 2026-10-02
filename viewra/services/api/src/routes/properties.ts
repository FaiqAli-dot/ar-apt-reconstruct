import type { FastifyInstance } from "fastify";
import {
  createPropertySchema,
  updatePropertySchema,
  paginationSchema,
  UserRole,
} from "@viewra/types";
import { generatePublicId, slugify } from "@viewra/shared";
import { PropertyModel } from "../models/Property.js";
import { RoomModel } from "../models/Room.js";
import { NodeModel } from "../models/Node.js";
import { PhotoModel } from "../models/Photo.js";
import { ConnectionModel } from "../models/Connection.js";
import { ProcessingJobModel } from "../models/ProcessingJob.js";
import { AnalyticsEventModel } from "../models/AnalyticsEvent.js";
import { findOrgProperty } from "../middleware/tenant.js";
import { orgScopeFilter } from "../middleware/authorize.js";
import { serializeDoc, serializeDocs } from "../utils/serialize.js";
import { validateBody, validateQuery } from "../utils/validation.js";

export async function propertyRoutes(app: FastifyInstance) {
  app.get(
    "/api/properties",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = await validateQuery(paginationSchema, request, reply);
      if (!query) return;

      const filter = orgScopeFilter(request.authUser);
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        PropertyModel.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
        PropertyModel.countDocuments(filter),
      ]);

      return {
        items: serializeDocs(items),
        page,
        limit,
        total,
      };
    },
  );

  app.post(
    "/api/properties",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = await validateBody(createPropertySchema, request, reply);
      if (!body) return;

      if (request.authUser.role === UserRole.SUPER_ADMIN) {
        // SUPER_ADMIN can create in their own org context
      }

      const slug = body.slug ?? slugify(body.title);
      const organizationId = request.authUser.organizationId;

      const existing = await PropertyModel.findOne({ organizationId, slug });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Property slug already exists in organization",
        });
      }

      const property = await PropertyModel.create({
        organizationId,
        title: body.title,
        slug,
        publicId: generatePublicId(),
        address: body.address,
        description: body.description,
        status: "DRAFT",
      });

      return reply.status(201).send(serializeDoc(property));
    },
  );

  app.get(
    "/api/properties/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;
      return serializeDoc(property);
    },
  );

  app.patch(
    "/api/properties/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = await validateBody(updatePropertySchema, request, reply);
      if (!body) return;

      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      // publicId must never change
      const { status, coverPhotoId, title, slug, address, description } = body;
      if (title !== undefined) property.title = title;
      if (slug !== undefined) property.slug = slug;
      if (address !== undefined) property.address = address;
      if (description !== undefined) property.description = description;
      if (status !== undefined) property.status = status;
      if (coverPhotoId !== undefined) {
        property.coverPhotoId = coverPhotoId as unknown as typeof property.coverPhotoId;
      }

      await property.save();
      return serializeDoc(property);
    },
  );

  app.delete(
    "/api/properties/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      await Promise.all([
        RoomModel.deleteMany({ propertyId: property._id }),
        NodeModel.deleteMany({ propertyId: property._id }),
        PhotoModel.deleteMany({ propertyId: property._id }),
        ConnectionModel.deleteMany({ propertyId: property._id }),
        ProcessingJobModel.deleteMany({ propertyId: property._id }),
        AnalyticsEventModel.deleteMany({ propertyId: property._id }),
        property.deleteOne(),
      ]);

      return reply.status(204).send();
    },
  );
}
