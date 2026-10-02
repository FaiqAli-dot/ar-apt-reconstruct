import type { ConnectionDirection, PhotoDirection, Position } from "@viewra/types";

export type AnalyticsEventType =
  | "TOUR_VIEW"
  | "NODE_VIEW"
  | "SESSION_END"
  | "QR_SCAN"
  | "MAP_OPEN"
  | "MAP_JUMP";

export type TourPhoto = {
  id: string;
  direction: PhotoDirection;
  url: string;
  avifUrl?: string | null;
  thumbnailUrl: string;
  width?: number;
  height?: number;
};

export type TourNode = {
  id: string;
  label: string;
  sequence: number;
  roomId: string;
  roomName?: string;
  approximatePosition: Position;
  photos: TourPhoto[];
};

export type TourConnection = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  direction: ConnectionDirection;
  label?: string;
};

export type TourRoom = {
  id: string;
  name: string;
  type: string;
  order: number;
};

export type TourProperty = {
  id: string;
  title: string;
  publicId: string;
  description?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  status: string;
  publishedAt?: string | null;
};

export type PublicTour = {
  property: TourProperty;
  rooms: TourRoom[];
  nodes: TourNode[];
  connections: TourConnection[];
};

export type TourApiError = {
  status: number;
  message: string;
};

export type TrackAnalyticsInput = {
  type: AnalyticsEventType;
  nodeId?: string;
  sessionId?: string;
  visitorId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};
