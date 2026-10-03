import {
  type Connection,
  type Node,
  type Photo,
  type Property,
  type PublishValidationIssue,
  type PublishValidationReport,
  type Room,
  REQUIRED_PHOTO_DIRECTIONS,
  ProcessingStatus,
} from "@viewra/types";
import { customAlphabet } from "nanoid";

const publicIdAlphabet = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
  10,
);

export function generatePublicId(): string {
  return publicIdAlphabet();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

export type GraphInput = {
  property: Property;
  rooms: Room[];
  nodes: Node[];
  connections: Connection[];
  photos: Photo[];
};

export function validatePropertyGraph(
  input: GraphInput,
): PublishValidationReport {
  const issues: PublishValidationIssue[] = [];
  const roomIds = new Set(input.rooms.map((r) => r.id));
  const nodeIds = new Set(input.nodes.map((n) => n.id));
  const photosByNode = new Map<string, Photo[]>();

  for (const photo of input.photos) {
    const list = photosByNode.get(photo.nodeId) ?? [];
    list.push(photo);
    photosByNode.set(photo.nodeId, list);
  }

  if (!input.property.title?.trim()) {
    issues.push({
      code: "PROPERTY_TITLE_MISSING",
      severity: "error",
      message: "Property information is incomplete (title required)",
    });
  }

  if (input.rooms.length === 0) {
    issues.push({
      code: "NO_ROOMS",
      severity: "error",
      message: "At least one room is required",
    });
  }

  if (input.nodes.length === 0) {
    issues.push({
      code: "NO_NODES",
      severity: "error",
      message: "At least one node is required",
    });
  }

  for (const node of input.nodes) {
    if (!roomIds.has(node.roomId)) {
      issues.push({
        code: "NODE_INVALID_ROOM",
        severity: "error",
        message: `Node ${node.label} references a missing room`,
        nodeId: node.id,
        roomId: node.roomId,
      });
    }

    const photos = photosByNode.get(node.id) ?? [];
    const skipped = new Set(node.skippedDirections ?? []);
    if (photos.length === 0 && skipped.size > 0) {
      issues.push({
        code: "MISSING_PHOTO",
        severity: "error",
        message: `Node ${node.label} has no photos (at least one direction is required)`,
        nodeId: node.id,
      });
    }
    for (const direction of REQUIRED_PHOTO_DIRECTIONS) {
      const photo = photos.find((p) => p.direction === direction);
      if (!photo) {
        if (skipped.has(direction)) continue;
        issues.push({
          code: "MISSING_PHOTO",
          severity: "error",
          message: `Node ${node.label} is missing ${direction} photo`,
          nodeId: node.id,
        });
        continue;
      }
      if (photo.processingStatus !== ProcessingStatus.READY) {
        issues.push({
          code: "PHOTO_NOT_PROCESSED",
          severity: "error",
          message: `Node ${node.label} ${direction} photo is not processed (${photo.processingStatus})`,
          nodeId: node.id,
          photoId: photo.id,
        });
      }
      if (!photo.processedKey) {
        issues.push({
          code: "PHOTO_NO_PROCESSED_KEY",
          severity: "error",
          message: `Node ${node.label} ${direction} photo has no processed image`,
          nodeId: node.id,
          photoId: photo.id,
        });
      }
    }
  }

  for (const connection of input.connections) {
    if (!nodeIds.has(connection.fromNodeId)) {
      issues.push({
        code: "BROKEN_CONNECTION_FROM",
        severity: "error",
        message: `Connection ${connection.id} references missing from-node`,
        connectionId: connection.id,
      });
    }
    if (!nodeIds.has(connection.toNodeId)) {
      issues.push({
        code: "BROKEN_CONNECTION_TO",
        severity: "error",
        message: `Connection ${connection.id} references missing to-node`,
        connectionId: connection.id,
      });
    }
    if (connection.fromNodeId === connection.toNodeId) {
      issues.push({
        code: "SELF_CONNECTION",
        severity: "warning",
        message: `Connection ${connection.id} connects a node to itself`,
        connectionId: connection.id,
        nodeId: connection.fromNodeId,
      });
    }
  }

  const processedPhotos = input.photos.filter(
    (p) => p.processingStatus === ProcessingStatus.READY && p.processedKey,
  ).length;

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const ready = errorCount === 0 && input.nodes.length > 0;

  const checks = [
    {
      key: "property",
      label: "Property information",
      ok: Boolean(input.property.title?.trim()),
    },
    {
      key: "rooms",
      label: `${input.rooms.length} rooms`,
      ok: input.rooms.length > 0,
      detail: input.rooms.length > 0 ? undefined : "Add at least one room",
    },
    {
      key: "nodes",
      label: `${input.nodes.length} nodes`,
      ok: input.nodes.length > 0,
    },
    {
      key: "photos",
      label: `${input.photos.length} photos`,
      ok: !issues.some((i) => i.code === "MISSING_PHOTO"),
    },
    {
      key: "processed",
      label: "All photos processed",
      ok: !issues.some(
        (i) =>
          i.code === "PHOTO_NOT_PROCESSED" ||
          i.code === "PHOTO_NO_PROCESSED_KEY",
      ),
      detail: `${processedPhotos}/${input.photos.length} ready`,
    },
    {
      key: "graph",
      label: "Navigation graph valid",
      ok: !issues.some((i) =>
        ["BROKEN_CONNECTION_FROM", "BROKEN_CONNECTION_TO", "NODE_INVALID_ROOM"].includes(
          i.code,
        ),
      ),
    },
  ];

  return {
    ready,
    checks,
    issues,
    summary: {
      rooms: input.rooms.length,
      nodes: input.nodes.length,
      photos: input.photos.length,
      connections: input.connections.length,
      processedPhotos,
    },
  };
}

export function buildAdjacency(
  connections: Connection[],
): Map<string, Connection[]> {
  const map = new Map<string, Connection[]>();
  for (const connection of connections) {
    const list = map.get(connection.fromNodeId) ?? [];
    list.push(connection);
    map.set(connection.fromNodeId, list);
  }
  return map;
}

export function canReach(
  connections: Connection[],
  fromNodeId: string,
  toNodeId: string,
): boolean {
  if (fromNodeId === toNodeId) return true;
  const adjacency = buildAdjacency(connections);
  const visited = new Set<string>();
  const stack = [fromNodeId];
  while (stack.length) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of adjacency.get(current) ?? []) {
      if (edge.toNodeId === toNodeId) return true;
      stack.push(edge.toNodeId);
    }
  }
  return false;
}

export function storageKey(
  parts: {
    organizationId: string;
    propertyId: string;
    kind: "original" | "processed" | "thumbnail";
    photoId: string;
    ext: string;
  },
): string {
  const safeExt = parts.ext.replace(/^\./, "").toLowerCase() || "jpg";
  return [
    parts.organizationId,
    parts.propertyId,
    parts.kind,
    `${parts.photoId}.${safeExt}`,
  ].join("/");
}
