import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { PhotoDirection, ProcessingStatus } from "@viewra/types";

const photoSchema = new Schema(
  {
    nodeId: {
      type: Schema.Types.ObjectId,
      ref: "Node",
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: Object.values(PhotoDirection),
      required: true,
    },
    originalKey: { type: String, default: null },
    processedKey: { type: String, default: null },
    avifKey: { type: String, default: null },
    thumbnailKey: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    mimeType: { type: String, default: null },
    fileSize: { type: Number, default: null },
    processingStatus: {
      type: String,
      enum: Object.values(ProcessingStatus),
      default: ProcessingStatus.PENDING_UPLOAD,
      index: true,
    },
    processingError: { type: String, default: null },
    metadata: {
      exifOrientation: Number,
      originalFilename: String,
      capturedAt: Date,
      warnings: [String],
      quality: {
        meanLuminance: Number,
        laplacianVariance: Number,
        perceptualHash: String,
      },
    },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

photoSchema.index({ nodeId: 1, direction: 1 }, { unique: true });

export type PhotoDocument = HydratedDocument<
  InferSchemaType<typeof photoSchema>
>;

export const PhotoModel = model("Photo", photoSchema);

const processingJobSchema = new Schema(
  {
    photoId: {
      type: Schema.Types.ObjectId,
      ref: "Photo",
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"],
      default: "QUEUED",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ProcessingJobDocument = HydratedDocument<
  InferSchemaType<typeof processingJobSchema>
>;

export const ProcessingJobModel = model("ProcessingJob", processingJobSchema);

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
