import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authHeader,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./helpers/setup.js";
import { ProcessingStatus, PropertyStatus } from "@viewra/types";
import { canReach } from "@viewra/shared";
import { PhotoModel } from "../src/models/Photo.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestContext();
}, 180_000);

afterAll(async () => {
  if (ctx) await teardownTestContext(ctx);
});

describe("health", () => {
  it("returns ok", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });
});

describe("auth", () => {
  it("logs in, refreshes, and returns me", async () => {
    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ctx.adminA.email, password: ctx.adminA.password },
    });
    expect(login.statusCode).toBe(200);
    const body = login.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe(ctx.adminA.email);

    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader(body.accessToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.id).toBe(ctx.adminA.id);

    const refresh = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: body.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json().accessToken).toBeTruthy();

    const logout = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      payload: { refreshToken: refresh.json().refreshToken },
    });
    expect(logout.statusCode).toBe(204);
  });

  it("rejects invalid credentials", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ctx.adminA.email, password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("organizations and users", () => {
  it("allows SUPER_ADMIN to create organizations", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: authHeader(ctx.superAdmin.token),
      payload: { name: "New Org", slug: "new-org" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe("new-org");
  });

  it("blocks ADMIN from creating organizations", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: authHeader(ctx.adminA.token),
      payload: { name: "Nope", slug: "nope" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows ADMIN to create users in own org", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/users",
      headers: authHeader(ctx.adminA.token),
      payload: {
        organizationId: ctx.orgA.id,
        name: "New Op",
        email: "new-op@test.local",
        password: "Password123!",
        role: "CAPTURE_OPERATOR",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().organizationId).toBe(ctx.orgA.id);
  });

  it("blocks ADMIN from creating users in another org", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/users",
      headers: authHeader(ctx.adminA.token),
      payload: {
        organizationId: ctx.orgB.id,
        name: "Cross",
        email: "cross@test.local",
        password: "Password123!",
        role: "CAPTURE_OPERATOR",
      },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("multi-tenant isolation", () => {
  it("prevents org B from accessing org A property by id", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/api/properties",
      headers: authHeader(ctx.adminA.token),
      payload: { title: "Secret A", slug: "secret-a" },
    });
    expect(create.statusCode).toBe(201);
    const propertyId = create.json().id as string;

    const sneak = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}`,
      headers: authHeader(ctx.adminB.token),
    });
    expect(sneak.statusCode).toBe(404);

    const sneakRooms = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/rooms`,
      headers: authHeader(ctx.adminB.token),
    });
    expect(sneakRooms.statusCode).toBe(404);
  });
});

