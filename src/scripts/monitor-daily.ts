import * as dotenv from "dotenv";

// Load local environment for development if present (.env.local / .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

import { executeMonitoringRun, MonitoringRunResult } from "../lib/monitoring/scheduler-service";

export interface DailyMonitorRunnerOptions {
  batchSize?: number;
  maxConsecutiveBatches?: number;
  overallTimeoutMs?: number;
  forcedBy?: string;
  dryRun?: boolean;
}

export interface DailyMonitorRunnerResult {
  runId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "IN_PROGRESS" | "DRY_RUN";
  totalBatchesProcessed: number;
  totalCompetitors: number;
  totalUrls: number;
  successfulScrapes: number;
  failedScrapes: number;
  detectedPriceChanges: number;
  detectedFeatureChanges: number;
  startedAt: string;
  completedAt: string | null;
  errors: string[];
}

/**
 * Validates the required runtime environment variables.
 * Fails with a descriptive error message without logging or exposing any secret values.
 */
export function validateEnvironment(): void {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
    missing.push("DATABASE_URL");
  }
  if (!process.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY.trim() === "") {
    missing.push("FIRECRAWL_API_KEY");
  }
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
    missing.push("GROQ_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Please configure them before running the monitoring pipeline.`
    );
  }
}

/**
 * Executes the complete daily competitor monitoring pipeline across all batches.
 * Continues processing until every eligible job reaches terminal status (SUCCESS or FAILED),
 * an overall safety timeout is reached, or a batch limit guard triggers.
 */
export async function runDailyMonitoring(
  options: DailyMonitorRunnerOptions = {}
): Promise<DailyMonitorRunnerResult> {
  const {
    batchSize = 5,
    maxConsecutiveBatches = 50, // Prevents infinite loop while allowing up to 250 URLs
    overallTimeoutMs = 25 * 60 * 1000, // 25-minute guard (standard GitHub Actions job default)
    forcedBy = "github-actions-daily-runner",
    dryRun = false,
  } = options;

  console.log(`[RivalScope Daily Runner] Starting daily monitoring run at ${new Date().toISOString()}`);
  console.log(`[RivalScope Daily Runner] Config: batchSize=${batchSize}, maxBatches=${maxConsecutiveBatches}, dryRun=${dryRun}`);

  // 1. Environment validation
  validateEnvironment();

  if (dryRun) {
    console.log("[RivalScope Daily Runner] DRY RUN mode active: Verified environment variables without invoking database or scraping.");
    return {
      runId: "dry-run",
      status: "DRY_RUN",
      totalBatchesProcessed: 0,
      totalCompetitors: 0,
      totalUrls: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      detectedPriceChanges: 0,
      detectedFeatureChanges: 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      errors: [],
    };
  }

  const startTime = Date.now();
  let batchCount = 0;
  let lastOutcome: MonitoringRunResult | null = null;
  const allErrors: string[] = [];

  // 2. Loop through consecutive batches until no pending jobs remain
  while (batchCount < maxConsecutiveBatches) {
    // Check safety timeout
    if (Date.now() - startTime > overallTimeoutMs) {
      const timeoutMsg = `Execution safety timeout exceeded (${overallTimeoutMs / 1000}s). Stopping further batch processing.`;
      console.error(`[RivalScope Daily Runner] ${timeoutMsg}`);
      allErrors.push(timeoutMsg);
      break;
    }

    batchCount++;
    console.log(`[RivalScope Daily Runner] Invoking batch #${batchCount} (batchSize=${batchSize})...`);

    const outcome = await executeMonitoringRun({
      runType: "scheduled",
      forcedBy,
      maxJobsPerInvocation: batchSize,
    });

    lastOutcome = outcome;
    if (outcome.errors && outcome.errors.length > 0) {
      allErrors.push(...outcome.errors);
    }

    console.log(
      `[RivalScope Daily Runner] Batch #${batchCount} complete. Status=${outcome.status}, Success=${outcome.successfulScrapes}, Failed=${outcome.failedScrapes}, HasMorePending=${outcome.hasMorePendingJobs}`
    );

    // If no more pending jobs exist or run has reached terminal status, we are done
    if (!outcome.hasMorePendingJobs || outcome.status !== "IN_PROGRESS") {
      console.log(`[RivalScope Daily Runner] All eligible jobs have reached terminal states after ${batchCount} batch(es).`);
      break;
    }

    // Brief inter-batch breathing room (250ms)
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!lastOutcome) {
    throw new Error("[RivalScope Daily Runner] No monitoring run outcome was produced.");
  }

  const finalResult: DailyMonitorRunnerResult = {
    runId: lastOutcome.runId,
    status: lastOutcome.status,
    totalBatchesProcessed: batchCount,
    totalCompetitors: lastOutcome.totalCompetitors,
    totalUrls: lastOutcome.totalUrls,
    successfulScrapes: lastOutcome.successfulScrapes,
    failedScrapes: lastOutcome.failedScrapes,
    detectedPriceChanges: lastOutcome.detectedPriceChanges,
    detectedFeatureChanges: lastOutcome.detectedFeatureChanges,
    startedAt: lastOutcome.startedAt,
    completedAt: lastOutcome.completedAt,
    errors: Array.from(new Set(allErrors)),
  };

  console.log(`[RivalScope Daily Runner] ==========================================`);
  console.log(`[RivalScope Daily Runner] Run ID: ${finalResult.runId}`);
  console.log(`[RivalScope Daily Runner] Final Status: ${finalResult.status}`);
  console.log(`[RivalScope Daily Runner] Total Batches: ${finalResult.totalBatchesProcessed}`);
  console.log(`[RivalScope Daily Runner] Tracked URLs Processed: ${finalResult.successfulScrapes + finalResult.failedScrapes} / ${finalResult.totalUrls}`);
  console.log(`[RivalScope Daily Runner] Detected Price Changes: ${finalResult.detectedPriceChanges}`);
  console.log(`[RivalScope Daily Runner] ==========================================`);

  return finalResult;
}

/**
 * Direct CLI entry point when executed via tsx / node.
 */
if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.includes("monitor-daily"))) {
  const isDryRun = process.argv.includes("--dry-run");

  runDailyMonitoring({ dryRun: isDryRun })
    .then((result) => {
      // Exit 0 for SUCCESS or PARTIAL_SUCCESS (where some URLs had errors but run completed) or DRY_RUN
      if (result.status === "SUCCESS" || result.status === "PARTIAL_SUCCESS" || result.status === "DRY_RUN") {
        process.exit(0);
      } else {
        console.error(`[RivalScope Daily Runner] Run terminated with non-success status: ${result.status}`);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("[RivalScope Daily Runner] Fatal execution error:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
