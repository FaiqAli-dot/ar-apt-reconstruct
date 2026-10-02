import { ProcessingStatus } from "@viewra/types";
import type { Logger } from "pino";
import type { WorkerConfig } from "./config.js";
import { processImage } from "./process-image.js";
import {
  analyzeImageQuality,
  buildQualityWarnings,
} from "./image-quality.js";
import {
  PhotoModel,
  ProcessingJobModel,
  type ProcessingJobDocument,
} from "./models.js";
import { deriveVariantKeys, type StorageService } from "./storage.js";

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/** Exponential backoff based on attempts already made. */
export function retryBackoffMs(attempts: number): number {
  const exp = Math.max(0, attempts - 1);
  return Math.min(BASE_BACKOFF_MS * 2 ** exp, MAX_BACKOFF_MS);
}

function isRetryEligible(
  job: { attempts: number; lockedAt?: Date | null; updatedAt?: Date },
  maxRetries: number,
  now: Date,
): boolean {
  if (job.attempts >= maxRetries) return false;
  const anchor = job.lockedAt ?? job.updatedAt ?? now;
  const wait = retryBackoffMs(job.attempts);
  return now.getTime() - new Date(anchor).getTime() >= wait;
}

/**
 * Atomically claim the next available job (QUEUED, or FAILED past backoff).
 */
export async function claimNextJob(
  config: WorkerConfig,
  now = new Date(),
): Promise<ProcessingJobDocument | null> {
  // Prefer QUEUED jobs — claim with findOneAndUpdate for atomicity.
  const queued = await ProcessingJobModel.findOneAndUpdate(
    { status: "QUEUED" },
    {
      $set: { status: "PROCESSING", lockedAt: now },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true },
  );
  if (queued) return queued;

  // Retry FAILED jobs that still have attempts remaining and passed backoff.
  const candidates = await ProcessingJobModel.find({
    status: "FAILED",
    attempts: { $lt: config.workerMaxRetries },
  })
    .sort({ updatedAt: 1 })
    .limit(20)
    .lean();

  for (const candidate of candidates) {
    if (!isRetryEligible(candidate, config.workerMaxRetries, now)) continue;

    const claimed = await ProcessingJobModel.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "FAILED",
        attempts: { $lt: config.workerMaxRetries },
      },
      {
        $set: { status: "PROCESSING", lockedAt: now },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    if (claimed) return claimed;
  }

  return null;
}

export type ProcessJobDeps = {
  config: WorkerConfig;
  storage: StorageService;
  logger?: Logger;
};

/**
 * Process a single claimed job end-to-end.
 */
export async function processJob(
  job: ProcessingJobDocument,
  deps: ProcessJobDeps,
): Promise<void> {
  const { storage, logger } = deps;
  const log = logger?.child({
    jobId: job._id.toString(),
    photoId: job.photoId.toString(),
  });

  const photo = await PhotoModel.findById(job.photoId);
  if (!photo) {
    throw new Error(`Photo not found: ${job.photoId.toString()}`);
  }
  if (!photo.originalKey) {
    throw new Error(`Photo ${photo._id.toString()} has no originalKey`);
  }

  photo.processingStatus = ProcessingStatus.PROCESSING;
  photo.processingError = null;
  await photo.save();

  log?.info({ key: photo.originalKey }, "Downloading original");
  const original = await storage.getObject(photo.originalKey);

  log?.info("Analyzing image quality");
  const qualityMetrics = await analyzeImageQuality(original);
  const siblings = await PhotoModel.find({
    nodeId: photo.nodeId,
    _id: { $ne: photo._id },
    "metadata.quality.perceptualHash": { $exists: true },
  }).select("metadata.quality.perceptualHash");
  const siblingHashes = siblings
    .map((p) => p.metadata?.quality?.perceptualHash as string | undefined)
    .filter((h): h is string => Boolean(h));
  const { warnings: qualityWarnings } = buildQualityWarnings(
    qualityMetrics,
    siblingHashes,
  );

  log?.info("Processing image with Sharp");
  const images = await processImage(original);

  const { processedKey, processedAvifKey, thumbnailKey } = deriveVariantKeys(
    photo.originalKey,
  );

  log?.info({ processedKey, processedAvifKey, thumbnailKey }, "Uploading variants");
  await storage.putObject(processedKey, images.processed, "image/webp");
  await storage.putObject(processedAvifKey, images.processedAvif, "image/avif");
  await storage.putObject(thumbnailKey, images.thumbnail, "image/webp");

  const existingWarnings = photo.metadata?.warnings ?? [];
  const mergedWarnings = [
    ...new Set([...existingWarnings, ...qualityWarnings]),
  ];

  photo.processedKey = processedKey;
  photo.avifKey = processedAvifKey;
  photo.thumbnailKey = thumbnailKey;
  photo.width = images.width;
  photo.height = images.height;
  photo.mimeType = "image/webp";
  photo.fileSize = images.processed.byteLength;
  photo.metadata = {
    ...photo.metadata,
    warnings: mergedWarnings,
    quality: qualityMetrics,
  };
  photo.processingStatus = ProcessingStatus.READY;
  photo.processingError = null;
  await photo.save();

  job.status = "COMPLETED";
  job.lastError = null;
  await job.save();

  log?.info("Job completed");
}

/**
 * Mark photo and job as FAILED. Job remains retryable until max attempts.
 */
export async function failJob(
  job: ProcessingJobDocument,
  error: unknown,
  logger?: Logger,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  logger?.error(
    { jobId: job._id.toString(), err: message, attempts: job.attempts },
    "Job failed",
  );

  await PhotoModel.findByIdAndUpdate(job.photoId, {
    $set: {
      processingStatus: ProcessingStatus.FAILED,
      processingError: message,
    },
  });

  job.status = "FAILED";
  job.lastError = message;
  await job.save();
}

/**
 * Claim and process one job. Returns true if work was done.
 */
export async function claimAndProcess(
  deps: ProcessJobDeps,
): Promise<boolean> {
  const job = await claimNextJob(deps.config);
  if (!job) return false;

  try {
    await processJob(job, deps);
  } catch (err) {
    await failJob(job, err, deps.logger);
  }
  return true;
}
