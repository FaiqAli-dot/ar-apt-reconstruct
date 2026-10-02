import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@viewra/types";
import type { AppConfig } from "../config.js";
import { UserModel } from "../models/User.js";
import { serializeDoc } from "../utils/serialize.js";

export type AuthUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
};

export type JwtPayload = {
  sub: string;
  organizationId: string;
  role: UserRole;
  email: string;
  type: "access";
};

declare module "fastify" {
  interface FastifyInstance {
    appConfig: AppConfig;
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function authPlugin(app: FastifyInstance) {
  await app.register(fjwt, {
    secret: app.appConfig.jwtSecret,
    sign: {
      expiresIn: app.appConfig.jwtAccessExpiresIn,
    },
  });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = await request.jwtVerify<JwtPayload>();
        if (payload.type !== "access") {
          return reply.status(401).send({
            statusCode: 401,
            error: "Unauthorized",
            message: "Invalid token type",
          });
        }
        const user = await UserModel.findById(payload.sub);
        if (!user || user.status !== "ACTIVE") {
          return reply.status(401).send({
            statusCode: 401,
            error: "Unauthorized",
            message: "User not found or inactive",
          });
        }
        const serialized = serializeDoc(user)!;
        request.authUser = {
          id: serialized.id as string,
          organizationId: String(serialized.organizationId),
          name: serialized.name as string,
          email: serialized.email as string,
          role: serialized.role as UserRole,
          status: serialized.status as string,
        };
      } catch {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Authentication required",
        });
      }
    },
  );
}

export default fp(authPlugin, { name: "auth-plugin" });
