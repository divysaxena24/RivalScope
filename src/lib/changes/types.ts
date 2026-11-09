export type ChangeType =
  | "PRICE_INCREASED"
  | "PRICE_DECREASED"
  | "PRICE_UNCHANGED"
  | "PRICE_BECAME_FREE"
  | "PRICE_NO_LONGER_FREE"
  | "CUSTOM_PRICING_INTRODUCED"
  | "CUSTOM_PRICING_REMOVED"
  | "CURRENCY_CHANGED"
  | "BILLING_PERIOD_CHANGED"
  | "PLAN_ADDED"
  | "PLAN_REMOVED"
  | "FEATURE_ADDED"
  | "FEATURE_REMOVED"
  | "FEATURE_INCLUDED"
  | "FEATURE_EXCLUDED"
  | "FEATURE_LIMITED"
  | "FEATURE_LIMIT_INCREASED"
  | "FEATURE_LIMIT_DECREASED"
  | "LIMIT_INCREASED"
  | "LIMIT_DECREASED";

export interface SnapshotPlan {
  id?: string;
  pricingPlanId?: string | null;
  planName: string;
  price: string | null;
  currency: string | null;
  billingPeriod: string | null;
  features: string[];
  usageLimits: Record<string, unknown>;
  sourceUrl?: string | null;
  observedAt?: Date | string;
}

export interface DetectedChange {
  competitorId: string;
  pricingPlanId?: string | null;
  previousSnapshotId?: string | null;
  currentSnapshotId?: string | null;
  changeType: ChangeType;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  absoluteDifference?: string | null;
  percentageDifference?: string | null;
  description: string;
  sourceUrl?: string | null;
  detectedAt?: Date;
}
