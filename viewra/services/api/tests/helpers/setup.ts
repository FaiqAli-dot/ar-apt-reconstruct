import { MongoMemoryServer } from "mongodb-memory-server";
import type { FastifyInstance } from "fastify";
import { UserRole, UserStatus } from "@viewra/types";
import { buildApp } from "../../src/app.js";
import { loadConfig, type AppConfig } from "../../src/config.js";
import { connectDb, disconnectDb } from "../../src/db.js";
import { OrganizationModel } from "../../src/models/Organization.js";
import { UserModel } from "../../src/models/User.js";
import { hashPassword } from "../../src/services/auth.js";
import { startMinio, type MinioHarness } from "./minio.js";

export type TestContext = {
  app: FastifyInstance;
  config: AppConfig;
  mongo: MongoMemoryServer;
  minio: MinioHarness;
  orgA: { id: string; slug: string };
  orgB: { id: string; slug: string };
  adminA: { id: string; email: string; password: string; token: string };
  operatorA: { id: string; email: string; password: string; token: string };
  adminB: { id: string; email: string; password: string; token: string };
  superAdmin: { id: string; email: string; password: string; token: string };
};

async function createUser(params: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: (typeof UserRole)[keyof typeof UserRole];
  rounds: number;
}) {
  const passwordHash = await hashPassword(params.password, params.rounds);
  const user = await UserModel.create({
    organizationId: params.organizationId,
    name: params.name,
    email: params.email,
    passwordHash,
    role: params.role,
    status: UserStatus.ACTIVE,
  });
  return user;
}

async function login(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Login failed for ${email}: ${res.body}`);
  }
  return res.json().accessToken as string;
}

export async function setupTestContext(): Promise<TestContext> {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("viewra-test");
  const minio = await startMinio();

  const config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: uri,
    JWT_SECRET: "test-secret-key-at-least-32-characters-long",
    JWT_ACCESS_EXPIRES_IN: "1h",
    JWT_REFRESH_EXPIRES_IN: "7d",
    BCRYPT_ROUNDS: "4",
    S3_ENDPOINT: minio.endpoint,
    S3_REGION: minio.region,
    S3_BUCKET: minio.bucket,
    S3_ACCESS_KEY: minio.accessKey,
    S3_SECRET_KEY: minio.secretKey,
    S3_FORCE_PATH_STYLE: "true",
    S3_PUBLIC_URL: minio.publicUrl,
    RATE_LIMIT_MAX: "10000",
    LOG_LEVEL: "silent",
  });

  await connectDb(uri);
  const app = await buildApp({ config, logger: false });
  await app.ready();
  await app.storage.ensureBucket();

  const orgA = await OrganizationModel.create({
    name: "Org A",
    slug: "org-a",
    settings: {},
  });
  const orgB = await OrganizationModel.create({
    name: "Org B",
    slug: "org-b",
    settings: {},
  });
  const platform = await OrganizationModel.create({
    name: "Platform",
    slug: "platform",
    settings: {},
  });

  const adminAUser = await createUser({
    organizationId: orgA._id.toString(),
    name: "Admin A",
    email: "admin-a@test.local",
    password: "Password123!",
    role: UserRole.ADMIN,
    rounds: config.bcryptRounds,
  });
  const operatorAUser = await createUser({
    organizationId: orgA._id.toString(),
    name: "Operator A",
    email: "operator-a@test.local",
    password: "Password123!",
    role: UserRole.CAPTURE_OPERATOR,
    rounds: config.bcryptRounds,
  });
  const adminBUser = await createUser({
    organizationId: orgB._id.toString(),
    name: "Admin B",
    email: "admin-b@test.local",
    password: "Password123!",
    role: UserRole.ADMIN,
    rounds: config.bcryptRounds,
  });
  const superUser = await createUser({
    organizationId: platform._id.toString(),
    name: "Super Admin",
    email: "super@test.local",
    password: "Password123!",
    role: UserRole.SUPER_ADMIN,
    rounds: config.bcryptRounds,
  });

  const [tokenA, tokenOp, tokenB, tokenSuper] = await Promise.all([
    login(app, "admin-a@test.local", "Password123!"),
    login(app, "operator-a@test.local", "Password123!"),
    login(app, "admin-b@test.local", "Password123!"),
    login(app, "super@test.local", "Password123!"),
  ]);

  return {
    app,
    config,
    mongo,
    minio,
    orgA: { id: orgA._id.toString(), slug: "org-a" },
    orgB: { id: orgB._id.toString(), slug: "org-b" },
    adminA: {
      id: adminAUser._id.toString(),
      email: "admin-a@test.local",
      password: "Password123!",
      token: tokenA,
    },
    operatorA: {
      id: operatorAUser._id.toString(),
      email: "operator-a@test.local",
      password: "Password123!",
      token: tokenOp,
    },
    adminB: {
      id: adminBUser._id.toString(),
      email: "admin-b@test.local",
      password: "Password123!",
      token: tokenB,
    },
    superAdmin: {
      id: superUser._id.toString(),
      email: "super@test.local",
      password: "Password123!",
      token: tokenSuper,
    },
  };
}

export async function teardownTestContext(ctx: TestContext): Promise<void> {
  await ctx.app.close();
  await disconnectDb();
  await ctx.mongo.stop();
  await ctx.minio.stop();
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
