import type { FastifyInstance } from "fastify";
import { PropertyStatus } from "@viewra/types";
import { PropertyModel } from "../models/Property.js";
import { NodeModel } from "../models/Node.js";
import { PhotoModel } from "../models/Photo.js";
import { AnalyticsEventModel } from "../models/AnalyticsEvent.js";
import { UserModel } from "../models/User.js";
import { orgScopeFilter } from "../middleware/authorize.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/dashboard/stats",
    { preHandler: [app.authenticate] },
    async (request) => {
      const orgFilter = orgScopeFilter(request.authUser);
      const propertyIds = (
        await PropertyModel.find(orgFilter).select("_id")
      ).map((p) => p._id);

      const [
        propertiesTotal,
        published,
        draft,
        processing,
        nodes,
        photos,
        users,
        tourViews,
      ] = await Promise.all([
        PropertyModel.countDocuments(orgFilter),
        PropertyModel.countDocuments({
          ...orgFilter,
          status: PropertyStatus.PUBLISHED,
        }),
        PropertyModel.countDocuments({
          ...orgFilter,
          status: PropertyStatus.DRAFT,
        }),
        PropertyModel.countDocuments({
          ...orgFilter,
          status: PropertyStatus.PROCESSING,
        }),
        NodeModel.countDocuments({ propertyId: { $in: propertyIds } }),
        PhotoModel.countDocuments({ propertyId: { $in: propertyIds } }),
        UserModel.countDocuments(
          request.authUser.role === "SUPER_ADMIN"
            ? {}
            : { organizationId: request.authUser.organizationId },
        ),
        AnalyticsEventModel.countDocuments({
          propertyId: { $in: propertyIds },
          type: "TOUR_VIEW",
        }),
      ]);

      return {
        properties: {
          total: propertiesTotal,
          published,
          draft,
          processing,
        },
        nodes,
        photos,
        users,
        tourViews,
      };
    },
  );
}
