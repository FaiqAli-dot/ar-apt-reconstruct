import { describe, expect, it } from "vitest";
import {
  getCenterPhoto,
  getOutgoingConnections,
  pickStartNode,
  sortNodes,
} from "../lib/tour";
import { tourFixture } from "./fixtures";

describe("tour helpers", () => {
  it("picks the lowest sequence node as start", () => {
    const start = pickStartNode(tourFixture.nodes);
    expect(start?.id).toBe("node-living");
  });

  it("returns only real outgoing connections", () => {
    const fromKitchen = getOutgoingConnections(
      tourFixture.connections,
      "node-kitchen",
    );
    expect(fromKitchen.map((c) => c.toNodeId).sort()).toEqual([
      "node-hall",
      "node-living",
    ]);
    expect(
      getOutgoingConnections(tourFixture.connections, "node-hall"),
    ).toEqual([]);
  });

  it("resolves center photos and missing ones", () => {
    const living = tourFixture.nodes[0];
    const hall = tourFixture.nodes[2];
    expect(getCenterPhoto(living)?.direction).toBe("CENTER");
    expect(getCenterPhoto(hall)).toBeNull();
  });

  it("sorts nodes by sequence", () => {
    const ids = sortNodes([...tourFixture.nodes].reverse()).map((n) => n.id);
    expect(ids).toEqual(["node-living", "node-kitchen", "node-hall"]);
  });
});
