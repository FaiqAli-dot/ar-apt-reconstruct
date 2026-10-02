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
  workerPollIntervalMs: z.coerce.number().int().positive().default(2000),
  workerConcurrency: z.coerce.number().int().positive().default(2),
  workerMaxRetries: z.coerce.number().int().positive().default(5),
  logLevel: z.string().default("info"),
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return configSchema.parse({
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    databaseName: env.DATABASE_NAME,
    s3Endpoint: env.S3_ENDPOINT,
    s3Region: env.S3_REGION,
    s3Bucket: env.S3_BUCKET,
    s3AccessKey: env.S3_ACCESS_KEY,
    s3SecretKey: env.S3_SECRET_KEY,
    s3ForcePathStyle: env.S3_FORCE_PATH_STYLE,
    s3PublicUrl: env.S3_PUBLIC_URL,
    workerPollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    workerConcurrency: env.WORKER_CONCURRENCY,
    workerMaxRetries: env.WORKER_MAX_RETRIES,
    logLevel: env.LOG_LEVEL,
  });
}

export const config = loadConfig();
