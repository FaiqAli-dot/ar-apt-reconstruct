import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const organizationSettingsSchema = new Schema(
  {
    defaultPhotoDirections: {
      type: [String],
      default: ["LEFT", "CENTER", "RIGHT"],
    },
    branding: {
      primaryColor: { type: String },
      logoUrl: { type: String },
    },
  },
  { _id: false },
);

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, maxlength: 100 },
    settings: { type: organizationSettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & {
  _id: Types.ObjectId;
};

export const OrganizationModel = model("Organization", organizationSchema);
