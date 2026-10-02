import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import authPlugin from "./plugins/auth.js";
import { createS3Client, StorageService } from "./services/storage.js";
import { formatZodError } from "./utils/validation.js";
import { authRoutes } from "./routes/auth.js";
import { organizationRoutes } from "./routes/organizations.js";
import { userRoutes } from "./routes/users.js";
import { propertyRoutes } from "./routes/properties.js";
import { roomRoutes } from "./routes/rooms.js";
import { nodeRoutes } from "./routes/nodes.js";
import { photoRoutes } from "./routes/photos.js";
import { connectionRoutes } from "./routes/connections.js";
import { graphRoutes } from "./routes/graph.js";
import { tourRoutes } from "./routes/tours.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { healthRoutes } from "./routes/index.js";

declare module "fastify" {
  interface FastifyInstance {
    storage: StorageService;
  }
}

export type BuildAppOptions = {
  config?: AppConfig;
  logger?: FastifyServerOptions["logger"];
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger:
      options.logger ??
      (config.nodeEnv === "test"
        ? false
        : {
            level: config.logLevel,
          }),
    trustProxy: true,
  });

  app.decorate("appConfig", config);
  const storage = new StorageService(createS3Client(config), config);
  app.decorate("storage", storage);

  await app.register(sensible);
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
  });
  await app.register(authPlugin);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send(formatZodError(error));
    }
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.status(statusCode).send({
      statusCode,
      error:
        statusCode === 400
          ? "Bad Request"
          : statusCode === 401
            ? "Unauthorized"
            : statusCode === 403
              ? "Forbidden"
              : statusCode === 404
                ? "Not Found"
                : statusCode === 409
                  ? "Conflict"
                  : "Internal Server Error",
      message:
        statusCode >= 500
          ? "Internal Server Error"
          : error instanceof Error
            ? error.message
            : "Request failed",
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(organizationRoutes);
  await app.register(userRoutes);
  await app.register(dashboardRoutes);
  await app.register(propertyRoutes);
  await app.register(roomRoutes);
  await app.register(nodeRoutes);
  await app.register(photoRoutes);
  await app.register(connectionRoutes);
  await app.register(graphRoutes);
  await app.register(tourRoutes);
  await app.register(analyticsRoutes);

  return app;
}
