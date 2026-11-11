export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  rawMarkdown: string;
  isPricingOrFeatureTable: boolean;
  columnCount: number;
  rowCount: number;
  confidenceScore: number;
}

export interface CandidatePlan {
  name: string;
  sourceContext: string;
  confidence: "high" | "medium" | "low";
}

export interface CandidatePrice {
  raw: string;
  amount: number | null;
  currencySymbol: string | null;
  period: string | null;
  isFree: boolean;
  isCustom: boolean;
}

export interface PricingSection {
  heading: string;
  level: number;
  content: string;
  tokensEstimated: number;
  relevanceScore: number;
  isPricingCard: boolean;
  hasTable: boolean;
  tables: ExtractedTable[];
  planCandidates: string[];
  priceCandidates: CandidatePrice[];
}

export interface PreprocessingMetrics {
  rawCharacterCount: number;
  preprocessedCharacterCount: number;
  reductionPercentage: number;
  rawEstimatedTokens: number;
  preprocessedEstimatedTokens: number;
  totalSectionsFound: number;
  relevantSectionsRetained: number;
  tablesFound: number;
  tablesPreserved: number;
  candidatePricesFound: number;
  candidatePlansFound: string[];
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface PreprocessedMarkdownResult {
  preprocessedMarkdown: string;
  metrics: PreprocessingMetrics;
  sections: PricingSection[];
  preservedTables: ExtractedTable[];
  status: "OPTIMIZED" | "FALLBACK" | "NO_PRICING_CONTENT";
  qualityWarning?: string;
}

