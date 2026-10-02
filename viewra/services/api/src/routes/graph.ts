import type { FastifyInstance } from "fastify";
import { UserRole } from "@viewra/types";
import { findOrgProperty } from "../middleware/tenant.js";
import {
  buildAdminGraphResponse,
  getPublishValidation,
} from "../services/graph.js";
import {
  archiveProperty,
  publishProperty,
} from "../services/publishing.js";
import { requireRoles } from "../middleware/authorize.js";

export async function graphRoutes(app: FastifyInstance) {
  app.get(
    "/api/properties/:id/graph",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const graph = await buildAdminGraphResponse(property._id.toString());
      return graph;
    },
  );

  app.get(
    "/api/properties/:id/publish-validation",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const report = await getPublishValidation(property._id.toString());
      return report;
    },
  );

  app.post(
    "/api/properties/:id/publish",
    {
      preHandler: [
        requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const result = await publishProperty(property._id.toString());
      if (!result.ok) {
        return reply.status(result.status).send({
          statusCode: result.status,
          error: result.status === 404 ? "Not Found" : "Bad Request",
          message:
            result.status === 404
              ? "Property not found"
              : "Property is not ready to publish",
          report: result.report,
        });
      }

      return {
        property: result.property,
        report: result.report,
      };
    },
  );

  app.post(
    "/api/properties/:id/archive",
    {
      preHandler: [
        requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const archived = await archiveProperty(property._id.toString());
      return archived;
    },
  );

  app.get(
    "/api/properties/:id/qr",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const tourUrl = `${app.appConfig.publicViewerUrl.replace(/\/$/, "")}/tour/${property.publicId}`;
      return {
        publicId: property.publicId,
        url: tourUrl,
        qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tourUrl)}`,
      };
    },
  );
}
