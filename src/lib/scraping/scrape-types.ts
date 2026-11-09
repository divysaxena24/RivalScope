export interface ScrapeTrackedUrlResult {
  trackedUrlId: string;
  url: string;
  status: "SUCCESS" | "FAILED";
  scrapeResultId?: string;
  contentHash?: string;
  pageTitle?: string | null;
  errorMessage?: string | null;
  scrapedAt: string;
}

export interface ScrapeCompetitorSummary {
  competitorId: string;
  competitorName: string;
  totalUrls: number;
  successfulScrapes: number;
  failedScrapes: number;
  results: ScrapeTrackedUrlResult[];
}
