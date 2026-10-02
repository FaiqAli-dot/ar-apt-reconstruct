import { MongoMemoryServer } from "mongodb-memory-server";
import { loadConfig, type WorkerConfig } from "../../src/config.js";
import { connectDb, disconnectDb } from "../../src/db.js";
import { createS3Client, StorageService } from "../../src/storage.js";
import { startMinio, type MinioHarness } from "./minio.js";

export type WorkerTestContext = {
  config: WorkerConfig;
  storage: StorageService;
  mongo: MongoMemoryServer;
  minio: MinioHarness;
};

export async function setupWorkerTest(): Promise<WorkerTestContext> {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("viewra-worker-test");
  const minio = await startMinio();

  const config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: uri,
    S3_ENDPOINT: minio.endpoint,
    S3_REGION: minio.region,
    S3_BUCKET: minio.bucket,
    S3_ACCESS_KEY: minio.accessKey,
    S3_SECRET_KEY: minio.secretKey,
    S3_FORCE_PATH_STYLE: "true",
    S3_PUBLIC_URL: minio.publicUrl,
    WORKER_POLL_INTERVAL_MS: "100",
    WORKER_CONCURRENCY: "1",
    WORKER_MAX_RETRIES: "3",
    LOG_LEVEL: "silent",
  });

  await connectDb(uri);
  const storage = new StorageService(createS3Client(config), config);

  return { config, storage, mongo, minio };
}

export async function teardownWorkerTest(
  ctx: WorkerTestContext,
): Promise<void> {
  await disconnectDb();
  await ctx.mongo.stop();
  await ctx.minio.stop();
}
