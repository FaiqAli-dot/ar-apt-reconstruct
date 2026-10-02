import { describe, expect, it } from "vitest";
import { createConnectionSchema, loginSchema } from "./api.js";
import { PropertyStatus, REQUIRED_PHOTO_DIRECTIONS } from "./enums.js";

describe("@viewra/types", () => {
  it("requires three photo directions", () => {
    expect(REQUIRED_PHOTO_DIRECTIONS).toEqual(["LEFT", "CENTER", "RIGHT"]);
  });

  it("validates login payload", () => {
    expect(() =>
      loginSchema.parse({ email: "a@b.com", password: "short" }),
    ).toThrow();
    expect(
      loginSchema.parse({ email: "a@b.com", password: "longenough" }),
    ).toMatchObject({ email: "a@b.com" });
  });

  it("allows arbitrary connection directions via CUSTOM", () => {
    const conn = createConnectionSchema.parse({
      propertyId: "p1",
      fromNodeId: "n1",
      toNodeId: "n2",
      direction: "CUSTOM",
      label: "to kitchen",
    });
    expect(conn.fromNodeId).toBe("n1");
    expect(conn.toNodeId).toBe("n2");
  });

  it("exposes property statuses used by publishing", () => {
    expect(PropertyStatus.PUBLISHED).toBe("PUBLISHED");
    expect(PropertyStatus.ARCHIVED).toBe("ARCHIVED");
  });
});
