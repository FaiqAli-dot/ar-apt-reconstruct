import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { RoomType } from "@viewra/types";

const roomSchema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 200 },
    type: {
      type: String,
      enum: Object.values(RoomType),
      default: RoomType.OTHER,
    },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type RoomDocument = InferSchemaType<typeof roomSchema> & {
  _id: Types.ObjectId;
};

export const RoomModel = model("Room", roomSchema);
