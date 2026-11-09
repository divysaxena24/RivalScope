export type PlanTier = "free" | "starter" | "pro" | "enterprise";

export type TrendDirection = "up" | "down" | "stable";

export type CompetitorStatus = "active" | "monitoring" | "paused";

export interface PricingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnualMonthly?: number;
  currency: string;
  billingPeriod: "monthly" | "annually";
  features: string[];
}

export interface Competitor {
  id: string;
  name: string;
  website: string;
  domain: string;
  category: string;
  status: CompetitorStatus;
  lastScannedAt: string;
  trackedPlansCount: number;
  latestPriceChange?: string;
  description: string;
}

export interface PriceChangeEvent {
  id: string;
  competitorId: string;
  competitorName: string;
  planName: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  percentageChange: number;
  detectedAt: string;
  changeType: "increase" | "decrease" | "feature_update";
}

export interface AIInsight {
  id: string;
  competitorId: string;
  competitorName: string;
  title: string;
  summary: string;
  impact: "high" | "medium" | "low";
  category: "pricing" | "packaging" | "discount" | "feature_shift";
  createdAt: string;
}

export interface DashboardMetric {
  title: string;
  value: string | number;
  changeDescription: string;
  trend: TrendDirection;
  iconName: string;
}
