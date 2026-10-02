import sharp from "sharp";

export type ProcessedImages = {
  processed: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
};

const PROCESSED_MAX = 2560;
const PROCESSED_QUALITY = 82;
const THUMBNAIL_MAX = 480;
const THUMBNAIL_QUALITY = 75;

/**
 * Validate, normalize orientation, and generate processed + thumbnail WebP buffers.
 */
export async function processImage(input: Buffer): Promise<ProcessedImages> {
  // Fail fast if Sharp cannot decode the buffer.
  const probe = sharp(input);
  const meta = await probe.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Unable to read image dimensions");
  }

  // rotate() with no args applies EXIF orientation and resets the tag.
  const processedResult = await sharp(input)
    .rotate()
    .resize({
      width: PROCESSED_MAX,
      height: PROCESSED_MAX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PROCESSED_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const thumbnail = await sharp(input)
    .rotate()
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
    thumbnail,
    width: processedResult.info.width,
    height: processedResult.info.height,
  };
}

/** Exported for tests that need a known-good JPEG buffer. */
export async function createTestJpeg(options?: {
  width?: number;
  height?: number;
}): Promise<Buffer> {
  const width = options?.width ?? 800;
  const height = options?.height ?? 600;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}