describe("property rooms nodes CRUD", () => {
  it("creates property, rooms, and nodes", async () => {
    const propertyRes = await ctx.app.inject({
      method: "POST",
      url: "/api/properties",
      headers: authHeader(ctx.adminA.token),
      payload: { title: "CRUD Home", slug: "crud-home" },
    });
    expect(propertyRes.statusCode).toBe(201);
    const property = propertyRes.json();
    expect(property.publicId).toBeTruthy();
    const publicId = property.publicId;

    const patch = await ctx.app.inject({
      method: "PATCH",
      url: `/api/properties/${property.id}`,
      headers: authHeader(ctx.adminA.token),
      payload: { title: "CRUD Home Updated", description: "desc" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().publicId).toBe(publicId);
    expect(patch.json().title).toBe("CRUD Home Updated");

    const roomRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${property.id}/rooms`,
      headers: authHeader(ctx.adminA.token),
      payload: { name: "Living", type: "LIVING_ROOM" },
    });
    expect(roomRes.statusCode).toBe(201);
    const room = roomRes.json();

    const nodeRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${property.id}/nodes`,
      headers: authHeader(ctx.adminA.token),
      payload: { roomId: room.id, label: "Living Center" },
    });
    expect(nodeRes.statusCode).toBe(201);
    expect(nodeRes.json().label).toBe("Living Center");

    const listNodes = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${property.id}/nodes`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(listNodes.json().items).toHaveLength(1);

    const bySlug = await ctx.app.inject({
      method: "GET",
      url: "/api/properties/crud-home",
      headers: authHeader(ctx.adminA.token),
    });
    expect(bySlug.statusCode).toBe(200);
    expect(bySlug.json().id).toBe(property.id);

    const graphBySlug = await ctx.app.inject({
      method: "GET",
      url: "/api/properties/crud-home/graph",
      headers: authHeader(ctx.adminA.token),
    });
    expect(graphBySlug.statusCode).toBe(200);
    expect(graphBySlug.json().nodes).toHaveLength(1);
  });
});

async function makeReadyPhotos(nodeId: string, propertyId: string) {
  for (const direction of ["LEFT", "CENTER", "RIGHT"] as const) {
    await PhotoModel.create({
      nodeId,
      propertyId,
      direction,
      originalKey: `o/${nodeId}-${direction}.jpg`,
      processedKey: `p/${nodeId}-${direction}.jpg`,
      thumbnailKey: `t/${nodeId}-${direction}.jpg`,
      width: 100,
      height: 100,
      mimeType: "image/jpeg",
      fileSize: 100,
      processingStatus: ProcessingStatus.READY,
    });
  }
}

describe("graph scenarios", () => {
  it("supports linear, branch, dead end, loop, connect existing, and cleanup", async () => {
    const propertyRes = await ctx.app.inject({
      method: "POST",
      url: "/api/properties",
      headers: authHeader(ctx.adminA.token),
      payload: { title: "Graph Lab", slug: "graph-lab" },
    });
    const propertyId = propertyRes.json().id as string;

    const roomRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/rooms`,
      headers: authHeader(ctx.adminA.token),
      payload: { name: "Hall", type: "HALLWAY" },
    });
    const roomId = roomRes.json().id as string;

    const createNode = async (label: string, connectFromNodeId?: string) => {
      const res = await ctx.app.inject({
        method: "POST",
        url: `/api/properties/${propertyId}/nodes`,
        headers: authHeader(ctx.adminA.token),
        payload: {
          roomId,
          label,
          ...(connectFromNodeId ? { connectFromNodeId } : {}),
        },
      });
      expect(res.statusCode).toBe(201);
      return res.json().id as string;
    };

    // Linear: A → B → C
    const a = await createNode("A");
    const b = await createNode("B", a);
    const c = await createNode("C", b);

    // Branch from B to D (dead end)
    const d = await createNode("D", b);

    // Loop: C → A
    const loop = await ctx.app.inject({
      method: "POST",
      url: "/api/connections",
      headers: authHeader(ctx.adminA.token),
      payload: {
        propertyId,
        fromNodeId: c,
        toNodeId: a,
        direction: "BACK",
        bidirectional: false,
      },
    });
    expect(loop.statusCode).toBe(201);

    // Connect existing bidirectional B ↔ D already has B→D; add reverse via API
    const reverse = await ctx.app.inject({
      method: "POST",
      url: "/api/connections",
      headers: authHeader(ctx.adminA.token),
      payload: {
        propertyId,
        fromNodeId: d,
        toNodeId: b,
        direction: "BACK",
      },
    });
    expect(reverse.statusCode).toBe(201);

    const connectionsRes = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/connections`,
      headers: authHeader(ctx.adminA.token),
    });
    const connections = connectionsRes.json().items;
    expect(canReach(connections, a, c)).toBe(true);
    expect(canReach(connections, a, d)).toBe(true);
    expect(canReach(connections, c, a)).toBe(true);

    // Multiple rooms
    const room2 = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/rooms`,
      headers: authHeader(ctx.adminA.token),
      payload: { name: "Kitchen", type: "KITCHEN" },
    });
    const e = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/nodes`,
      headers: authHeader(ctx.adminA.token),
      payload: {
        roomId: room2.json().id,
        label: "E",
        connectFromNodeId: b,
      },
    });
    expect(e.statusCode).toBe(201);

    // Deleted-node cleanup
    await makeReadyPhotos(d, propertyId);
    const del = await ctx.app.inject({
      method: "DELETE",
      url: `/api/nodes/${d}`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(del.statusCode).toBe(204);

    const after = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/connections`,
      headers: authHeader(ctx.adminA.token),
    });
    const remaining = after.json().items as Array<{
      fromNodeId: string;
      toNodeId: string;
    }>;
    expect(
      remaining.every((c) => c.fromNodeId !== d && c.toNodeId !== d),
    ).toBe(true);

    const photosLeft = await PhotoModel.countDocuments({ nodeId: d });
    expect(photosLeft).toBe(0);

    const graph = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/graph`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(graph.statusCode).toBe(200);
    expect(graph.json().nodes.some((n: { id: string }) => n.id === d)).toBe(
      false,
    );
  });

  it("builds the acceptance branch graph and verifies canReach", async () => {
    const propertyRes = await ctx.app.inject({
      method: "POST",
      url: "/api/properties",
      headers: authHeader(ctx.adminA.token),
      payload: { title: "Acceptance", slug: "acceptance-graph" },
    });
    const propertyId = propertyRes.json().id as string;
    const roomRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/rooms`,
      headers: authHeader(ctx.adminA.token),
      payload: { name: "Hall", type: "HALLWAY" },
    });
    const roomId = roomRes.json().id as string;

    const ids: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const res = await ctx.app.inject({
        method: "POST",
        url: `/api/properties/${propertyId}/nodes`,
        headers: authHeader(ctx.adminA.token),
        payload: { roomId, label: `N${i}` },
      });
      ids.push(res.json().id);
      await makeReadyPhotos(res.json().id, propertyId);
    }
    const [n1, n2, n3, n4, n5, n6, n7, n8] = ids;

    const edges: Array<[string, string]> = [
      [n1!, n2!],
      [n2!, n3!],
      [n3!, n4!],
      [n4!, n5!],
      [n5!, n2!],
      [n2!, n6!],
      [n6!, n7!],
      [n7!, n8!],
      [n8!, n2!],
    ];
    for (const [from, to] of edges) {
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/connections",
        headers: authHeader(ctx.adminA.token),
        payload: { propertyId, fromNodeId: from, toNodeId: to },
      });
      expect(res.statusCode).toBe(201);
    }

    const connectionsRes = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/connections`,
      headers: authHeader(ctx.adminA.token),
    });
    const connections = connectionsRes.json().items;
    expect(canReach(connections, n2!, n3!)).toBe(true);
    expect(canReach(connections, n2!, n6!)).toBe(true);
    expect(canReach(connections, n8!, n2!)).toBe(true);
    expect(canReach(connections, n1!, n8!)).toBe(true);
    expect(canReach(connections, n5!, n6!)).toBe(true);

    const graph = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/graph`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(graph.statusCode).toBe(200);
    expect(graph.json().nodes).toHaveLength(8);
    expect(graph.json().connections).toHaveLength(9);
  });
});

