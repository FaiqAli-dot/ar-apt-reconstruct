import { PropertyStatus } from "@viewra/types";
import { PropertyModel } from "../models/Property.js";
import { getPublishValidation, loadPropertyGraph } from "./graph.js";
import type { StorageService } from "./storage.js";
import { serializeDoc } from "../utils/serialize.js";
import type { Photo } from "@viewra/types";

export async function publishProperty(propertyId: string) {
  const report = await getPublishValidation(propertyId);
  if (!report) return { ok: false as const, status: 404 as const, report: null };
  if (!report.ready) {
    return { ok: false as const, status: 400 as const, report };
  }

  const property = await PropertyModel.findByIdAndUpdate(
    propertyId,
    {
      $set: {
        status: PropertyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    },
    { new: true },
  );

  return {
    ok: true as const,
    status: 200 as const,
    property: serializeDoc(property),
    report,
  };
}

export async function archiveProperty(propertyId: string) {
  const property = await PropertyModel.findByIdAndUpdate(
    propertyId,
    { $set: { status: PropertyStatus.ARCHIVED } },
    { new: true },
  );
  if (!property) return null;
  return serializeDoc(property);
}

export async function buildPublicTour(
  publicId: string,
  storage: StorageService,
) {
  const property = await PropertyModel.findOne({ publicId });
  if (!property) {
    return { status: 404 as const, body: { message: "Tour not found" } };
  }

  if (
    property.status === PropertyStatus.DRAFT ||
    property.status === PropertyStatus.PROCESSING ||
    property.status === PropertyStatus.READY
  ) {
    return { status: 404 as const, body: { message: "Tour not found" } };
  }

  if (property.status === PropertyStatus.ARCHIVED) {
    return {
      status: 410 as const,
      body: {
        message: "This tour is no longer available",
        status: PropertyStatus.ARCHIVED,
      },
    };
  }

  const graph = await loadPropertyGraph(property._id.toString());
  if (!graph) {
    return { status: 404 as const, body: { message: "Tour not found" } };
  }

  const roomsById = new Map(graph.rooms.map((r) => [r.id, r]));
  const photosByNode = new Map<string, Photo[]>();
  for (const photo of graph.photos) {
    const list = photosByNode.get(photo.nodeId) ?? [];
    list.push(photo);
    photosByNode.set(photo.nodeId, list);
  }

  const nodes = await Promise.all(
    graph.nodes.map(async (node) => {
      const sourcePhotos = (photosByNode.get(node.id) ?? []).filter(
        (p) => p.direction === "CENTER" || p.processingStatus === "READY",
      );
      const photos = await Promise.all(
        sourcePhotos.map(async (p) => ({
          id: p.id,
          direction: p.direction,
          url: await storage.resolveReadUrl(p.processedKey ?? p.originalKey),
          avifUrl: p.avifKey
            ? await storage.resolveReadUrl(p.avifKey)
            : null,
          thumbnailUrl: await storage.resolveReadUrl(p.thumbnailKey),
          width: p.width,
          height: p.height,
        })),
      );

      return {
        id: node.id,
        label: node.label,
        sequence: node.sequence,
        roomId: node.roomId,
        roomName: roomsById.get(node.roomId)?.name,
        approximatePosition: node.approximatePosition,
        photos,
      };
    }),
  );

  return {
    status: 200 as const,
    body: {
      property: {
        id: graph.property.id,
        title: graph.property.title,
        publicId: graph.property.publicId,
        description: graph.property.description,
        address: graph.property.address,
        status: graph.property.status,
        publishedAt: graph.property.publishedAt,
      },
      rooms: graph.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        order: r.order,
      })),
      nodes,
      connections: graph.connections.map((c) => ({
        id: c.id,
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
        direction: c.direction,
        label: c.label,
      })),
    },
  };
}
