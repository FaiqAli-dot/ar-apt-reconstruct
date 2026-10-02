import type { FastifyInstance } from "fastify";
import {
  loginSchema,
  refreshTokenSchema,
} from "@viewra/types";
import {
  loginUser,
  logoutUser,
  refreshSession,
  toPublicUser,
} from "../services/auth.js";
import { UserModel } from "../models/User.js";
import { serializeDoc } from "../utils/serialize.js";
import { validateBody } from "../utils/validation.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const body = await validateBody(loginSchema, request, reply);
    if (!body) return;

    const result = await loginUser(app, body.email, body.password);
    if (!result) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }
    return result;
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const body = await validateBody(refreshTokenSchema, request, reply);
    if (!body) return;

    const result = await refreshSession(app, body.refreshToken);
    if (!result) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid or expired refresh token",
      });
    }
    return result;
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const body = refreshTokenSchema.partial().safeParse(request.body ?? {});
    await logoutUser(body.success ? body.data.refreshToken : undefined);
    return reply.status(204).send();
  });

  app.get(
    "/api/auth/me",
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = await UserModel.findById(request.authUser.id);
      return { user: toPublicUser(serializeDoc(user)!) };
    },
  );
}
