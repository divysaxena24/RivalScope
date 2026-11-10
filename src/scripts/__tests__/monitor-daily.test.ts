import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateEnvironment,
  runDailyMonitoring,
  DailyMonitorRunnerOptions,
} from "../monitor-daily";
import * as schedulerModule from "../../lib/monitoring/scheduler-service";

describe("Daily Monitoring CLI Runner Unit & Multi-Batch Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Task 4 & Environment Validation", () => {
    it("throws descriptive error when DATABASE_URL is missing", () => {
      delete process.env.DATABASE_URL;
      process.env.FIRECRAWL_API_KEY = "mock-key";
      process.env.GROQ_API_KEY = "mock-key";

      expect(() => validateEnvironment()).toThrowError(/DATABASE_URL/);
    });

    it("throws descriptive error when FIRECRAWL_API_KEY is missing", () => {
      process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
      delete process.env.FIRECRAWL_API_KEY;
      process.env.GROQ_API_KEY = "mock-key";

      expect(() => validateEnvironment()).toThrowError(/FIRECRAWL_API_KEY/);
    });

    it("throws descriptive error when GROQ_API_KEY is missing", () => {
      process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
      process.env.FIRECRAWL_API_KEY = "mock-key";
      delete process.env.GROQ_API_KEY;

      expect(() => validateEnvironment()).toThrowError(/GROQ_API_KEY/);
    });

    it("passes validation without throwing when all required env vars are present", () => {
      process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
      process.env.FIRECRAWL_API_KEY = "fc-key";
      process.env.GROQ_API_KEY = "groq-key";

      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  describe("Task 3 & 6: Multi-Batch & URL Orchestration", () => {
    beforeEach(() => {
      process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
      process.env.FIRECRAWL_API_KEY = "fc-key";
      process.env.GROQ_API_KEY = "groq-key";
    });

    it("handles zero active competitors or zero eligible URLs cleanly in 1 batch", async () => {
      vi.spyOn(schedulerModule, "executeMonitoringRun").mockResolvedValueOnce({
        runId: "run-zero",
        runType: "scheduled",
        status: "SUCCESS",
        totalCompetitors: 0,
        totalUrls: 0,
        successfulScrapes: 0,
        failedScrapes: 0,
        detectedPriceChanges: 0,
        detectedFeatureChanges: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        hasMorePendingJobs: false,
        errors: [],
      });

      const result = await runDailyMonitoring({ batchSize: 5 });

      expect(result.status).toBe("SUCCESS");
      expect(result.totalBatchesProcessed).toBe(1);
      expect(result.totalUrls).toBe(0);
      expect(result.successfulScrapes).toBe(0);
      expect(result.failedScrapes).toBe(0);
    });

    it("handles exactly 1 tracked URL in a single batch", async () => {
      vi.spyOn(schedulerModule, "executeMonitoringRun").mockResolvedValueOnce({
        runId: "run-one-url",
        runType: "scheduled",
        status: "SUCCESS",
        totalCompetitors: 1,
        totalUrls: 1,
        successfulScrapes: 1,
        failedScrapes: 0,
        detectedPriceChanges: 1,
        detectedFeatureChanges: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        hasMorePendingJobs: false,
        errors: [],
      });

      const result = await runDailyMonitoring({ batchSize: 5 });

      expect(result.status).toBe("SUCCESS");
      expect(result.totalBatchesProcessed).toBe(1);
      expect(result.totalUrls).toBe(1);
      expect(result.successfulScrapes).toBe(1);
      expect(result.detectedPriceChanges).toBe(1);
    });

    it("handles more than five tracked URLs across multiple consecutive batches (e.g. 17 URLs in 4 batches)", async () => {
      // 17 URLs with batchSize = 5 -> Batch 1 (5), Batch 2 (5), Batch 3 (5), Batch 4 (2)
      const mockRun = vi
        .spyOn(schedulerModule, "executeMonitoringRun")
        .mockResolvedValueOnce({
          runId: "run-17-urls",
          runType: "scheduled",
          status: "IN_PROGRESS",
          totalCompetitors: 4,
          totalUrls: 17,
          successfulScrapes: 5,
          failedScrapes: 0,
          detectedPriceChanges: 0,
          detectedFeatureChanges: 0,
          startedAt: new Date().toISOString(),
          completedAt: null,
          hasMorePendingJobs: true,
          errors: [],
        })
        .mockResolvedValueOnce({
          runId: "run-17-urls",
          runType: "scheduled",
          status: "IN_PROGRESS",
          totalCompetitors: 4,
          totalUrls: 17,
          successfulScrapes: 10,
          failedScrapes: 0,
          detectedPriceChanges: 1,
          detectedFeatureChanges: 0,
          startedAt: new Date().toISOString(),
          completedAt: null,
          hasMorePendingJobs: true,
          errors: [],
        })
        .mockResolvedValueOnce({
          runId: "run-17-urls",
          runType: "scheduled",
          status: "IN_PROGRESS",
          totalCompetitors: 4,
          totalUrls: 17,
          successfulScrapes: 15,
          failedScrapes: 0,
          detectedPriceChanges: 2,
          detectedFeatureChanges: 0,
          startedAt: new Date().toISOString(),
          completedAt: null,
          hasMorePendingJobs: true,
          errors: [],
        })
        .mockResolvedValueOnce({
          runId: "run-17-urls",
          runType: "scheduled",
          status: "SUCCESS",
          totalCompetitors: 4,
          totalUrls: 17,
          successfulScrapes: 17,
          failedScrapes: 0,
          detectedPriceChanges: 3,
          detectedFeatureChanges: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          hasMorePendingJobs: false,
          errors: [],
        });

      const result = await runDailyMonitoring({ batchSize: 5 });

      expect(mockRun).toHaveBeenCalledTimes(4);
      expect(result.totalBatchesProcessed).toBe(4);
      expect(result.status).toBe("SUCCESS");
      expect(result.totalUrls).toBe(17);
      expect(result.successfulScrapes).toBe(17);
      expect(result.failedScrapes).toBe(0);
      expect(result.detectedPriceChanges).toBe(3);
    });

    it("isolates failure per URL so remaining URLs continue processing (PARTIAL_SUCCESS)", async () => {
      // Batch 1: 5 URLs, 1 fails, 4 succeed
      // Batch 2: 2 URLs, 2 succeed
      vi.spyOn(schedulerModule, "executeMonitoringRun")
        .mockResolvedValueOnce({
          runId: "run-with-failure",
          runType: "scheduled",
          status: "IN_PROGRESS",
          totalCompetitors: 2,
          totalUrls: 7,
          successfulScrapes: 4,
          failedScrapes: 1,
          detectedPriceChanges: 0,
          detectedFeatureChanges: 0,
          startedAt: new Date().toISOString(),
          completedAt: null,
          hasMorePendingJobs: true,
          errors: ["URL https://invalid.com/pricing failed: 404 Not Found"],
        })
        .mockResolvedValueOnce({
          runId: "run-with-failure",
          runType: "scheduled",
          status: "PARTIAL_SUCCESS",
          totalCompetitors: 2,
          totalUrls: 7,
          successfulScrapes: 6,
          failedScrapes: 1,
          detectedPriceChanges: 1,
          detectedFeatureChanges: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          hasMorePendingJobs: false,
          errors: ["URL https://invalid.com/pricing failed: 404 Not Found"],
        });

      const result = await runDailyMonitoring({ batchSize: 5 });

      expect(result.status).toBe("PARTIAL_SUCCESS");
      expect(result.totalBatchesProcessed).toBe(2);
      expect(result.successfulScrapes).toBe(6);
      expect(result.failedScrapes).toBe(1);
      expect(result.errors).toContain("URL https://invalid.com/pricing failed: 404 Not Found");
    });

    it("terminates with FAILED when all URLs fail or retry exhaustion occurs", async () => {
      vi.spyOn(schedulerModule, "executeMonitoringRun").mockResolvedValueOnce({
        runId: "run-all-fail",
        runType: "scheduled",
        status: "FAILED",
        totalCompetitors: 1,
        totalUrls: 2,
        successfulScrapes: 0,
        failedScrapes: 2,
        detectedPriceChanges: 0,
        detectedFeatureChanges: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        hasMorePendingJobs: false,
        errors: ["URL 1 failed after 2 retries", "URL 2 failed after 2 retries"],
      });

      const result = await runDailyMonitoring({ batchSize: 5 });

      expect(result.status).toBe("FAILED");
      expect(result.successfulScrapes).toBe(0);
      expect(result.failedScrapes).toBe(2);
      expect(result.errors.length).toBe(2);
    });

    it("respects safety timeout and halts processing without infinite loops", async () => {
      // Mock run that indefinitely returns IN_PROGRESS
      vi.spyOn(schedulerModule, "executeMonitoringRun").mockResolvedValue({
        runId: "run-timeout",
        runType: "scheduled",
        status: "IN_PROGRESS",
        totalCompetitors: 1,
        totalUrls: 100,
        successfulScrapes: 1,
        failedScrapes: 0,
        detectedPriceChanges: 0,
        detectedFeatureChanges: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        hasMorePendingJobs: true,
        errors: [],
      });

      // Pass overallTimeoutMs: 1ms
      const result = await runDailyMonitoring({
        batchSize: 1,
        overallTimeoutMs: 1,
      });

      expect(result.errors.some((e) => e.includes("Execution safety timeout exceeded"))).toBe(true);
    });

    it("supports controlled dry-run mode without database or scraping calls", async () => {
      const executeSpy = vi.spyOn(schedulerModule, "executeMonitoringRun");

      const result = await runDailyMonitoring({ dryRun: true });

      expect(executeSpy).not.toHaveBeenCalled();
      expect(result.status).toBe("DRY_RUN");
      expect(result.runId).toBe("dry-run");
    });
  });
});
