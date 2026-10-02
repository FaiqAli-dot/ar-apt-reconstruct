import { z } from "zod";

export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  CAPTURE_OPERATOR: "CAPTURE_OPERATOR",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const userRoleSchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "CAPTURE_OPERATOR",
]);

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INVITED: "INVITED",
  DISABLED: "DISABLED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export const userStatusSchema = z.enum(["ACTIVE", "INVITED", "DISABLED"]);

export const PropertyStatus = {
  DRAFT: "DRAFT",
  PROCESSING: "PROCESSING",
  READY: "READY",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type PropertyStatus =
  (typeof PropertyStatus)[keyof typeof PropertyStatus];
export const propertyStatusSchema = z.enum([
  "DRAFT",
  "PROCESSING",
  "READY",
  "PUBLISHED",
  "ARCHIVED",
]);

export const RoomType = {
  LIVING_ROOM: "LIVING_ROOM",
  KITCHEN: "KITCHEN",
  BEDROOM: "BEDROOM",
  BATHROOM: "BATHROOM",
  HALLWAY: "HALLWAY",
  ENTRANCE: "ENTRANCE",
  BALCONY: "BALCONY",
  OFFICE: "OFFICE",
  DINING: "DINING",
  OTHER: "OTHER",
} as const;
export type RoomType = (typeof RoomType)[keyof typeof RoomType];
export const roomTypeSchema = z.enum([
  "LIVING_ROOM",
  "KITCHEN",
  "BEDROOM",
  "BATHROOM",
  "HALLWAY",
  "ENTRANCE",
  "BALCONY",
  "OFFICE",
  "DINING",
  "OTHER",
]);

export const PhotoDirection = {
  LEFT: "LEFT",
  CENTER: "CENTER",
  RIGHT: "RIGHT",
} as const;
export type PhotoDirection =
  (typeof PhotoDirection)[keyof typeof PhotoDirection];
export const photoDirectionSchema = z.enum(["LEFT", "CENTER", "RIGHT"]);
export const REQUIRED_PHOTO_DIRECTIONS: PhotoDirection[] = [
  PhotoDirection.LEFT,
  PhotoDirection.CENTER,
  PhotoDirection.RIGHT,
];

export const ConnectionDirection = {
  FORWARD: "FORWARD",
  BACK: "BACK",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  UP: "UP",
  DOWN: "DOWN",
  CUSTOM: "CUSTOM",
} as const;
export type ConnectionDirection =
  (typeof ConnectionDirection)[keyof typeof ConnectionDirection];
export const connectionDirectionSchema = z.enum([
  "FORWARD",
  "BACK",
  "LEFT",
  "RIGHT",
  "UP",
  "DOWN",
  "CUSTOM",
]);

export const NodeStatus = {
  DRAFT: "DRAFT",
  CAPTURING: "CAPTURING",
  COMPLETE: "COMPLETE",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type NodeStatus = (typeof NodeStatus)[keyof typeof NodeStatus];
export const nodeStatusSchema = z.enum([
  "DRAFT",
  "CAPTURING",
  "COMPLETE",
  "PROCESSING",
  "READY",
  "FAILED",
]);

export const ProcessingStatus = {
  PENDING_UPLOAD: "PENDING_UPLOAD",
  UPLOADED: "UPLOADED",
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type ProcessingStatus =
  (typeof ProcessingStatus)[keyof typeof ProcessingStatus];
export const processingStatusSchema = z.enum([
  "PENDING_UPLOAD",
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "READY",
  "FAILED",
]);

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof positionSchema>;
