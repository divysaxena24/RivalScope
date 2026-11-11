import { NormalizedExtractionResult, NormalizedPricingPlan } from "./types";

/**
 * Merges multi-pass extraction results from chunked document passes:
 * 1. Combines plans across chunks.
 * 2. If the same planName appears in multiple chunks (e.g. tier card in chunk 1, feature table in chunk 2):
 *    - Preserves price & billingPeriod from the most authoritative source (non-null over null).
 *    - Unifies and deduplicates features per plan.
 *    - Merges usage limits without clobbering.
 * 3. Status determination:
 *    - If any chunk successfully extracts plans -> SUCCESS.
 *    - If all chunks return NO_PRICING_FOUND -> NO_PRICING_FOUND.
 *    - If any chunk failed/flagged without other plans -> preserves warning/error.
 */
export function mergeExtractionPasses(
  results: NormalizedExtractionResult[]
): NormalizedExtractionResult {
  if (results.length === 0) {
    return {
      companyName: null,
      productName: null,
      currency: null,
      region: null,
      status: "NO_PRICING_FOUND",
      plans: [],
      rawPlanCount: 0,
      featureCount: 0,
    };
  }

  if (results.length === 1) {
    return results[0];
  }

  const mergedPlansMap = new Map<string, NormalizedPricingPlan>();
  const allCurrencies = new Set<string>();
  const allWarnings: string[] = [];
  let anySuccess = false;
  let allNoPricing = true;
  let companyName: string | null = null;
  let productName: string | null = null;

  for (const res of results) {
    if (res.status === "SUCCESS" && res.plans.length > 0) {
      anySuccess = true;
      allNoPricing = false;
    } else if (res.status !== "NO_PRICING_FOUND") {
      allNoPricing = false;
    }

    if (res.companyName && !companyName) {
      companyName = res.companyName;
    }
    if (res.productName && !productName) {
      productName = res.productName;
    }

    if (res.currency) {
      allCurrencies.add(res.currency);
    }
    if (res.reviewReason) {
      allWarnings.push(res.reviewReason);
    }

    for (const plan of res.plans) {
      // Identity key must distinguish:
      // 1. Normalized plan name
      // 2. Billing period ("monthly" vs "yearly" vs "custom") - treated as wildcard if "unknown"
      // 3. Currency / Region if provided
      const normalizedName = plan.planName.trim().toLowerCase();
      const planBilling = plan.billingPeriod && plan.billingPeriod !== "unknown" ? plan.billingPeriod : null;
      const planCurr = plan.currency || null;

      // Check if an existing plan matches this plan's identity (allowing unknown billing/currency to match specific)
      let matchedKey: string | null = null;
      for (const [k, existing] of mergedPlansMap.entries()) {
        const existName = existing.planName.trim().toLowerCase();
        if (existName === normalizedName) {
          const existBilling = existing.billingPeriod && existing.billingPeriod !== "unknown" ? existing.billingPeriod : null;
          const billingMatches = !planBilling || !existBilling || planBilling === existBilling;
          const existCurr = existing.currency || null;
          const currMatches = !planCurr || !existCurr || planCurr === existCurr;
          if (billingMatches && currMatches) {
            matchedKey = k;
            break;
          }
        }
      }

      if (!matchedKey) {
        const key = `${normalizedName}::${planBilling || "default"}::${planCurr || "any"}`;
        mergedPlansMap.set(key, { ...plan });
      } else {
        const existing = mergedPlansMap.get(matchedKey)!;

        // Merge pricing info (prefer non-null price and explicit currency)
        if (existing.price === null && plan.price !== null) {
          existing.price = plan.price;
          existing.currency = plan.currency || existing.currency;
          existing.originalPriceText = plan.originalPriceText || existing.originalPriceText;
          existing.billingPeriod = plan.billingPeriod !== "unknown" ? plan.billingPeriod : existing.billingPeriod;
          existing.isCustomPricing = plan.isCustomPricing;
          existing.isFree = plan.isFree;
        }

        if (existing.description === null && plan.description !== null) {
          existing.description = plan.description;
        }

        // Merge features (deduplicate by feature name)
        const featureMap = new Map<string, typeof plan.features[0]>();
        for (const f of existing.features) {
          featureMap.set(f.name.toLowerCase(), f);
        }
        for (const f of plan.features) {
          const fKey = f.name.toLowerCase();
          if (!featureMap.has(fKey)) {
            featureMap.set(fKey, f);
          } else {
            // If new feature has rich availability or limitation details, prefer it
            const curF = featureMap.get(fKey)!;
            if (curF.availability === "unknown" && f.availability !== "unknown") {
              featureMap.set(fKey, f);
            }
          }
        }
        existing.features = Array.from(featureMap.values());

        // Merge usage limits
        existing.usageLimits = {
          ...existing.usageLimits,
          ...plan.usageLimits,
        };
      }
    }
  }

  const finalPlans = Array.from(mergedPlansMap.values());
  const primaryCurrency = Array.from(allCurrencies)[0] || null;
  const totalFeatures = finalPlans.reduce((acc, p) => acc + p.features.length, 0);

  let finalStatus: "SUCCESS" | "NO_PRICING_FOUND" | "FLAGGED_FOR_REVIEW" = "SUCCESS";
  if (finalPlans.length > 0) {
    finalStatus = "SUCCESS";
  } else if (allNoPricing) {
    finalStatus = "NO_PRICING_FOUND";
  } else {
    finalStatus = allWarnings.length > 0 ? "FLAGGED_FOR_REVIEW" : "NO_PRICING_FOUND";
  }

  const totalModelExtracted = results.reduce((acc, r) => acc + (r.modelExtractedCount || r.rawPlanCount || 0), 0);
  const totalValidated = results.reduce((acc, r) => acc + (r.validatedCount || r.rawPlanCount || 0), 0);

  return {
    companyName,
    productName,
    currency: primaryCurrency,
    region: results.find((r) => r.region)?.region || null,
    status: finalStatus,
    reviewReason: allWarnings.length > 0 ? allWarnings.join("; ") : undefined,
    plans: finalPlans,
    rawPlanCount: finalPlans.length,
    featureCount: totalFeatures,
    modelExtractedCount: totalModelExtracted,
    validatedCount: totalValidated,
  };
}
