import { spawn } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const minioBin = join(__dirname, "../tests/helpers/.cache/minio");
const dataDir = join(root, ".demo/minio-data");
mkdirSync(dataDir, { recursive: true });
mkdirSync(join(root, ".demo"), { recursive: true });

if (!existsSync(minioBin)) {
  console.error("MinIO binary missing at", minioBin);
  process.exit(1);
}

const mongod = await MongoMemoryServer.create({ instance: { dbName: "viewra" } });
const databaseUrl = mongod.getUri("viewra");
console.log("MongoDB:", databaseUrl);

const minio = spawn(minioBin, ["server", dataDir, "--address", ":9000", "--console-address", ":9001"], {
  env: { ...process.env, MINIO_ROOT_USER: "minioadmin", MINIO_ROOT_PASSWORD: "minioadmin" },
  stdio: ["ignore", "inherit", "inherit"],
});

for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch("http://127.0.0.1:9000/minio/health/live");
    if (res.ok) break;
  } catch {}
  await delay(250);
  if (i === 39) { console.error("MinIO failed"); process.exit(1); }
}

const s3 = new S3Client({
  endpoint: "http://127.0.0.1:9000", region: "us-east-1", forcePathStyle: true,
  credentials: { accessKeyId: "minioadmin", secretAccessKey: "minioadmin" },
});
try { await s3.send(new HeadBucketCommand({ Bucket: "viewra" })); }
catch { await s3.send(new CreateBucketCommand({ Bucket: "viewra" })); }

const env = `DATABASE_URL=${databaseUrl}
DATABASE_NAME=viewra
JWT_SECRET=demo-jwt-secret-at-least-32-characters-long
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=viewra
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=http://127.0.0.1:9000/viewra
API_URL=http://127.0.0.1:3001
API_PORT=3001
API_HOST=0.0.0.0
CORS_ORIGINS=http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:5173,http://localhost:5174
PUBLIC_VIEWER_URL=http://127.0.0.1:5174
VITE_API_URL=http://127.0.0.1:3001
VITE_PUBLIC_VIEWER_URL=http://127.0.0.1:5174
LOG_LEVEL=info
SEED_ADMIN_EMAIL=admin@viewra.local
SEED_ADMIN_PASSWORD=ViewraAdmin123!
SEED_OPERATOR_EMAIL=operator@viewra.local
SEED_OPERATOR_PASSWORD=ViewraOperator123!
`;
writeFileSync(join(root, ".env"), env);
writeFileSync(join(root, ".env.local"), env);
writeFileSync(join(root, "apps/admin/.env"), `VITE_API_URL=http://127.0.0.1:3001\nVITE_PUBLIC_VIEWER_URL=http://127.0.0.1:5174\n`);
writeFileSync(join(root, "apps/viewer/.env"), `VITE_API_URL=http://127.0.0.1:3001\n`);
console.log("Wrote .env files; keeping process alive");

const shutdown = async () => { minio.kill("SIGTERM"); await mongod.stop(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await new Promise(() => {});
