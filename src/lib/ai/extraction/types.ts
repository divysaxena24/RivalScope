import { z } from "zod";

export const BillingPeriodEnum = z.enum([
  "monthly",
  "yearly",
  "quarterly",
  "weekly",
  "one_time",
  "custom",
  "unknown",
]);

export const FeatureAvailabilityEnum = z.enum([
  "included",
  "not_included",
  "limited",
  "unknown",
]);

export const ExtractionStatusEnum = z.enum([
  "SUCCESS",
  "NO_PRICING_FOUND",
  "FLAGGED_FOR_REVIEW",
  "FAILED",
]);

/**
 * Normalizes any raw availability string/value into strict FeatureAvailabilityEnum
 */
export function normalizeFeatureAvailability(raw: unknown): "included" | "not_included" | "limited" | "unknown" {
  if (raw === null || raw === undefined) return "unknown";
  const str = String(raw).trim().toLowerCase();

  if (
    !str ||
    str === "unknown" ||
    str === "unspecified" ||
    str === "not specified" ||
    str === "not mentioned" ||
    str === "n/a" ||
    str === "—" ||
    str === "-"
  ) {
    return "unknown";
  }

  // Unavailable / Excluded / No
  if (
    str === "no" ||
    str === "false" ||
    str === "none" ||
    str === "excluded" ||
    str === "not_included" ||
    str === "not included" ||
    str === "not available" ||
    str === "unavailable" ||
    str.startsWith("requires add-on")
  ) {
    return "not_included";
  }

  // Yes / Included / Enabled / Checked / Unlimited
  if (
    str === "yes" ||
    str === "true" ||
    str === "included" ||
    str === "available" ||
    str === "unlimited" ||
    str === "check" ||
    str === "checked" ||
    str === "standard"
  ) {
    return "included";
  }

  // Limited / Numeric Quotas / Descriptive restrictions
  if (
    str === "limited" ||
    str.includes("limited") ||
    str.includes("up to") ||
    str.includes("expanded") ||
    str.includes("more") ||
    str.includes("choice of") ||
    str.includes("maximum") ||
    /\d+[kmgtx]?\b/i.test(str) // e.g. 27k, 10x, 10gb, 5
  ) {
    return "limited";
  }

  return "limited"; // If descriptive text exists but not generic yes/no, it describes a plan-specific scope/limit
}

/**
 * Extracted Feature schema: preserves rich availability, original values, limits, descriptions, and source excerpts.
 */
export const ExtractedFeatureSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const rawVal = val.trim();
    const availability = normalizeFeatureAvailability(rawVal);
    return {
      featureName: rawVal,
      featureDescription: null,
      availability,
      originalValue: rawVal,
      numericLimit: null,
      limitUnit: null,
      limitationDescription: availability === "limited" ? rawVal : null,
      evidenceText: rawVal,
    };
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    const featureName = String(obj.featureName || obj.name || obj.title || "Feature").trim();
    const rawAvail = obj.originalValue || obj.value || obj.availability || "included";
    const availability = normalizeFeatureAvailability(rawAvail);
    const originalValue = String(rawAvail).trim();

    // Check numeric limit or units (e.g. 27K, 10x, 500)
    let numericLimit: number | null = typeof obj.numericLimit === "number" ? obj.numericLimit : null;
    let limitUnit: string | null = obj.limitUnit ? String(obj.limitUnit).trim() : null;

    if (numericLimit === null && originalValue) {
      const match = originalValue.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z%xX]+)?$/);
      if (match) {
        numericLimit = parseFloat(match[1]);
        if (!limitUnit && match[2]) limitUnit = match[2];
      }
    }

    const limitationDescription =
      obj.limitationDescription ? String(obj.limitationDescription).trim()
      : availability === "limited" ? originalValue
      : null;

    return {
      featureName,
      featureDescription: obj.featureDescription ? String(obj.featureDescription).trim() : null,
      availability,
      originalValue,
      numericLimit,
      limitUnit,
      limitationDescription,
      evidenceText: obj.evidenceText ? String(obj.evidenceText).trim() : (obj.evidence ? String(obj.evidence).trim() : featureName),
    };
  }
  return {
    featureName: "Feature",
    featureDescription: null,
    availability: "unknown",
    originalValue: "Not specified",
    numericLimit: null,
    limitUnit: null,
    limitationDescription: null,
    evidenceText: null,
  };
}, z.object({
  featureName: z.string().min(1),
  featureDescription: z.string().optional().nullable(),
  availability: FeatureAvailabilityEnum.default("included"),
  originalValue: z.string().default("included"),
  numericLimit: z.number().optional().nullable(),
  limitUnit: z.string().optional().nullable(),
  limitationDescription: z.string().optional().nullable(),
  evidenceText: z.string().optional().nullable(),
}));