describe("upload workflow with MinIO", () => {
  it("presigns, uploads, and completes", async () => {
    const propertyRes = await ctx.app.inject({
      method: "POST",
      url: "/api/properties",
      headers: authHeader(ctx.adminA.token),
      payload: { title: "Upload Prop", slug: "upload-prop" },
    });
    const propertyId = propertyRes.json().id as string;
    const roomRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/rooms`,
      headers: authHeader(ctx.adminA.token),
      payload: { name: "Room", type: "OTHER" },
    });
    const nodeRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/nodes`,
      headers: authHeader(ctx.adminA.token),
      payload: { roomId: roomRes.json().id, label: "Shot" },
    });
    const nodeId = nodeRes.json().id as string;

    const uploadReq = await ctx.app.inject({
      method: "POST",
      url: `/api/nodes/${nodeId}/photos/upload`,
      headers: authHeader(ctx.operatorA.token),
      payload: {
        direction: "CENTER",
        mimeType: "image/jpeg",
        fileSize: 128,
        originalFilename: "center.jpg",
      },
    });
    expect(uploadReq.statusCode).toBe(200);
    const { photoId, uploadUrl, key } = uploadReq.json();
    expect(uploadUrl).toContain("http");
    expect(key).toContain(propertyId);
    expect(key).toContain(photoId);

    const jpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
      "base64",
    );
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: jpeg,
    });
    expect(put.ok).toBe(true);

    const complete = await ctx.app.inject({
      method: "POST",
      url: `/api/photos/${photoId}/complete-upload`,
      headers: authHeader(ctx.operatorA.token),
      payload: { width: 1, height: 1 },
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().processingStatus).toBe(ProcessingStatus.QUEUED);
  });
});

