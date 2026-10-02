import type { TourConnection, TourNode, TourPhoto } from "../api/types";

export function sortNodes(nodes: TourNode[]): TourNode[] {
  return [...nodes].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.label.localeCompare(b.label);
  });
}

export function pickStartNode(nodes: TourNode[]): TourNode | null {
  const n1 = nodes.find((node) => node.label === "N1");
  if (n1) return n1;
  const entrance = nodes.find(
    (node) =>
      node.label.toLowerCase() === "entrance" ||
      node.roomName?.toLowerCase() === "entrance",
  );
  if (entrance) return entrance;
  const sorted = sortNodes(nodes);
  return sorted[0] ?? null;
}

export function getCenterPhoto(node: TourNode | null | undefined): TourPhoto | null {
  if (!node) return null;
  return (
    node.photos.find((photo) => photo.direction === "CENTER") ??
    node.photos[0] ??
    null
  );
}

export function getOutgoingConnections(
  connections: TourConnection[],
  nodeId: string,
): TourConnection[] {
  return connections.filter((connection) => connection.fromNodeId === nodeId);
}

export function displayLabel(node: TourNode): string {
  return node.roomName?.trim() || node.label?.trim() || "Untitled space";
}

export function normalizeMapPositions(nodes: TourNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const xs = nodes.map((n) => n.approximatePosition?.x ?? 0);
  const ys = nodes.map((n) => n.approximatePosition?.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  for (const node of nodes) {
    const x = node.approximatePosition?.x ?? 0;
    const y = node.approximatePosition?.y ?? 0;
    positions.set(node.id, {
      x: ((x - minX) / rangeX) * 80 + 10,
      y: ((y - minY) / rangeY) * 80 + 10,
    });
  }

  return positions;
}
