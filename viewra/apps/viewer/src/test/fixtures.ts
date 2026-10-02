import { vi } from "vitest";
import type { PublicTour } from "../api/types";

export const tourFixture: PublicTour = {
  property: {
    id: "prop1",
    title: "Harbor Loft",
    publicId: "abc123xyz0",
    description: "A quiet loft overlooking the harbor",
    status: "PUBLISHED",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  rooms: [
    { id: "room1", name: "Living Room", type: "LIVING_ROOM", order: 0 },
    { id: "room2", name: "Kitchen", type: "KITCHEN", order: 1 },
    { id: "room3", name: "Hallway", type: "HALLWAY", order: 2 },
  ],
  nodes: [
    {
      id: "node-living",
      label: "Living center",
      sequence: 0,
      roomId: "room1",
      roomName: "Living Room",
      approximatePosition: { x: 0, y: 0 },
      photos: [
        {
          id: "photo-living-center",
          direction: "CENTER",
          url: "https://cdn.example/living-center.jpg",
          thumbnailUrl: "https://cdn.example/living-center-thumb.jpg",
          width: 1600,
          height: 1200,
        },
      ],
    },
    {
      id: "node-kitchen",
      label: "Kitchen center",
      sequence: 1,
      roomId: "room2",
      roomName: "Kitchen",
      approximatePosition: { x: 10, y: 0 },
      photos: [
        {
          id: "photo-kitchen-center",
          direction: "CENTER",
          url: "https://cdn.example/kitchen-center.jpg",
          thumbnailUrl: "https://cdn.example/kitchen-center-thumb.jpg",
          width: 1600,
          height: 1200,
        },
      ],
    },
    {
      id: "node-hall",
      label: "Hall",
      sequence: 2,
      roomId: "room3",
      roomName: "Hallway",
      approximatePosition: { x: 5, y: 8 },
      photos: [],
    },
  ],
  connections: [
    {
      id: "conn-1",
      fromNodeId: "node-living",
      toNodeId: "node-kitchen",
      direction: "FORWARD",
      label: "To kitchen",
    },
    {
      id: "conn-2",
      fromNodeId: "node-kitchen",
      toNodeId: "node-living",
      direction: "BACK",
      label: "Back to living",
    },
    {
      id: "conn-3",
      fromNodeId: "node-kitchen",
      toNodeId: "node-hall",
      direction: "RIGHT",
      label: "To hallway",
    },
  ],
};

export function mockTourFetch(options?: {
  status?: number;
  body?: unknown;
  message?: string;
}) {
  const status = options?.status ?? 200;
  const body =
    options?.body ??
    (status >= 400
      ? { message: options?.message ?? "Tour not found" }
      : tourFixture);

  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 410 ? "Gone" : status === 404 ? "Not Found" : "OK",
    json: async () => body,
  });
}
