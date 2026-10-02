import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { createLogger } from "./logger.js";
import { createS3Client, StorageService } from "./storage.js";
import { runWorkerLoop } from "./worker.js";

export { loadConfig, config, type WorkerConfig } from "./config.js";
export { connectDb, disconnectDb } from "./db.js";
export { PhotoModel, ProcessingJobModel } from "./models.js";
export { processImage, createTestJpeg } from "./process-image.js";
export {
  claimNextJob,
  processJob,
  failJob,
  claimAndProcess,
  retryBackoffMs,
} from "./process-job.js";
export { createS3Client, StorageService, deriveVariantKeys } from "./storage.js";
export { runWorkerLoop } from "./worker.js";

async function main(): Promise<void> {
  const logger = createLogger(config);
  await connectDb(config.databaseUrl, logger);

  const storage = new StorageService(createS3Client(config), config);
  const controller = new AbortController();

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    controller.abort();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await runWorkerLoop({
    config,
    storage,
    logger,
    signal: controller.signal,
  });

  process.exit(0);
}

const entry = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;
if (entry && import.meta.url === entry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
