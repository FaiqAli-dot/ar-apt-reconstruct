import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { ConnectionDirection } from "@viewra/types";

const connectionSchema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    fromNodeId: {
      type: Schema.Types.ObjectId,
      ref: "Node",
      required: true,
    },
    toNodeId: {
      type: Schema.Types.ObjectId,
      ref: "Node",
      required: true,
    },
    direction: {
      type: String,
      enum: Object.values(ConnectionDirection),
      default: ConnectionDirection.CUSTOM,
    },
    label: { type: String, maxlength: 200 },
  },
  { timestamps: true },
);

connectionSchema.index(
  { propertyId: 1, fromNodeId: 1, toNodeId: 1 },
  { unique: true },
);

export type ConnectionDocument = InferSchemaType<typeof connectionSchema> & {
  _id: Types.ObjectId;
};

export const ConnectionModel = model("Connection", connectionSchema);
