import { z } from "zod";
import {
  connectionDirectionSchema,
  nodeStatusSchema,
  photoDirectionSchema,
  positionSchema,
  processingStatusSchema,
  propertyStatusSchema,
  roomTypeSchema,
  userRoleSchema,
  userStatusSchema,
} from "./enums.js";

export const organizationSettingsSchema = z.object({
  defaultPhotoDirections: z.array(photoDirectionSchema).default(["LEFT", "CENTER", "RIGHT"]),
  branding: z
    .object({
      primaryColor: z.string().optional(),
      logoUrl: z.string().url().optional(),
    })
    .optional(),
});

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100),
  settings: organizationSettingsSchema.default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const userSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  role: userRoleSchema,
  status: userStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof userSchema>;

export const propertyAddressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const propertySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200),
  publicId: z.string().min(6).max(32),
  address: propertyAddressSchema.optional(),
  description: z.string().max(5000).optional(),
  status: propertyStatusSchema,
  coverPhotoId: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Property = z.infer<typeof propertySchema>;

export const roomSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  name: z.string().min(1).max(200),
  type: roomTypeSchema,
  order: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Room = z.infer<typeof roomSchema>;

export const captureMetadataSchema = z.object({
  deviceModel: z.string().optional(),
  capturedAt: z.string().datetime().optional(),
  operatorId: z.string().optional(),
  notes: z.string().optional(),
});

export const nodeSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  roomId: z.string(),
  label: z.string().min(1).max(200),
  sequence: z.number().int().nonnegative(),
  approximatePosition: positionSchema.default({ x: 0, y: 0 }),
  captureMetadata: captureMetadataSchema.optional(),
  status: nodeStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Node = z.infer<typeof nodeSchema>;

export const photoMetadataSchema = z.object({
  exifOrientation: z.number().optional(),
  originalFilename: z.string().optional(),
  capturedAt: z.string().datetime().optional(),
  warnings: z.array(z.string()).optional(),
});

export const photoSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  propertyId: z.string(),
  direction: photoDirectionSchema,
  originalKey: z.string().nullable().optional(),
  processedKey: z.string().nullable().optional(),
  thumbnailKey: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  fileSize: z.number().int().nonnegative().nullable().optional(),
  processingStatus: processingStatusSchema,
  processingError: z.string().nullable().optional(),
  metadata: photoMetadataSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Photo = z.infer<typeof photoSchema>;

export const connectionSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  direction: connectionDirectionSchema.default("CUSTOM"),
  label: z.string().max(200).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});
export type Connection = z.infer<typeof connectionSchema>;

export const analyticsEventSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  organizationId: z.string(),
  type: z.enum([
    "TOUR_VIEW",
    "NODE_VIEW",
    "SESSION_END",
    "QR_SCAN",
    "MAP_OPEN",
    "MAP_JUMP",
  ]),
  nodeId: z.string().optional(),
  sessionId: z.string().optional(),
  visitorId: z.string().optional(),
  durationMs: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export const graphNodeSchema = nodeSchema.extend({
  photos: z.array(photoSchema).default([]),
  roomName: z.string().optional(),
});

export const propertyGraphSchema = z.object({
  property: propertySchema,
  rooms: z.array(roomSchema),
  nodes: z.array(graphNodeSchema),
  connections: z.array(connectionSchema),
});
export type PropertyGraph = z.infer<typeof propertyGraphSchema>;

export const publishValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  nodeId: z.string().optional(),
  roomId: z.string().optional(),
  connectionId: z.string().optional(),
  photoId: z.string().optional(),
});
export type PublishValidationIssue = z.infer<
  typeof publishValidationIssueSchema
>;

export const publishValidationReportSchema = z.object({
  ready: z.boolean(),
  checks: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      ok: z.boolean(),
      detail: z.string().optional(),
    }),
  ),
  issues: z.array(publishValidationIssueSchema),
  summary: z.object({
    rooms: z.number(),
    nodes: z.number(),
    photos: z.number(),
    connections: z.number(),
    processedPhotos: z.number(),
  }),
});
export type PublishValidationReport = z.infer<
  typeof publishValidationReportSchema
>;
