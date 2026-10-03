import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { NodeStatus, PhotoDirection } from "@viewra/types";

const nodeSchema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    label: { type: String, required: true, maxlength: 200 },
    sequence: { type: Number, required: true, default: 0 },
    approximatePosition: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    captureMetadata: {
      deviceModel: String,
      capturedAt: Date,
      operatorId: { type: Schema.Types.ObjectId, ref: "User" },
      notes: String,
    },
    status: {
      type: String,
      enum: Object.values(NodeStatus),
      default: NodeStatus.DRAFT,
    },
    /** Directions the operator intentionally did not photograph (e.g. a wall). */
    skippedDirections: {
      type: [{ type: String, enum: Object.values(PhotoDirection) }],
      default: [],
    },
  },
  { timestamps: true },
);

export type NodeDocument = InferSchemaType<typeof nodeSchema> & {
  _id: Types.ObjectId;
};

export const NodeModel = model("Node", nodeSchema);
