import type { FastifyInstance } from "fastify";
import { UserRole } from "@viewra/types";
import { findOrgProperty } from "../middleware/tenant.js";
import { getPropertyAnalytics } from "../services/analytics.js";
import { requireRoles } from "../middleware/authorize.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.get(
    "/api/properties/:id/analytics",
    {
      preHandler: [
        requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await findOrgProperty(request.authUser, id, reply);
      if (!property) return;

      const analytics = await getPropertyAnalytics(
        property._id.toString(),
        property.organizationId.toString(),
      );
      return analytics;
    },
  );
}
