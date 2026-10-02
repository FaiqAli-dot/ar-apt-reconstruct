import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache");
const MINIO_BIN = join(CACHE_DIR, "minio");
const MINIO_PORT = 19000;
const MINIO_CONSOLE_PORT = 19001;

async function downloadMinio(): Promise<string> {
  if (existsSync(MINIO_BIN)) return MINIO_BIN;
  mkdirSync(CACHE_DIR, { recursive: true });

  const platform = process.platform;
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  let url: string;
  if (platform === "linux") {
    url = `https://dl.min.io/server/minio/release/linux-${arch}/minio`;
  } else if (platform === "darwin") {
    url = `https://dl.min.io/server/minio/release/darwin-${arch}/minio`;
  } else {
    throw new Error(`Unsupported platform for MinIO: ${platform}`);
  }

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download MinIO: ${res.status}`);
  }
  const fileStream = createWriteStream(MINIO_BIN);
  // @ts-expect-error Node fetch body is a web stream
  await pipeline(res.body, fileStream);
  chmodSync(MINIO_BIN, 0o755);
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
  const bin = await downloadMinio();
  const dataDir = join(CACHE_DIR, "minio-data");
  mkdirSync(dataDir, { recursive: true });

  const accessKey = "minioadmin";
  const secretKey = "minioadmin";
  const bucket = "viewra-test";
  const endpoint = `http://127.0.0.1:${MINIO_PORT}`;

  const child: ChildProcess = spawn(
    bin,
    ["server", dataDir, "--address", `:${MINIO_PORT}`, "--console-address", `:${MINIO_CONSOLE_PORT}`],
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

  const client = new S3Client({
    region: "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  for (let i = 0; i < 60; i++) {
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
