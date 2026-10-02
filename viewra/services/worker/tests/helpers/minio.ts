import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache");
const MINIO_BIN = join(CACHE_DIR, "minio");
// Use a different port than the API test harness to allow parallel runs.
const MINIO_PORT = 19100;
const MINIO_CONSOLE_PORT = 19101;
const MINIO_GO_MODULE =
  "github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z";

async function ensureMinioBinary(): Promise<string> {
  if (existsSync(MINIO_BIN)) return MINIO_BIN;
  mkdirSync(CACHE_DIR, { recursive: true });

  // Prefer go install — MinIO no longer publishes stable binary CDN assets.
  await execFileAsync("go", ["install", "-v", MINIO_GO_MODULE], {
    env: {
      ...process.env,
      GOBIN: CACHE_DIR,
    },
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (!existsSync(MINIO_BIN)) {
    throw new Error(`MinIO binary not found at ${MINIO_BIN} after go install`);
  }
  return MINIO_BIN;
}

export type MinioHarness = {
  endpoint: string;
  publicUrl: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  stop: () => Promise<void>;
};

export async function startMinio(): Promise<MinioHarness> {
  const bin = await ensureMinioBinary();
  const dataDir = join(CACHE_DIR, "minio-data");
  mkdirSync(dataDir, { recursive: true });

  const accessKey = "minioadmin";
  const secretKey = "minioadmin";
  const bucket = "viewra-worker-test";
  const endpoint = `http://127.0.0.1:${MINIO_PORT}`;

  const child: ChildProcess = spawn(
    bin,
    [
      "server",
      dataDir,
      "--address",
      `:${MINIO_PORT}`,
      "--console-address",
      `:${MINIO_CONSOLE_PORT}`,
    ],
    {
      env: {
        ...process.env,
        MINIO_ROOT_USER: accessKey,
        MINIO_ROOT_PASSWORD: secretKey,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let ready = false;
  const onData = (buf: Buffer) => {
    const text = buf.toString();
    if (text.includes("API:") || text.includes("Ready")) ready = true;
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  child.on("exit", (code) => {
    if (!ready) {
      console.error(`MinIO exited early with code ${code}`);
    }
  });

  const client = new S3Client({
    region: "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  for (let i = 0; i < 80; i++) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      ready = true;
      break;
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        ready = true;
        break;
      } catch {
        await delay(250);
      }
    }
  }

  if (!ready) {
    child.kill("SIGKILL");
    throw new Error("MinIO failed to start");
  }

  return {
    endpoint,
    publicUrl: `${endpoint}/${bucket}`,
    accessKey,
    secretKey,
    bucket,
    region: "us-east-1",
    stop: async () => {
      if (!child.killed) {
        child.kill("SIGTERM");
        await delay(300);
        if (!child.killed) child.kill("SIGKILL");
      }
      client.destroy();
    },
  };
}
