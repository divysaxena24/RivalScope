export interface ScrapeOptions {
  timeoutMs?: number;
  maxRetries?: number;
  onlyMainContent?: boolean;
}

export interface ScrapedPageData {
  url: string;
  markdown: string;
  title: string | null;
  metadata: Record<string, unknown>;
  contentHash: string;
  statusCode?: number;
  scrapedAt: Date;
}

export interface ScrapeSuccessResult {
  success: true;
  data: ScrapedPageData;
}

export interface ScrapeFailureResult {
  success: false;
  error: string;
  code: string;
  statusCode?: number;
}

export type ScrapeResult = ScrapeSuccessResult | ScrapeFailureResult;
