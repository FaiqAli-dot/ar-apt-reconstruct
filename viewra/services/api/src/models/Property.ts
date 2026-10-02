import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { PropertyStatus } from "@viewra/types";

const addressSchema = new Schema(
  {
    line1: String,
    line2: String,
    city: String,
    region: String,
    postalCode: String,
    country: String,
  },
  { _id: false },
);

const propertySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 300 },
    slug: { type: String, required: true, maxlength: 200 },
    publicId: { type: String, required: true, unique: true, index: true },
    address: { type: addressSchema },
    description: { type: String, maxlength: 5000 },
    status: {
      type: String,
      enum: Object.values(PropertyStatus),
      default: PropertyStatus.DRAFT,
      index: true,
    },
    coverPhotoId: { type: Schema.Types.ObjectId, ref: "Photo", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

propertySchema.index({ organizationId: 1, slug: 1 }, { unique: true });

export type PropertyDocument = HydratedDocument<
  InferSchemaType<typeof propertySchema>
>;

export const PropertyModel = model("Property", propertySchema);
