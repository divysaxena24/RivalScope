import { describe, it, expect } from "vitest";
import { createTrackedUrlSchema } from "../../../schemas/api";

describe("Tracked URL Validation Rules", () => {
  it("should accept valid HTTP and HTTPS pricing page URLs", () => {
    const valid = createTrackedUrlSchema.parse({
      url: "https://openai.com/pricing",
      pageType: "pricing",
      isActive: true,
    });
    expect(valid.url).toBe("https://openai.com/pricing");
    expect(valid.pageType).toBe("pricing");
  });

  it("should accept valid features and product page types", () => {
    const features = createTrackedUrlSchema.parse({
      url: "https://linear.app/features",
      pageType: "features",
    });
    expect(features.pageType).toBe("features");

    const other = createTrackedUrlSchema.parse({
      url: "https://github.com/pricing/enterprise",
      pageType: "other",
    });
    expect(other.pageType).toBe("other");
  });

  it("should reject invalid URL strings", () => {
    expect(() =>
      createTrackedUrlSchema.parse({
        url: "not-a-valid-url",
        pageType: "pricing",
      })
    ).toThrow();
  });

  it("should reject non-supported page types", () => {
    expect(() =>
      createTrackedUrlSchema.parse({
        url: "https://example.com/pricing",
        pageType: "unknown_type" as any,
      })
    ).toThrow();
  });

  it("should default isActive to true and pageType to pricing if not specified", () => {
    const result = createTrackedUrlSchema.parse({
      url: "https://stripe.com/pricing",
    });
    expect(result.pageType).toBe("pricing");
    expect(result.isActive).toBe(true);
  });
});
