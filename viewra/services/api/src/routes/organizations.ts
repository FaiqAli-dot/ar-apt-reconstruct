import type { FastifyInstance } from "fastify";
import { createOrganizationSchema, UserRole } from "@viewra/types";
import { OrganizationModel } from "../models/Organization.js";
import { requireRoles } from "../middleware/authorize.js";
import { serializeDoc, serializeDocs } from "../utils/serialize.js";
import { validateBody, isMongoId } from "../utils/validation.js";

export async function organizationRoutes(app: FastifyInstance) {
  app.post(
    "/api/organizations",
    { preHandler: [requireRoles(UserRole.SUPER_ADMIN)] },
    async (request, reply) => {
      const body = await validateBody(createOrganizationSchema, request, reply);
      if (!body) return;

      const existing = await OrganizationModel.findOne({ slug: body.slug });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Organization slug already exists",
        });
      }

      const org = await OrganizationModel.create({
        name: body.name,
        slug: body.slug,
        settings: {},
      });
      return reply.status(201).send(serializeDoc(org));
    },
  );

  app.get(
    "/api/organizations",
    { preHandler: [app.authenticate] },
    async (request) => {
      if (request.authUser.role === UserRole.SUPER_ADMIN) {
        const orgs = await OrganizationModel.find().sort({ createdAt: -1 });
        return { items: serializeDocs(orgs) };
      }
      const org = await OrganizationModel.findById(request.authUser.organizationId);
      return { items: org ? [serializeDoc(org)] : [] };
    },
  );

  app.get(
    "/api/organizations/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isMongoId(id)) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Organization not found",
        });
      }

      if (
        request.authUser.role !== UserRole.SUPER_ADMIN &&
        request.authUser.organizationId !== id
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Organization not found",
        });
      }

      const org = await OrganizationModel.findById(id);
      if (!org) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Organization not found",
        });
      }
      return serializeDoc(org);
    },
  );
}