describe("publish validation and public tours", () => {
  it("fails publish when incomplete, succeeds when ready, enforces public rules", async () => {
    const propertyRes = await ctx.app.inject({
      method: "POST",
      url: "/api/properties",
      headers: authHeader(ctx.adminA.token),
      payload: { title: "Publish Me", slug: "publish-me" },
    });
    const property = propertyRes.json();
    const propertyId = property.id as string;
    const publicId = property.publicId as string;

    const fail = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/publish`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(fail.statusCode).toBe(400);
    expect(fail.json().report.ready).toBe(false);

    const unpublished = await ctx.app.inject({
      method: "GET",
      url: `/api/tours/${publicId}`,
    });
    expect(unpublished.statusCode).toBe(404);

    const roomRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/rooms`,
      headers: authHeader(ctx.adminA.token),
      payload: { name: "Only", type: "OTHER" },
    });
    const nodeRes = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/nodes`,
      headers: authHeader(ctx.adminA.token),
      payload: { roomId: roomRes.json().id, label: "Only Node" },
    });
    await makeReadyPhotos(nodeRes.json().id, propertyId);

    const validation = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/publish-validation`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(validation.json().ready).toBe(true);

    const publish = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/publish`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().property.status).toBe(PropertyStatus.PUBLISHED);
    expect(publish.json().property.publicId).toBe(publicId);

    const tour = await ctx.app.inject({
      method: "GET",
      url: `/api/tours/${publicId}`,
    });
    expect(tour.statusCode).toBe(200);
    expect(tour.json().property.publicId).toBe(publicId);
    expect(tour.json().nodes[0].photos.length).toBeGreaterThan(0);

    const nodeTour = await ctx.app.inject({
      method: "GET",
      url: `/api/tours/${publicId}/nodes/${nodeRes.json().id}`,
    });
    expect(nodeTour.statusCode).toBe(200);

    const track = await ctx.app.inject({
      method: "POST",
      url: `/api/tours/${publicId}/analytics`,
      payload: {
        type: "TOUR_VIEW",
        sessionId: "s1",
        visitorId: "v1",
      },
    });
    expect(track.statusCode).toBe(204);

    // Operator cannot publish
    const opPublish = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/publish`,
      headers: authHeader(ctx.operatorA.token),
    });
    expect(opPublish.statusCode).toBe(403);

    const archive = await ctx.app.inject({
      method: "POST",
      url: `/api/properties/${propertyId}/archive`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(archive.statusCode).toBe(200);
    expect(archive.json().status).toBe(PropertyStatus.ARCHIVED);

    const gone = await ctx.app.inject({
      method: "GET",
      url: `/api/tours/${publicId}`,
    });
    expect(gone.statusCode).toBe(410);
    expect(gone.json().message).toMatch(/no longer available/i);
  });
});

describe("authorization roles", () => {
  it("restricts capture operator from admin analytics", async () => {
    const propertyRes = await ctx.app.inject({
      method: "POST",
      url: "/api/properties",
      headers: authHeader(ctx.adminA.token),
      payload: { title: "Authz", slug: "authz-prop" },
    });
    const propertyId = propertyRes.json().id as string;

    const analytics = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/analytics`,
      headers: authHeader(ctx.operatorA.token),
    });
    expect(analytics.statusCode).toBe(403);

    const adminOk = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/analytics`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(adminOk.statusCode).toBe(200);

    const stats = await ctx.app.inject({
      method: "GET",
      url: "/api/dashboard/stats",
      headers: authHeader(ctx.adminA.token),
    });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().properties.total).toBeGreaterThan(0);

    const qr = await ctx.app.inject({
      method: "GET",
      url: `/api/properties/${propertyId}/qr`,
      headers: authHeader(ctx.adminA.token),
    });
    expect(qr.statusCode).toBe(200);
    expect(qr.json().url).toContain(propertyRes.json().publicId);
  });
});
