import { describe, expect, it } from "vitest";
import { slugSchema, slateSlugSchema } from "@/lib/validation";

describe("project slug reservation", () => {
  it("rejects 'slate' as a project slug", () => {
    const result = slugSchema.safeParse("slate");
    expect(result.success).toBe(false);
  });

  it("still accepts ordinary project slugs", () => {
    expect(slugSchema.safeParse("the-lighthouse-keeper").success).toBe(true);
  });

  it("rejects 'slate' case-insensitively (normalized before the reserved check)", () => {
    const result = slugSchema.safeParse("SLATE");
    expect(result.success).toBe(false);
  });

  it("does not reserve 'slate' for a slate's own slug", () => {
    // A different namespace (/slate/[slug]) — no self-collision to guard against.
    expect(slateSlugSchema.safeParse("slate").success).toBe(true);
  });
});
