import { StrategicInsight } from "./insight-schema";

export interface CompetitorIntelligenceContext {
  competitorId: string;
  competitorName: string;
  domain: string;
  industry: string | null;
  activePlans: Array<{
    id: string;
    planName: string;
    price: string | null;
    currency: string | null;
    billingPeriod: string | null;
    features: string[];
    usageLimits: Record<string, unknown>;
  }>;
  recentChanges: Array<{
    id: string;
    changeType: string;
    fieldName: string | null;
    oldValue: any;
    newValue: any;
    percentageDifference: string | null;
    description: string | null;
    detectedAt: Date;
  }>;
  recentScrapes: Array<{
    id: string;
    sourceUrl: string;
    pageTitle: string | null;
    scrapedAt: Date;
    contentSnippet: string;
  }>;
}

export interface MarketWideIntelligenceContext {
  competitors: CompetitorIntelligenceContext[];
  totalCompetitorsTracked: number;
  totalPlansTracked: number;
  totalChangesInWindow: number;
}
