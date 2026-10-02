import type { FastifyInstance } from "fastify";
import { createUserSchema, UserRole } from "@viewra/types";
import { UserModel } from "../models/User.js";
import { OrganizationModel } from "../models/Organization.js";
import { requireRoles } from "../middleware/authorize.js";
import { hashPassword, toPublicUser } from "../services/auth.js";
import { serializeDoc, serializeDocs } from "../utils/serialize.js";
import { validateBody } from "../utils/validation.js";

export async function userRoutes(app: FastifyInstance) {
  app.post(
    "/api/users",
    {
      preHandler: [
        requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
      ],
    },
    async (request, reply) => {
      const body = await validateBody(createUserSchema, request, reply);
      if (!body) return;

      if (
        request.authUser.role === UserRole.ADMIN &&
        body.organizationId !== request.authUser.organizationId
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: "Cannot create users for another organization",
        });
      }

      if (
        request.authUser.role === UserRole.ADMIN &&
        body.role === UserRole.SUPER_ADMIN
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: "Cannot create SUPER_ADMIN users",
        });
      }

      const org = await OrganizationModel.findById(body.organizationId);
      if (!org) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Organization not found",
        });
      }

      const existing = await UserModel.findOne({
        email: body.email.toLowerCase(),
      });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Email already registered",
        });
      }

      const passwordHash = await hashPassword(
        body.password,
        app.appConfig.bcryptRounds,
      );
      const user = await UserModel.create({
        organizationId: body.organizationId,
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash,
        role: body.role,
        status: body.status,
      });

      return reply.status(201).send(toPublicUser(serializeDoc(user)!));
    },
  );

  app.get(
    "/api/users",
    { preHandler: [app.authenticate] },
    async (request) => {
      const filter =
        request.authUser.role === UserRole.SUPER_ADMIN
          ? {}
          : { organizationId: request.authUser.organizationId };

      const users = await UserModel.find(filter).sort({ createdAt: -1 });
      return {
        items: serializeDocs(users).map((u) => toPublicUser(u)),
      };
    },
  );
}
