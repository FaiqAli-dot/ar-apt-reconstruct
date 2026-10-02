import { describe, expect, it } from "vitest";
import {
  canReach,
  generatePublicId,
  slugify,
  validatePropertyGraph,
} from "./index.js";
import type { Connection, Node, Photo, Property, Room } from "@viewra/types";

function baseProperty(): Property {
  return {
    id: "p1",
    organizationId: "o1",
    title: "Demo",
    slug: "demo",
    publicId: "abc123",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function node(id: string, roomId: string, label: string): Node {
  return {
    id,
    propertyId: "p1",
    roomId,
    label,
    sequence: 0,
    approximatePosition: { x: 0, y: 0 },
    status: "READY",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function photo(nodeId: string, direction: "LEFT" | "CENTER" | "RIGHT"): Photo {
  return {
    id: `${nodeId}-${direction}`,
    nodeId,
    propertyId: "p1",
    direction,
    originalKey: `o/${nodeId}-${direction}.jpg`,
    processedKey: `p/${nodeId}-${direction}.webp`,
    thumbnailKey: `t/${nodeId}-${direction}.webp`,
    width: 2000,
    height: 1500,
    mimeType: "image/webp",
    fileSize: 1000,
    processingStatus: "READY",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function conn(from: string, to: string): Connection {
  return {
    id: `${from}-${to}`,
    propertyId: "p1",
    fromNodeId: from,
    toNodeId: to,
    direction: "CUSTOM",
    createdAt: new Date().toISOString(),
  };
}

describe("graph validation", () => {
  it("validates the branching acceptance graph", () => {
    const rooms: Room[] = [
      {
        id: "r1",
        propertyId: "p1",
        name: "Hall",
        type: "HALLWAY",
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const nodes = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      node(`n${n}`, "r1", `Node ${n}`),
    );
    const connections = [
      conn("n1", "n2"),
      conn("n2", "n3"),
      conn("n3", "n4"),
      conn("n4", "n5"),
      conn("n5", "n2"),
      conn("n2", "n6"),
      conn("n6", "n7"),
      conn("n7", "n8"),
      conn("n8", "n2"),
    ];
    const photos = nodes.flatMap((n) => [
      photo(n.id, "LEFT"),
      photo(n.id, "CENTER"),
      photo(n.id, "RIGHT"),
    ]);

    expect(canReach(connections, "n2", "n3")).toBe(true);
    expect(canReach(connections, "n2", "n6")).toBe(true);
    expect(canReach(connections, "n8", "n2")).toBe(true);
    expect(canReach(connections, "n1", "n8")).toBe(true);

    const report = validatePropertyGraph({
      property: baseProperty(),
      rooms,
      nodes,
      connections,
      photos,
    });
    expect(report.ready).toBe(true);
  });

  it("flags missing photos and broken connections", () => {
    const rooms: Room[] = [
      {
        id: "r1",
        propertyId: "p1",
        name: "Hall",
        type: "HALLWAY",
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const nodes = [node("n1", "r1", "Node 1")];
    const report = validatePropertyGraph({
      property: baseProperty(),
      rooms,
      nodes,
      connections: [conn("n1", "missing")],
      photos: [photo("n1", "LEFT"), photo("n1", "CENTER")],
    });
    expect(report.ready).toBe(false);
    expect(report.issues.some((i) => i.code === "MISSING_PHOTO")).toBe(true);
    expect(report.issues.some((i) => i.code === "BROKEN_CONNECTION_TO")).toBe(
      true,
    );
  });
});

describe("helpers", () => {
  it("generates stable-format public ids", () => {
    const id = generatePublicId();
    expect(id.length).toBe(10);
  });

  it("slugifies titles", () => {
    expect(slugify("Demo Apartment!")).toBe("demo-apartment");
  });
});
