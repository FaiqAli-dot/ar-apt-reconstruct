import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageKey } from "@viewra/shared";
import type { AppConfig } from "../config.js";
import { mimeToExt } from "../utils/crypto.js";

export function createS3Client(config: AppConfig): S3Client {
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

export class StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly config: AppConfig,
  ) {}

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.config.s3Bucket }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.config.s3Bucket }),
      );
    }

    // Allow anonymous read for processed/thumbnail assets (MinIO/R2/S3 public bucket or CDN).
    // Private deployments can ignore policy failures and rely on presigned GET URLs instead.
    try {
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${this.config.s3Bucket}/*`],
          },
        ],
      };
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.config.s3Bucket,
          Policy: JSON.stringify(policy),
        }),
      );
    } catch {
      // Policy may be denied on locked-down cloud buckets — OK.
    }
  }

  async resolveReadUrl(
    key: string | null | undefined,
    expiresIn = 3600,
  ): Promise<string | null> {
    if (!key) return null;
    try {
      return await this.getPresignedGetUrl(key, expiresIn);
    } catch {
      return this.getPublicUrl(key);
    }
  }

  buildOriginalKey(parts: {
    organizationId: string;
    propertyId: string;
    photoId: string;
    mimeType: string;
  }): string {
    return storageKey({
      organizationId: parts.organizationId,
      propertyId: parts.propertyId,
      kind: "original",
      photoId: parts.photoId,
      ext: mimeToExt(parts.mimeType),
    });
  }

  async getPresignedPutUrl(
    key: string,
    mimeType: string,
    expiresIn = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
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

  getPublicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    const base = this.config.s3PublicUrl.replace(/\/$/, "");
    return `${base}/${key}`;
  }

  async getPresignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
