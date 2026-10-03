import { z } from "zod";
import {
  connectionDirectionSchema,
  nodeStatusSchema,
  photoDirectionSchema,
  positionSchema,
  propertyStatusSchema,
  roomTypeSchema,
  userRoleSchema,
  userStatusSchema,
} from "./enums.js";
import { propertyAddressSchema } from "./models.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const createUserSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: userRoleSchema.default("CAPTURE_OPERATOR"),
  status: userStatusSchema.default("ACTIVE"),
});

export const createPropertySchema = z.object({
  title: z.string().min(1).max(300),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  address: propertyAddressSchema.optional(),
  description: z.string().max(5000).optional(),
});

export const updatePropertySchema = createPropertySchema
  .partial()
  .extend({
    status: propertyStatusSchema.optional(),
    coverPhotoId: z.string().nullable().optional(),
  });

export const createRoomSchema = z.object({
  name: z.string().min(1).max(200),
  type: roomTypeSchema.default("OTHER"),
  order: z.number().int().nonnegative().optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const createNodeSchema = z.object({
  roomId: z.string().min(1),
  label: z.string().min(1).max(200).optional(),
  sequence: z.number().int().nonnegative().optional(),
  approximatePosition: positionSchema.optional(),
  connectFromNodeId: z.string().optional(),
  connectionDirection: connectionDirectionSchema.optional(),
  connectionLabel: z.string().max(200).optional(),
  captureMetadata: z
    .object({
      deviceModel: z.string().optional(),
      capturedAt: z.string().datetime().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export const updateNodeSchema = z.object({
  roomId: z.string().optional(),
  label: z.string().min(1).max(200).optional(),
  sequence: z.number().int().nonnegative().optional(),
  approximatePosition: positionSchema.optional(),
  status: nodeStatusSchema.optional(),
  skippedDirections: z.array(photoDirectionSchema).max(3).optional(),
  captureMetadata: z
    .object({
      deviceModel: z.string().optional(),
      capturedAt: z.string().datetime().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export const createConnectionSchema = z.object({
  propertyId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  direction: connectionDirectionSchema.default("CUSTOM"),
  label: z.string().max(200).optional(),
  bidirectional: z.boolean().default(false),
});

export const requestUploadSchema = z.object({
  direction: photoDirectionSchema,
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
  originalFilename: z.string().max(500).optional(),
});

export const completeUploadSchema = z.object({
  photoId: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const analyticsTrackSchema = z.object({
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
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