/**
 * Extracted Usage Limits schema
 */
export const ExtractedUsageLimitsSchema = z.preprocess((val) => {
  if (Array.isArray(val)) {
    return {
      apiRequestLimit: null,
      userSeats: null,
      storageLimit: null,
      projectsLimit: null,
      integrationsLimit: null,
      dataRetention: null,
      customLimits: val.reduce((acc, curr, i) => ({ ...acc, [`limit_${i}`]: String(curr) }), {}),
    };
  }
  if (typeof val === "object" && val !== null) {
    const rec = val as Record<string, unknown>;
    return {
      apiRequestLimit: rec.apiRequestLimit ? String(rec.apiRequestLimit) : null,
      userSeats: rec.userSeats ? String(rec.userSeats) : null,
      storageLimit: rec.storageLimit ? String(rec.storageLimit) : null,
      projectsLimit: rec.projectsLimit ? String(rec.projectsLimit) : null,
      integrationsLimit: rec.integrationsLimit ? String(rec.integrationsLimit) : null,
      dataRetention: rec.dataRetention ? String(rec.dataRetention) : null,
      customLimits: rec,
    };
  }
  return {};
}, z.object({
  apiRequestLimit: z.string().optional().nullable(),
  userSeats: z.string().optional().nullable(),
  storageLimit: z.string().optional().nullable(),
  projectsLimit: z.string().optional().nullable(),
  integrationsLimit: z.string().optional().nullable(),
  dataRetention: z.string().optional().nullable(),
  customLimits: z.record(z.string(), z.any()).optional().nullable(),
}));

/**
 * Extracted Pricing Plan schema: preprocesses aliases (name vs planName)
 */
export const ExtractedPricingPlanSchema = z.preprocess((val) => {
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    return {
      planName: String(obj.planName || obj.name || "Plan"),
      planDescription: obj.planDescription ? String(obj.planDescription) : (obj.description ? String(obj.description) : null),
      price: typeof obj.price === "number" ? obj.price : (obj.price ? Number(obj.price) : null),
      currency: obj.currency ? String(obj.currency) : null,
      region: obj.region ? String(obj.region) : null,
      billingPeriod: String(obj.billingPeriod || "monthly").toLowerCase(),
      isCustomPricing: Boolean(obj.isCustomPricing),
      isFree: Boolean(obj.isFree),
      isPubliclyAvailable: obj.isPubliclyAvailable !== false,
      originalPriceText: String(obj.originalPriceText || obj.priceText || (obj.price !== undefined ? String(obj.price) : "Contact Sales")),
      discountInfo: obj.discountInfo ? String(obj.discountInfo) : null,
      targetCustomerSegment: obj.targetCustomerSegment ? String(obj.targetCustomerSegment) : null,
      features: Array.isArray(obj.features) ? obj.features : [],
      usageLimits: obj.usageLimits || {},
      evidenceText: String(obj.evidenceText || obj.evidence || obj.originalPriceText || "Source pricing table"),
    };
  }
  return val;
}, z.object({
  planName: z.string().min(1),
  planDescription: z.string().optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  region: z.string().optional().nullable(),
  billingPeriod: z
    .string()
    .transform((b) => {
      const lower = b.toLowerCase();
      if (lower.includes("month")) return "monthly";
      if (lower.includes("year") || lower.includes("annual")) return "yearly";
      if (lower.includes("quarter")) return "quarterly";
      if (lower.includes("week")) return "weekly";
      if (lower.includes("one")) return "one_time";
      if (lower.includes("custom")) return "custom";
      return "unknown";
    })
    .pipe(BillingPeriodEnum),
  isCustomPricing: z.boolean().default(false),
  isFree: z.boolean().default(false),
  isPubliclyAvailable: z.boolean().default(true),
  originalPriceText: z.string().min(1),
  discountInfo: z.string().optional().nullable(),
  targetCustomerSegment: z.string().optional().nullable(),
  features: z.array(ExtractedFeatureSchema).default([]),
  usageLimits: ExtractedUsageLimitsSchema.optional().nullable(),
  evidenceText: z.string().default("Source pricing table"),
}));

