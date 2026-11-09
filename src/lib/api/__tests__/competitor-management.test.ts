import { describe, it, expect } from "vitest";
import { updateCompetitorSchema, extractDomain } from "../../../schemas/api";

describe("Competitor Management — Validation, Edit & Archive", () => {
  it("validates valid competitor edit payload with active status", () => {
    const input = {
      name: "OpenAI Inc.",
      website: "https://openai.com",
      industry: "Artificial Intelligence",
      description: "AI research and deployment company",
      status: "active" as const,
    };
    const parsed = updateCompetitorSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("OpenAI Inc.");
      expect(parsed.data.status).toBe("active");
    }
  });

  it("validates competitor edit payload with archived status", () => {
    const input = {
      status: "archived" as const,
    };
    const parsed = updateCompetitorSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("archived");
    }
  });

  it("rejects invalid status enum", () => {
    const input = {
      status: "deleted",
    };
    const parsed = updateCompetitorSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid website URLs during update", () => {
    const input = {
      website: "not-a-valid-url",
    };
    const parsed = updateCompetitorSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("extracts clean domain without www prefix for duplicate verification", () => {
    expect(extractDomain("https://www.openai.com/pricing")).toBe("openai.com");
    expect(extractDomain("http://stripe.com")).toBe("stripe.com");
    expect(extractDomain("https://subdomain.company.co.uk/page")).toBe("subdomain.company.co.uk");
  });
});

describe("Scraping History — Latest & Previous Weekly Observation Logic", () => {
  interface ScrapeItem {
    id: string;
    contentHash: string;
    status: "SUCCESS" | "FAILED";
    scrapedAt: string;
  }

  function computeObservations(scrapes: ScrapeItem[]) {
    const successful = scrapes.filter((s) => s.status === "SUCCESS");
    if (successful.length === 0) {
      return { latestSuccessful: null, previousWeekly: null };
    }

    const latest = successful[0];
    const preceding = successful[1] || null;

    const latestSuccessful = {
      ...latest,
      contentChanged: preceding ? preceding.contentHash !== latest.contentHash : false,
    };

    const targetTime = new Date(latest.scrapedAt).getTime() - 7 * 24 * 60 * 60 * 1000;
    const eligibleWeekly = successful.find(
      (s) => new Date(s.scrapedAt).getTime() <= targetTime
    );

    let previousWeekly: any = null;
    if (eligibleWeekly) {
      previousWeekly = {
        ...eligibleWeekly,
        contentChangedFromLatest: eligibleWeekly.contentHash !== latest.contentHash,
        daysAgo: Math.round(
          (new Date(latest.scrapedAt).getTime() - new Date(eligibleWeekly.scrapedAt).getTime()) /
            (24 * 60 * 60 * 1000)
        ),
      };
    }

    return { latestSuccessful, previousWeekly };
  }

  it("identifies latest successful scrape and flags content unchanged when hash matches", () => {
    const now = Date.now();
    const scrapes: ScrapeItem[] = [
      {
        id: "s1",
        status: "SUCCESS",
        contentHash: "hash-aaa",
        scrapedAt: new Date(now).toISOString(),
      },
      {
        id: "s2",
        status: "SUCCESS",
        contentHash: "hash-aaa",
        scrapedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const result = computeObservations(scrapes);
    expect(result.latestSuccessful?.id).toBe("s1");
    expect(result.latestSuccessful?.contentChanged).toBe(false);
  });

  it("flags content changed when newest scrape hash differs from preceding", () => {
    const now = Date.now();
    const scrapes: ScrapeItem[] = [
      {
        id: "s1",
        status: "SUCCESS",
        contentHash: "hash-bbb",
        scrapedAt: new Date(now).toISOString(),
      },
      {
        id: "s2",
        status: "SUCCESS",
        contentHash: "hash-aaa",
        scrapedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const result = computeObservations(scrapes);
    expect(result.latestSuccessful?.id).toBe("s1");
    expect(result.latestSuccessful?.contentChanged).toBe(true);
  });

  it("does not overwrite latest successful scrape when a new scrape fails", () => {
    const now = Date.now();
    const scrapes: ScrapeItem[] = [
      {
        id: "failed-attempt",
        status: "FAILED",
        contentHash: "",
        scrapedAt: new Date(now).toISOString(),
      },
      {
        id: "s1",
        status: "SUCCESS",
        contentHash: "hash-valid",
        scrapedAt: new Date(now - 10000).toISOString(),
      },
    ];

    const result = computeObservations(scrapes);
    expect(result.latestSuccessful?.id).toBe("s1");
    expect(result.latestSuccessful?.status).toBe("SUCCESS");
  });

  it("selects nearest eligible successful scrape at or before the 7-day lookback target", () => {
    const now = Date.now();
    const scrapes: ScrapeItem[] = [
      {
        id: "today",
        status: "SUCCESS",
        contentHash: "hash-today",
        scrapedAt: new Date(now).toISOString(),
      },
      {
        id: "3-days-ago",
        status: "SUCCESS",
        contentHash: "hash-3d",
        scrapedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "8-days-ago",
        status: "SUCCESS",
        contentHash: "hash-8d",
        scrapedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "14-days-ago",
        status: "SUCCESS",
        contentHash: "hash-14d",
        scrapedAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const result = computeObservations(scrapes);
    expect(result.previousWeekly?.id).toBe("8-days-ago");
    expect(result.previousWeekly?.daysAgo).toBe(8);
    expect(result.previousWeekly?.contentChangedFromLatest).toBe(true);
  });

  it("returns null for previousWeekly when no scrape exists at or beyond 7 days", () => {
    const now = Date.now();
    const scrapes: ScrapeItem[] = [
      {
        id: "today",
        status: "SUCCESS",
        contentHash: "hash-today",
        scrapedAt: new Date(now).toISOString(),
      },
      {
        id: "2-days-ago",
        status: "SUCCESS",
        contentHash: "hash-2d",
        scrapedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const result = computeObservations(scrapes);
    expect(result.previousWeekly).toBeNull();
  });
});
