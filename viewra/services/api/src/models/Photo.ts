import { Schema, model, type InferSchemaType, type Types } from "mongoose";
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

export type PhotoDocument = InferSchemaType<typeof photoSchema> & {
  _id: Types.ObjectId;
};

export const PhotoModel = model("Photo", photoSchema);
