import sharp from "sharp";

export type ProcessedImages = {
  processed: Buffer;
  processedAvif: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
};

const PROCESSED_MAX = 2560;
const PROCESSED_QUALITY = 82;
const AVIF_QUALITY = 55;
const THUMBNAIL_MAX = 480;
const THUMBNAIL_QUALITY = 75;

/**
 * Validate, normalize orientation, and generate processed WebP + AVIF + thumbnail.
 */
export async function processImage(input: Buffer): Promise<ProcessedImages> {
  const probe = sharp(input);
  const meta = await probe.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Unable to read image dimensions");
  }

  const oriented = sharp(input).rotate();

  const processedResult = await oriented
    .clone()
    .resize({
      width: PROCESSED_MAX,
      height: PROCESSED_MAX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PROCESSED_QUALITY })
    .toBuffer({ resolveWithObject: true });

  let processedAvif: Buffer;
  try {
    processedAvif = await oriented
      .clone()
      .resize({
        width: PROCESSED_MAX,
        height: PROCESSED_MAX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .avif({ quality: AVIF_QUALITY })
      .toBuffer();
  } catch {
    processedAvif = processedResult.data;
  }

  const thumbnail = await oriented
    .clone()
    .resize({
      width: THUMBNAIL_MAX,
      height: THUMBNAIL_MAX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return {
    processed: processedResult.data,
    processedAvif,
    thumbnail,
    width: processedResult.info.width,
    height: processedResult.info.height,
  };
}

/** Exported for tests that need a known-good JPEG buffer. */
export async function createTestJpeg(options?: {
  width?: number;
  height?: number;
  background?: { r: number; g: number; b: number };
}): Promise<Buffer> {
  const width = options?.width ?? 800;
  const height = options?.height ?? 600;
  const background = options?.background ?? { r: 40, g: 120, b: 200 };
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background,
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}
