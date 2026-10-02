import { generatePublicId, slugify } from "@viewra/shared";
import {
  ConnectionDirection,
  NodeStatus,
  ProcessingStatus,
  PropertyStatus,
  RoomType,
  UserRole,
  UserStatus,
} from "@viewra/types";
import { loadConfig } from "./config.js";
import { connectDb, disconnectDb } from "./db.js";
import {
  ConnectionModel,
  NodeModel,
  OrganizationModel,
  PhotoModel,
  PropertyModel,
  RoomModel,
  UserModel,
} from "./models/index.js";
import { hashPassword } from "./services/auth.js";
import { createS3Client, StorageService } from "./services/storage.js";

type RoomDef = { name: string; type: (typeof RoomType)[keyof typeof RoomType] };

const DEMO_ROOMS: RoomDef[] = [
  { name: "Entrance", type: RoomType.ENTRANCE },
  { name: "Hall", type: RoomType.HALLWAY },
  { name: "Living Room", type: RoomType.LIVING_ROOM },
  { name: "Kitchen", type: RoomType.KITCHEN },
  { name: "Bathroom", type: RoomType.BATHROOM },
  { name: "Master Bedroom", type: RoomType.BEDROOM },
  { name: "Balcony", type: RoomType.BALCONY },
];

async function ensureReadyPhotos(
  storage: StorageService | null,
  params: {
    organizationId: string;
    propertyId: string;
    nodeId: string;
  },
) {
  for (const direction of ["LEFT", "CENTER", "RIGHT"] as const) {
    const existing = await PhotoModel.findOne({
      nodeId: params.nodeId,
      direction,
    });
    if (existing) continue;

    const photo = await PhotoModel.create({
      nodeId: params.nodeId,
      propertyId: params.propertyId,
      direction,
      mimeType: "image/jpeg",
      fileSize: 1024,
      width: 1600,
      height: 1200,
      processingStatus: ProcessingStatus.READY,
      retryCount: 0,
    });

    const base = `${params.organizationId}/${params.propertyId}`;
    const originalKey = `${base}/original/${photo._id}.jpg`;
    const processedKey = `${base}/processed/${photo._id}.jpg`;
    const thumbnailKey = `${base}/thumbnail/${photo._id}.jpg`;

    photo.originalKey = originalKey;
    photo.processedKey = processedKey;
    photo.thumbnailKey = thumbnailKey;
    await photo.save();

    if (storage) {
      // Minimal JPEG (1x1) — placeholder; worker may replace later
      const jpeg = Buffer.from(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
        "base64",
      );
      try {
        await storage.putObject(originalKey, jpeg, "image/jpeg");
        await storage.putObject(processedKey, jpeg, "image/jpeg");
        await storage.putObject(thumbnailKey, jpeg, "image/jpeg");
      } catch {
        // S3 optional during seed
      }
    }
  }
}