/**
 * Root Extraction Schema returned by LLM
 */
export const PricingExtractionOutputSchema = z.object({
  companyName: z.string().optional().nullable(),
  productName: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  hasPricing: z.boolean().default(true),
  status: z
    .string()
    .transform((s): "SUCCESS" | "NO_PRICING_FOUND" | "FLAGGED_FOR_REVIEW" | "FAILED" => {
      const up = s.toUpperCase();
      if (up === "SUCCESS" || up === "OK") return "SUCCESS";
      if (up === "NO_PRICING_FOUND" || up === "NONE") return "NO_PRICING_FOUND";
      if (up === "FLAGGED_FOR_REVIEW" || up === "REVIEW") return "FLAGGED_FOR_REVIEW";
      if (up === "FAILED") return "FAILED";
      return "SUCCESS";
    })
    .pipe(ExtractionStatusEnum),
  plans: z.array(ExtractedPricingPlanSchema).default([]),
  confidenceScore: z.number().min(0).max(1).default(1),
  reviewReason: z.string().optional().nullable(),
});

export type ExtractedFeature = z.infer<typeof ExtractedFeatureSchema>;
export type ExtractedUsageLimits = z.infer<typeof ExtractedUsageLimitsSchema>;
export type ExtractedPricingPlan = z.infer<typeof ExtractedPricingPlanSchema>;
export type PricingExtractionOutput = z.infer<typeof PricingExtractionOutputSchema>;

export interface PlanFeatureItem {
  name: string;
  description: string | null;
  availability: "included" | "not_included" | "limited" | "unknown";
  originalValue: string;
  numericLimit: number | null;
  limitUnit: string | null;
  limitationDescription: string | null;
  evidenceText: string | null;
}

export interface ExtractionCounts {
  modelExtracted: number;
  validated: number;
  distinctOfferings: number;
  persisted: number;
  skipped: number;
  skippedReasons?: Record<string, number>;
}

export interface ExtractionExecutionResult {
  scrapeId: string;
  competitorId: string;
  status: "SUCCESS" | "NO_PRICING_FOUND" | "FLAGGED_FOR_REVIEW" | "FAILED";
  extractedPlanCount: number;
  extractedFeatureCount: number;
  detectedChangesCount: number;
  counts: ExtractionCounts;
  warnings?: string[];
  errorMessage?: string;
  plans: Array<{
    id: string;
    planName: string;
    price: string | null;
    currency: string | null;
    billingPeriod: string;
  }>;
}

export interface NormalizedPricingPlan {
  planName: string;
  description: string | null;
  price: string | null;
  currency: string | null;
  region: string | null;
  billingPeriod: "monthly" | "yearly" | "quarterly" | "weekly" | "one_time" | "custom" | "unknown";
  isCustomPricing: boolean;
  isActive: boolean;
  isFree: boolean;
  originalPriceText: string;
  discountInfo: string | null;
  features: PlanFeatureItem[];
  usageLimits: Record<string, unknown>;
  targetSegment: string | null;
  evidenceText: string;
}

export interface NormalizedExtractionResult {
  companyName: string | null;
  productName: string | null;
  currency: string | null;
  region: string | null;
  status: "SUCCESS" | "NO_PRICING_FOUND" | "FLAGGED_FOR_REVIEW";
  reviewReason?: string | null;
  plans: NormalizedPricingPlan[];
  rawPlanCount: number;
  featureCount: number;
  modelExtractedCount?: number;
  validatedCount?: number;
}
