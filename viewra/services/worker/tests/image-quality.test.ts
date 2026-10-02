import { describe, expect, it } from "vitest";
import { createTestJpeg } from "../src/process-image.js";
import {
  analyzeImageQuality,
  buildQualityWarnings,
  hammingDistanceHex,
  measureMeanLuminance,
} from "../src/image-quality.js";

describe("image-quality", () => {
  it("detects dark images via mean luminance", async () => {
    const dark = await createTestJpeg({
      width: 400,
      height: 300,
      background: { r: 5, g: 5, b: 5 },
    });
    const mean = await measureMeanLuminance(dark);
    expect(mean).toBeLessThan(42);
    const metrics = await analyzeImageQuality(dark);
    const { warnings } = buildQualityWarnings(metrics, []);
    expect(warnings).toContain("DARK_IMAGE");
  });

  it("flags near-duplicate captures via perceptual hash", async () => {
    const a = await createTestJpeg({ width: 640, height: 480 });
    const metricsA = await analyzeImageQuality(a);
    const metricsB = await analyzeImageQuality(a);
    expect(
      hammingDistanceHex(metricsA.perceptualHash, metricsB.perceptualHash),
    ).toBe(0);
    const { warnings } = buildQualityWarnings(metricsB, [
      metricsA.perceptualHash,
    ]);
    expect(warnings).toContain("DUPLICATE_CAPTURE");
  });
});
