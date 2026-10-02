import { Schema, model, type InferSchemaType, type Types } from "mongoose";

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

export type ProcessingJobDocument = InferSchemaType<
  typeof processingJobSchema
> & {
  _id: Types.ObjectId;
};

export const ProcessingJobModel = model("ProcessingJob", processingJobSchema);
