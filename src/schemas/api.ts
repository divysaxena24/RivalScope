import { z } from "zod";

/**
 * Normalizes URL into a clean hostname / domain string
 * e.g. "https://www.stripe.com/pricing" -> "stripe.com"
 */
export function extractDomain(url: string): string {
  try {
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    const parsed = new URL(normalized);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return url.toLowerCase().trim();
  }
}

// UUID validation helper
export const uuidSchema = z.string().uuid("Invalid UUID format");

// Create competitor validation
export const createCompetitorSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(255),
  website: z.string().url("Please provide a valid website URL"),
  industry: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url("Invalid logo URL").optional().or(z.literal("")),
});

// Update competitor validation
export const updateCompetitorSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(255).optional(),
  website: z.string().url("Please provide a valid website URL").optional(),
  industry: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable().or(z.literal("")),
  status: z.enum(["active", "archived"]).optional(),
});

// Create tracked URL validation
export const createTrackedUrlSchema = z.object({
  url: z.string().url("Please enter a valid page URL"),
  pageType: z.enum(["pricing", "features", "product", "other"]).default("pricing"),
  isActive: z.boolean().default(true),
});

// Create pricing plan validation
export const createPricingPlanSchema = z.object({
  planName: z.string().min(1, "Plan name is required").max(255),
  description: z.string().optional(),
  price: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(10).default("USD"),
  billingPeriod: z.enum(["monthly", "yearly", "one_time", "custom"]).default("monthly"),
  isCustomPricing: z.boolean().default(false),
  isActive: z.boolean().default(true),
  features: z.array(z.string()).default([]),
  usageLimits: z.record(z.string(), z.unknown()).default({}),
  sourceUrl: z.string().url().optional().nullable(),
});
