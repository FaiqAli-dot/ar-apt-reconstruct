import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PhotoDirection, ProcessingStatus } from "@viewra/types";
import { storageKey } from "@viewra/shared";
import { createTestJpeg } from "../../src/process-image.js";
import { PhotoModel, ProcessingJobModel } from "../../src/models.js";
import {
  claimNextJob,
  failJob,
  processJob,
} from "../../src/process-job.js";
import { deriveVariantKeys } from "../../src/storage.js";
import {
  setupWorkerTest,
  teardownWorkerTest,
  type WorkerTestContext,
} from "./helpers/setup.js";

describe("worker processJob integration", () => {
  let ctx: WorkerTestContext;

  beforeAll(async () => {
    ctx = await setupWorkerTest();
  }, 180_000);

  afterAll(async () => {
    if (ctx) await teardownWorkerTest(ctx);
  });

  it("deriveVariantKeys replaces /original/ and switches ext to webp", () => {
    expect(deriveVariantKeys("org1/prop1/original/photo123.jpg")).toEqual({
      processedKey: "org1/prop1/processed/photo123.webp",
      thumbnailKey: "org1/prop1/thumbnail/photo123.webp",
    });
  });

  it("processes a JPEG into READY photo with S3 variants", async () => {
    const { config, storage } = ctx;
    const organizationId = new Types.ObjectId().toString();
    const propertyId = new Types.ObjectId();
    const nodeId = new Types.ObjectId();
    const photoId = new Types.ObjectId();

    const originalKey = storageKey({
      organizationId,
      propertyId: propertyId.toString(),
      kind: "original",
      photoId: photoId.toString(),
      ext: "jpg",
    });

    const jpeg = await createTestJpeg({ width: 1200, height: 800 });
    await storage.putObject(originalKey, jpeg, "image/jpeg");

    const photo = await PhotoModel.create({
      _id: photoId,
      nodeId,
      propertyId,
      direction: PhotoDirection.CENTER,
      originalKey,
      processingStatus: ProcessingStatus.QUEUED,
      mimeType: "image/jpeg",
      fileSize: jpeg.byteLength,
    });

    const job = await ProcessingJobModel.create({
      photoId: photo._id,
      propertyId,
      status: "QUEUED",
      attempts: 0,
    });

    const claimed = await claimNextJob(config);
    expect(claimed).not.toBeNull();
    expect(claimed!._id.toString()).toBe(job._id.toString());
    expect(claimed!.status).toBe("PROCESSING");
    expect(claimed!.attempts).toBe(1);

    await processJob(claimed!, { config, storage });

    const updatedPhoto = await PhotoModel.findById(photoId);
    expect(updatedPhoto).not.toBeNull();
    expect(updatedPhoto!.processingStatus).toBe(ProcessingStatus.READY);
    expect(updatedPhoto!.mimeType).toBe("image/webp");
    expect(updatedPhoto!.processedKey).toContain("/processed/");
    expect(updatedPhoto!.thumbnailKey).toContain("/thumbnail/");
    expect(updatedPhoto!.width).toBe(1200);
    expect(updatedPhoto!.height).toBe(800);
    expect(updatedPhoto!.processingError).toBeNull();

    const updatedJob = await ProcessingJobModel.findById(job._id);
    expect(updatedJob!.status).toBe("COMPLETED");
    expect(updatedJob!.lastError).toBeNull();

    expect(await storage.objectExists(updatedPhoto!.processedKey!)).toBe(true);
    expect(await storage.objectExists(updatedPhoto!.thumbnailKey!)).toBe(true);
  });

  it("marks photo and job FAILED for corrupt image data", async () => {
    const { config, storage } = ctx;
    const organizationId = new Types.ObjectId().toString();
    const propertyId = new Types.ObjectId();
    const nodeId = new Types.ObjectId();
    const photoId = new Types.ObjectId();

    const originalKey = storageKey({
      organizationId,
      propertyId: propertyId.toString(),
      kind: "original",
      photoId: photoId.toString(),
      ext: "jpg",
    });

    const corrupt = Buffer.from("not-an-image-at-all");
    await storage.putObject(originalKey, corrupt, "image/jpeg");

    await PhotoModel.create({
      _id: photoId,
      nodeId,
      propertyId,
      direction: PhotoDirection.LEFT,
      originalKey,
      processingStatus: ProcessingStatus.QUEUED,
      mimeType: "image/jpeg",
      fileSize: corrupt.byteLength,
    });

    const job = await ProcessingJobModel.create({
      photoId,
      propertyId,
      status: "QUEUED",
      attempts: 0,
    });

    const claimed = await claimNextJob(config);
    expect(claimed).not.toBeNull();
    expect(claimed!._id.toString()).toBe(job._id.toString());

    let caught: unknown;
    try {
      await processJob(claimed!, { config, storage });
    } catch (err) {
      caught = err;
      await failJob(claimed!, err);
    }

    expect(caught).toBeDefined();

    const updatedPhoto = await PhotoModel.findById(photoId);
    expect(updatedPhoto!.processingStatus).toBe(ProcessingStatus.FAILED);
    expect(updatedPhoto!.processingError).toBeTruthy();

    const updatedJob = await ProcessingJobModel.findById(job._id);
    expect(updatedJob!.status).toBe("FAILED");
    expect(updatedJob!.lastError).toBeTruthy();
  });
});
