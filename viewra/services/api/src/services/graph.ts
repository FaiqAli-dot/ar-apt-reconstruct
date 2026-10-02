import {
  canReach,
  validatePropertyGraph,
  type GraphInput,
} from "@viewra/shared";
import type {
  Connection,
  Node,
  Photo,
  Property,
  PublishValidationReport,
  Room,
} from "@viewra/types";
import { ConnectionModel } from "../models/Connection.js";
import { NodeModel } from "../models/Node.js";
import { PhotoModel } from "../models/Photo.js";
import { PropertyModel } from "../models/Property.js";
import { RoomModel } from "../models/Room.js";
import { serializeDoc, serializeDocs } from "../utils/serialize.js";

export async function loadPropertyGraph(
  propertyId: string,
): Promise<GraphInput | null> {
  const property = await PropertyModel.findById(propertyId);
  if (!property) return null;

  const [rooms, nodes, connections, photos] = await Promise.all([
    RoomModel.find({ propertyId }).sort({ order: 1 }),
    NodeModel.find({ propertyId }).sort({ sequence: 1 }),
    ConnectionModel.find({ propertyId }),
    PhotoModel.find({ propertyId }),
  ]);

  return {
    property: serializeDoc(property)! as Property,
    rooms: serializeDocs(rooms) as Room[],
    nodes: serializeDocs(nodes) as Node[],
    connections: serializeDocs(connections) as Connection[],
    photos: serializeDocs(photos) as Photo[],
  };
}

export async function getPublishValidation(
  propertyId: string,
): Promise<PublishValidationReport | null> {
  const graph = await loadPropertyGraph(propertyId);
  if (!graph) return null;
  return validatePropertyGraph(graph);
}

export function graphCanReach(
  connections: Connection[],
  fromNodeId: string,
  toNodeId: string,
): boolean {
  return canReach(connections, fromNodeId, toNodeId);
}

export async function buildAdminGraphResponse(propertyId: string) {
  const graph = await loadPropertyGraph(propertyId);
  if (!graph) return null;

  const roomsById = new Map(graph.rooms.map((r) => [r.id, r]));
  const photosByNode = new Map<string, Photo[]>();
  for (const photo of graph.photos) {
    const list = photosByNode.get(photo.nodeId) ?? [];
    list.push(photo);
    photosByNode.set(photo.nodeId, list);
  }

  return {
    property: graph.property,
    rooms: graph.rooms,
    nodes: graph.nodes.map((node) => ({
      ...node,
      roomName: roomsById.get(node.roomId)?.name,
      photos: photosByNode.get(node.id) ?? [],
    })),
    connections: graph.connections,
  };
}
