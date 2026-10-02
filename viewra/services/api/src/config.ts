import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../../../.env") });
loadDotenv({ path: resolve(__dirname, "../../../.env.local"), override: true });

const configSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  databaseUrl: z.string().default("mongodb://localhost:27017/viewra"),
  databaseName: z.string().default("viewra"),
  jwtSecret: z.string().min(16).default("change-me-to-a-long-random-secret-at-least-32-chars"),
  jwtAccessExpiresIn: z.string().default("15m"),
  jwtRefreshExpiresIn: z.string().default("7d"),
  bcryptRounds: z.coerce.number().int().positive().default(12),
  s3Endpoint: z.string().default("http://localhost:9000"),
  s3Region: z.string().default("us-east-1"),
  s3Bucket: z.string().default("viewra"),
  s3AccessKey: z.string().default("minioadmin"),
  s3SecretKey: z.string().default("minioadmin"),
  s3ForcePathStyle: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  s3PublicUrl: z.string().default("http://localhost:9000/viewra"),
  apiHost: z.string().default("0.0.0.0"),
  apiPort: z.coerce.number().int().positive().default(3001),
  apiUrl: z.string().default("http://localhost:3001"),
  corsOrigins: z
    .string()
    .default("http://localhost:5173,http://localhost:5174")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  rateLimitMax: z.coerce.number().int().positive().default(200),
  rateLimitWindowMs: z.coerce.number().int().positive().default(60_000),
  logLevel: z.string().default("info"),
  publicViewerUrl: z.string().default("http://localhost:5174"),
  seedAdminEmail: z.string().email().default("admin@viewra.local"),
  seedAdminPassword: z.string().min(8).default("ViewraAdmin123!"),
  seedOperatorEmail: z.string().email().default("operator@viewra.local"),
  seedOperatorPassword: z.string().min(8).default("ViewraOperator123!"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse({
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    databaseName: env.DATABASE_NAME,
    jwtSecret: env.JWT_SECRET,
    jwtAccessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    bcryptRounds: env.BCRYPT_ROUNDS,
    s3Endpoint: env.S3_ENDPOINT,
    s3Region: env.S3_REGION,
    s3Bucket: env.S3_BUCKET,
    s3AccessKey: env.S3_ACCESS_KEY,
    s3SecretKey: env.S3_SECRET_KEY,
    s3ForcePathStyle: env.S3_FORCE_PATH_STYLE,
    s3PublicUrl: env.S3_PUBLIC_URL,
    apiHost: env.API_HOST,
    apiPort: env.API_PORT,
    apiUrl: env.API_URL,
    corsOrigins: env.CORS_ORIGINS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    logLevel: env.LOG_LEVEL,
    publicViewerUrl: env.PUBLIC_VIEWER_URL,
    seedAdminEmail: env.SEED_ADMIN_EMAIL,
    seedAdminPassword: env.SEED_ADMIN_PASSWORD,
    seedOperatorEmail: env.SEED_OPERATOR_EMAIL,
    seedOperatorPassword: env.SEED_OPERATOR_PASSWORD,
  });
}

export const config = loadConfig();