async function seed() {
  const config = loadConfig();
  await connectDb(config.databaseUrl);

  let storage: StorageService | null = null;
  try {
    storage = new StorageService(createS3Client(config), config);
    await storage.ensureBucket();
  } catch (err) {
    console.warn("S3 unavailable during seed; using placeholder keys only", err);
    storage = null;
  }

  let org = await OrganizationModel.findOne({ slug: "viewra-demo" });
  if (!org) {
    org = await OrganizationModel.create({
      name: "Viewra Demo",
      slug: "viewra-demo",
      settings: {},
    });
    console.log("Created organization Viewra Demo");
  }

  const adminHash = await hashPassword(
    config.seedAdminPassword,
    config.bcryptRounds,
  );
  let admin = await UserModel.findOne({ email: config.seedAdminEmail });
  if (!admin) {
    admin = await UserModel.create({
      organizationId: org._id,
      name: "Viewra Admin",
      email: config.seedAdminEmail,
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    console.log(`Created admin ${config.seedAdminEmail}`);
  }

  const operatorHash = await hashPassword(
    config.seedOperatorPassword,
    config.bcryptRounds,
  );
  let operator = await UserModel.findOne({ email: config.seedOperatorEmail });
  if (!operator) {
    operator = await UserModel.create({
      organizationId: org._id,
      name: "Capture Operator",
      email: config.seedOperatorEmail,
      passwordHash: operatorHash,
      role: UserRole.CAPTURE_OPERATOR,
      status: UserStatus.ACTIVE,
    });
    console.log(`Created operator ${config.seedOperatorEmail}`);
  }

  let property = await PropertyModel.findOne({
    organizationId: org._id,
    slug: "demo-apartment",
  });
  if (!property) {
    property = await PropertyModel.create({
      organizationId: org._id,
      title: "Demo Apartment",
      slug: slugify("Demo Apartment"),
      publicId: generatePublicId(),
      description:
        "A fully connected demo apartment with entrance, hall branching, and balcony.",
      address: {
        line1: "12 Harbor View",
        city: "Lisbon",
        country: "PT",
      },
      status: PropertyStatus.READY,
    });
    console.log("Created Demo Apartment property");
  }

  const roomsByName = new Map<string, string>();
  for (const [index, def] of DEMO_ROOMS.entries()) {
    let room = await RoomModel.findOne({
      propertyId: property._id,
      name: def.name,
    });
    if (!room) {
      room = await RoomModel.create({
        propertyId: property._id,
        name: def.name,
        type: def.type,
        order: index,
      });
    }
    roomsByName.set(def.name, room._id.toString());
  }

  // Primary walkthrough: Entrance → Hall → branches → Balcony
  const primaryNodes: Array<{ label: string; room: string; sequence: number }> =
    [
      { label: "Entrance", room: "Entrance", sequence: 0 },
      { label: "Hall Hub", room: "Hall", sequence: 1 },
      { label: "Living Room", room: "Living Room", sequence: 2 },
      { label: "Kitchen", room: "Kitchen", sequence: 3 },
      { label: "Bathroom", room: "Bathroom", sequence: 4 },
      { label: "Master Bedroom", room: "Master Bedroom", sequence: 5 },
      { label: "Balcony", room: "Balcony", sequence: 6 },
    ];

  const nodeIds = new Map<string, string>();
  for (const def of primaryNodes) {
    let node = await NodeModel.findOne({
      propertyId: property._id,
      label: def.label,
    });
    if (!node) {
      node = await NodeModel.create({
        propertyId: property._id,
        roomId: roomsByName.get(def.room)!,
        label: def.label,
        sequence: def.sequence,
        approximatePosition: { x: def.sequence * 10, y: 0 },
        status: NodeStatus.READY,
        captureMetadata: { operatorId: operator!._id },
      });
    }
    nodeIds.set(def.label, node._id.toString());
    await ensureReadyPhotos(storage, {
      organizationId: org._id.toString(),
      propertyId: property._id.toString(),
      nodeId: node._id.toString(),
    });
  }

  // Acceptance branch pattern in Hall: N1→N2; N2→N3→N4→N5→N2 and N2→N6→N7→N8→N2
  const branchDefs = [
    { label: "N1", room: "Hall", sequence: 10 },
    { label: "N2", room: "Hall", sequence: 11 },
    { label: "N3", room: "Hall", sequence: 12 },
    { label: "N4", room: "Hall", sequence: 13 },
    { label: "N5", room: "Hall", sequence: 14 },
    { label: "N6", room: "Hall", sequence: 15 },
    { label: "N7", room: "Hall", sequence: 16 },
    { label: "N8", room: "Hall", sequence: 17 },
  ];
  for (const def of branchDefs) {
    let node = await NodeModel.findOne({
      propertyId: property._id,
      label: def.label,
    });
    if (!node) {
      node = await NodeModel.create({
        propertyId: property._id,
        roomId: roomsByName.get(def.room)!,
        label: def.label,
        sequence: def.sequence,
        approximatePosition: { x: (def.sequence - 10) * 5, y: 20 },
        status: NodeStatus.READY,
      });
    }
    nodeIds.set(def.label, node._id.toString());
    await ensureReadyPhotos(storage, {
      organizationId: org._id.toString(),
      propertyId: property._id.toString(),
      nodeId: node._id.toString(),
    });
  }

  const edges: Array<[string, string, string]> = [
    ["Entrance", "Hall Hub", ConnectionDirection.FORWARD],
    ["Hall Hub", "Living Room", ConnectionDirection.LEFT],
    ["Hall Hub", "Kitchen", ConnectionDirection.FORWARD],
    ["Hall Hub", "Bathroom", ConnectionDirection.RIGHT],
    ["Hall Hub", "Master Bedroom", ConnectionDirection.CUSTOM],
    ["Master Bedroom", "Balcony", ConnectionDirection.FORWARD],
    // Acceptance graph
    ["N1", "N2", ConnectionDirection.FORWARD],
    ["N2", "N3", ConnectionDirection.LEFT],
    ["N3", "N4", ConnectionDirection.FORWARD],
    ["N4", "N5", ConnectionDirection.FORWARD],
    ["N5", "N2", ConnectionDirection.BACK],
    ["N2", "N6", ConnectionDirection.RIGHT],
    ["N6", "N7", ConnectionDirection.FORWARD],
    ["N7", "N8", ConnectionDirection.FORWARD],
    ["N8", "N2", ConnectionDirection.BACK],
  ];

  for (const [from, to, direction] of edges) {
    const fromId = nodeIds.get(from)!;
    const toId = nodeIds.get(to)!;
    const exists = await ConnectionModel.findOne({
      propertyId: property._id,
      fromNodeId: fromId,
      toNodeId: toId,
    });
    if (!exists) {
      await ConnectionModel.create({
        propertyId: property._id,
        fromNodeId: fromId,
        toNodeId: toId,
        direction,
      });
    }
  }

  console.log("Seed complete");
  console.log(`  Org: ${org.name} (${org._id})`);
  console.log(`  Admin: ${config.seedAdminEmail}`);
  console.log(`  Operator: ${config.seedOperatorEmail}`);
  console.log(`  Property: ${property.title} publicId=${property.publicId}`);

  await disconnectDb();
}

seed().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
