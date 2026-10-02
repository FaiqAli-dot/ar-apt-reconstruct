import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { WorkerConfig } from "./config.js";

export function createS3Client(config: WorkerConfig): S3Client {
  return new S3Client({
    region: config.s3Region,
    endpoint: config.s3Endpoint,
    forcePathStyle: config.s3ForcePathStyle,
    credentials: {
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3SecretKey,
    },
  });
}

/** Derive processed/thumbnail object keys from an original key path. */
export function deriveVariantKeys(originalKey: string): {
  processedKey: string;
  thumbnailKey: string;
} {
  if (!originalKey.includes("/original/")) {
    throw new Error(`Invalid original key (missing /original/): ${originalKey}`);
  }

  const replaceKind = (kind: "processed" | "thumbnail") => {
    const withKind = originalKey.replace("/original/", `/${kind}/`);
    const lastSlash = withKind.lastIndexOf("/");
    const dir = withKind.slice(0, lastSlash + 1);
    const filename = withKind.slice(lastSlash + 1);
    const base = filename.includes(".")
      ? filename.slice(0, filename.lastIndexOf("."))
      : filename;
    return `${dir}${base}.webp`;
  };

  return {
    processedKey: replaceKind("processed"),
    thumbnailKey: replaceKind("thumbnail"),
  };
}

export class StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly config: WorkerConfig,
  ) {}

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
      }),
    );
    if (!response.Body) {
      throw new Error(`Empty object body for key: ${key}`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array,
    mimeType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.s3Bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
