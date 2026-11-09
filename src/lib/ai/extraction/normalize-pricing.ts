import {
  PricingExtractionOutput,
  NormalizedExtractionResult,
  NormalizedPricingPlan,
  ExtractedPricingPlan,
  PlanFeatureItem,
} from "./types";

/**
 * Currency symbol mapping helper
 */
const SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "₹": "INR",
  "¥": "JPY",
  "C$": "CAD",
  "A$": "AUD",
};

/**
 * Normalizes currency codes or symbols into standardized 3-letter ISO code
 */
export function normalizeCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();

  if (SYMBOL_TO_CURRENCY[trimmed]) {
    return SYMBOL_TO_CURRENCY[trimmed];
  }

  if (/^[A-Z]{3}$/.test(trimmed)) {
    return trimmed;
  }

  // Check if string contains symbol
  for (const [symbol, code] of Object.entries(SYMBOL_TO_CURRENCY)) {
    if (raw.includes(symbol)) {
      return code;
    }
  }

  return trimmed || null;
}

/**
 * Performs decimal-safe normalization of plan pricing and properties.
 */
export function normalizePricingPlan(
  raw: ExtractedPricingPlan,
  pageCurrency: string | null,
  pageRegion: string | null = null
): NormalizedPricingPlan {
  const isCustom =
    raw.isCustomPricing ||
    raw.price === null ||
    /contact|quote|custom|enterprise|let'?s talk/i.test(raw.originalPriceText);

  const isFree =
    raw.isFree ||
    raw.price === 0 ||
    /free|forever free|\$0|0\/mo/i.test(raw.originalPriceText);

  // Decimal safe string representation for numeric postgres column
  let formattedPrice: string | null = null;
  if (isCustom && !isFree) {
    formattedPrice = null;
  } else if (isFree) {
    formattedPrice = "0.00";
  } else if (raw.price !== null && raw.price !== undefined) {
    formattedPrice = Number(raw.price).toFixed(2);
  }

  const establishedCurrency =
    normalizeCurrency(raw.currency) || normalizeCurrency(pageCurrency);

  // Convert features array to structured rich format preserving availability & limits
  const normalizedFeatures: PlanFeatureItem[] = (raw.features || []).map((f) => ({
    name: f.featureName.trim(),
    description: f.featureDescription?.trim() || null,
    availability: f.availability,
    originalValue: f.originalValue || (f.availability === "included" ? "Yes" : f.availability === "not_included" ? "No" : "Limited"),
    numericLimit: f.numericLimit !== undefined ? f.numericLimit : null,
    limitUnit: f.limitUnit?.trim() || null,
    limitationDescription: f.limitationDescription?.trim() || null,
    evidenceText: f.evidenceText?.trim() || null,
  }));

  const usageLimits: Record<string, unknown> = {};
  if (raw.usageLimits) {
    if (raw.usageLimits.apiRequestLimit)
      usageLimits.apiRequestLimit = raw.usageLimits.apiRequestLimit;
    if (raw.usageLimits.userSeats)
      usageLimits.userSeats = raw.usageLimits.userSeats;
    if (raw.usageLimits.storageLimit)
      usageLimits.storageLimit = raw.usageLimits.storageLimit;
    if (raw.usageLimits.projectsLimit)
      usageLimits.projectsLimit = raw.usageLimits.projectsLimit;
    if (raw.usageLimits.integrationsLimit)
      usageLimits.integrationsLimit = raw.usageLimits.integrationsLimit;
    if (raw.usageLimits.dataRetention)
      usageLimits.dataRetention = raw.usageLimits.dataRetention;
    if (raw.usageLimits.customLimits) {
      Object.assign(usageLimits, raw.usageLimits.customLimits);
    }
  }

  return {
    planName: raw.planName.trim(),
    description: raw.planDescription?.trim() || null,
    price: formattedPrice,
    currency: establishedCurrency,
    region: raw.region?.trim() || pageRegion || null,
    billingPeriod: raw.billingPeriod,
    isCustomPricing: isCustom && !isFree,
    isActive: true,
    isFree,
    originalPriceText: raw.originalPriceText.trim(),
    discountInfo: raw.discountInfo?.trim() || null,
    features: normalizedFeatures,
    usageLimits,
    targetSegment: raw.targetCustomerSegment?.trim() || null,
    evidenceText: raw.evidenceText.trim(),
  };
}

/**
 * Normalizes complete LLM output payload
 */
export function normalizeExtractionResult(
  output: PricingExtractionOutput
): NormalizedExtractionResult {
  if (!output.hasPricing || output.status === "NO_PRICING_FOUND") {
    return {
      companyName: output.companyName || null,
      productName: output.productName || null,
      currency: null,
      region: output.region || null,
      status: "NO_PRICING_FOUND",
      plans: [],
      rawPlanCount: 0,
      featureCount: 0,
    };
  }

  const defaultCurrency = normalizeCurrency(output.currency);
  const defaultRegion = output.region?.trim() || null;
  const normalizedPlans: NormalizedPricingPlan[] = [];
  let totalFeatures = 0;

  for (const rawPlan of output.plans) {
    const normalized = normalizePricingPlan(rawPlan, defaultCurrency, defaultRegion);
    normalizedPlans.push(normalized);
    totalFeatures += normalized.features.length;
  }

  return {
    companyName: output.companyName?.trim() || null,
    productName: output.productName?.trim() || null,
    currency: defaultCurrency,
    region: defaultRegion,
    status: output.status === "FLAGGED_FOR_REVIEW" ? "FLAGGED_FOR_REVIEW" : "SUCCESS",
    reviewReason: output.reviewReason || null,
    plans: normalizedPlans,
    rawPlanCount: normalizedPlans.length,
    featureCount: totalFeatures,
  };
}
