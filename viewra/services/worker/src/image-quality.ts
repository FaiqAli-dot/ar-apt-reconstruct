import sharp from "sharp";

export type ImageQualityMetrics = {
  meanLuminance: number;
  laplacianVariance: number;
  perceptualHash: string;
};

export type QualityWarningCode =
  | "DARK_IMAGE"
  | "BLURRY_IMAGE"
  | "DUPLICATE_CAPTURE";

const DARK_LUMINANCE_THRESHOLD = 42;
const BLUR_LAPLACIAN_THRESHOLD = 80;
const DUPLICATE_HAMMING_THRESHOLD = 6;

/** Mean RGB luminance (0–255) from oriented pixels. */
export async function measureMeanLuminance(input: Buffer): Promise<number> {
  const { channels } = await sharp(input).rotate().stats();
  if (!channels?.length) return 0;
  const sum = channels.reduce((acc, ch) => acc + ch.mean, 0);
  return sum / channels.length;
}

/**
 * Laplacian variance on a downscaled greyscale image (higher = sharper).
 */
export async function measureLaplacianVariance(input: Buffer): Promise<number> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize(256, 256, { fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  if (width < 3 || height < 3) return 0;

  const laplacian: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const center = data[idx];
      const up = data[idx - width];
      const down = data[idx + width];
      const left = data[idx - 1];
      const right = data[idx + 1];
      const value = Math.abs(4 * center - up - down - left - right);
      laplacian.push(value);
    }
  }

  if (laplacian.length === 0) return 0;
  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length;
  const variance =
    laplacian.reduce((acc, v) => acc + (v - mean) ** 2, 0) / laplacian.length;
  return variance;
}

/** 64-bit difference hash (hex string). */
export async function computePerceptualHash(input: Buffer): Promise<string> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize(9, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * width + x];
      const right = data[y * width + x + 1];
      bits += left < right ? "1" : "0";
    }
  }

  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const na = parseInt(a[i], 16);
    const nb = parseInt(b[i], 16);
    let x = na ^ nb;
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

export async function analyzeImageQuality(
  input: Buffer,
): Promise<ImageQualityMetrics> {
  const [meanLuminance, laplacianVariance, perceptualHash] = await Promise.all([
    measureMeanLuminance(input),
    measureLaplacianVariance(input),
    computePerceptualHash(input),
  ]);
  return { meanLuminance, laplacianVariance, perceptualHash };
}

export function buildQualityWarnings(
  metrics: ImageQualityMetrics,
  siblingHashes: string[],
): { warnings: QualityWarningCode[]; metrics: ImageQualityMetrics } {
  const warnings: QualityWarningCode[] = [];
  if (metrics.meanLuminance < DARK_LUMINANCE_THRESHOLD) {
    warnings.push("DARK_IMAGE");
  }
  if (metrics.laplacianVariance < BLUR_LAPLACIAN_THRESHOLD) {
    warnings.push("BLURRY_IMAGE");
  }
  for (const hash of siblingHashes) {
    if (
      hammingDistanceHex(metrics.perceptualHash, hash) <=
      DUPLICATE_HAMMING_THRESHOLD
    ) {
      warnings.push("DUPLICATE_CAPTURE");
      break;
    }
  }
  return { warnings, metrics };
}

export {
  DARK_LUMINANCE_THRESHOLD,
  BLUR_LAPLACIAN_THRESHOLD,
  DUPLICATE_HAMMING_THRESHOLD,
};
