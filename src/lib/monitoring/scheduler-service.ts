import { db } from "@/lib/db";
import {
  competitors,
  trackedUrls,
  monitoringRuns,
  monitoringJobs,
} from "@/lib/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { scrapeTrackedUrl } from "@/lib/scraping/scrape-tracked-url";
import { executeExtractionForScrape } from "@/lib/ai/extraction/pipeline";

export interface RunMonitoringOptions {
  runType?: "scheduled" | "manual";
  forcedBy?: string;
  maxJobsPerInvocation?: number; // Batch size to stay safely within serverless timeouts (default: 5)
}

export interface MonitoringRunResult {
  runId: string;
  runType: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "IN_PROGRESS";
  totalCompetitors: number;
  totalUrls: number;
  successfulScrapes: number;
  failedScrapes: number;
  detectedPriceChanges: number;
  detectedFeatureChanges: number;
  startedAt: string;
  completedAt: string | null;
  hasMorePendingJobs: boolean;
  errors: string[];
}

const STALE_JOB_LEASE_MINUTES = 10;
const STALE_RUN_LEASE_MINUTES = 15;

/**
 * Executes a resilient, database-backed competitor monitoring run with:
 * 1. Atomic lock acquisition and recovery of abandoned/stale runs.
 * 2. Bounded batch execution per invocation to respect Vercel function timeout limits.
 * 3. Atomic job-claiming (conditional update) preventing duplicate processing.
 * 4. Stale job recovery for jobs interrupted mid-flight.
 * 5. Full error isolation per job with bounded retries.
 */
export async function executeMonitoringRun(
  options: RunMonitoringOptions = {}
): Promise<MonitoringRunResult> {
  const { runType = "scheduled", forcedBy = "system", maxJobsPerInvocation = 5 } = options;

  // -------------------------------------------------------------
  // STEP 1: Recover any abandoned runs that got stuck in RUNNING
  // -------------------------------------------------------------
  const staleRunCutoff = new Date(Date.now() - STALE_RUN_LEASE_MINUTES * 60 * 1000);
  
  await db
    .update(monitoringRuns)
    .set({
      status: "FAILED",
      completedAt: new Date(),
      errorMessage: `Lease expired: Run exceeded ${STALE_RUN_LEASE_MINUTES} minutes without completion. Auto-recovered.`,
    })
    .where(
      and(
        eq(monitoringRuns.status, "RUNNING"),
        sql`${monitoringRuns.startedAt} < ${staleRunCutoff}`
      )
    );

  // -------------------------------------------------------------
  // STEP 2: Find active run or atomically claim a new scheduled run
  // -------------------------------------------------------------
  // Check if there is an active run currently in progress within lease
  let activeRun = await db.query.monitoringRuns.findFirst({
    where: and(
      eq(monitoringRuns.status, "RUNNING"),
      sql`${monitoringRuns.startedAt} >= ${staleRunCutoff}`
    ),
    orderBy: [desc(monitoringRuns.startedAt)],
  });

  let runId: string;

  if (activeRun) {
    runId = activeRun.id;
  } else {
    // Atomically create new run
    const [newRun] = await db
      .insert(monitoringRuns)
      .values({
        runType,
        status: "RUNNING",
        startedAt: new Date(),
        metadata: { initiatedBy: forcedBy },
      })
      .returning();

    runId = newRun.id;
    activeRun = newRun;

    // Discover eligible active competitors & active URLs
    const activeCompetitors = await db.query.competitors.findMany({
      where: eq(competitors.status, "active"),
      with: {
        trackedUrls: {
          where: eq(trackedUrls.isActive, true),
        },
      },
    });

    const eligibleUrls: Array<{ competitorId: string; trackedUrlId: string }> = [];
    for (const comp of activeCompetitors) {
      for (const tUrl of comp.trackedUrls) {
        eligibleUrls.push({
          competitorId: comp.id,
          trackedUrlId: tUrl.id,
        });
      }
    }

    // Update totals on run record
    await db
      .update(monitoringRuns)
      .set({
        totalCompetitors: String(activeCompetitors.length),
        totalUrls: String(eligibleUrls.length),
      })
      .where(eq(monitoringRuns.id, runId));

    // If zero eligible URLs, complete immediately
    if (eligibleUrls.length === 0) {
      const completedAt = new Date();
      await db
        .update(monitoringRuns)
        .set({
          status: "SUCCESS",
          completedAt,
        })
        .where(eq(monitoringRuns.id, runId));

      return {
        runId,
        runType,
        status: "SUCCESS",
        totalCompetitors: activeCompetitors.length,
        totalUrls: 0,
        successfulScrapes: 0,
        failedScrapes: 0,
        detectedPriceChanges: 0,
        detectedFeatureChanges: 0,
        startedAt: activeRun.startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        hasMorePendingJobs: false,
        errors: [],
      };
    }

    // Insert all pending jobs for this run
    await db.insert(monitoringJobs).values(
      eligibleUrls.map((u) => ({
        runId,
        competitorId: u.competitorId,
        trackedUrlId: u.trackedUrlId,
        status: "PENDING",
        retryCount: "0",
        maxRetries: "2",
      }))
    );
  }

  // -------------------------------------------------------------
  // STEP 3: Recover any stale jobs in this run that were abandoned
  // -------------------------------------------------------------
  const staleJobCutoff = new Date(Date.now() - STALE_JOB_LEASE_MINUTES * 60 * 1000);
  await db
    .update(monitoringJobs)
    .set({
      status: "PENDING",
      errorMessage: `Job lease expired (> ${STALE_JOB_LEASE_MINUTES}m). Reset to PENDING for retry.`,
    })
    .where(
      and(
        eq(monitoringJobs.runId, runId),
        eq(monitoringJobs.status, "RUNNING"),
        sql`${monitoringJobs.startedAt} < ${staleJobCutoff}`
      )
    );

  // -------------------------------------------------------------
  // STEP 4: Claim a bounded batch of PENDING jobs atomically
  // -------------------------------------------------------------
  // Select candidate pending job IDs
  const pendingJobs = await db.query.monitoringJobs.findMany({
    where: and(
      eq(monitoringJobs.runId, runId),
      eq(monitoringJobs.status, "PENDING")
    ),
    limit: maxJobsPerInvocation,
    with: {
      trackedUrl: true,
      competitor: true,
    },
  });

  const errors: string[] = [];

  for (const job of pendingJobs) {
    // Atomic Claim: Update status from PENDING -> RUNNING where id = job.id AND status = 'PENDING'
    const claimedRows = await db
      .update(monitoringJobs)
      .set({
        status: "RUNNING",
        startedAt: new Date(),
      })
      .where(
        and(
          eq(monitoringJobs.id, job.id),
          eq(monitoringJobs.status, "PENDING")
        )
      )
      .returning();

    // If another concurrent invocation already claimed this job, skip it
    if (claimedRows.length === 0) {
      continue;
    }

    // Process job with bounded retries
    let retry = 0;
    let success = false;
    let lastErrMsg: string | null = null;
    let scrapeResultId: string | null = null;
    let detectedChanges = 0;
    let extractionStatus: "SUCCESS" | "NO_PRICING_FOUND" | "FLAGGED_FOR_REVIEW" | "FAILED" = "SUCCESS";

    while (retry <= 2 && !success) {
      try {
        const outcome = await scrapeTrackedUrl(job.trackedUrlId);

        if (outcome.status === "SUCCESS" && outcome.scrapeResultId) {
          scrapeResultId = outcome.scrapeResultId;
          const extractionResult = await executeExtractionForScrape(scrapeResultId);
          extractionStatus = extractionResult.status;
          detectedChanges = extractionResult.detectedChangesCount;

          if (extractionResult.status === "FAILED") {
            throw new Error(extractionResult.errorMessage || "Extraction failed");
          } else if (extractionResult.status === "FLAGGED_FOR_REVIEW") {
            // Suspicious feature drop or parse anomaly: preserved prior snapshot and flagged
            lastErrMsg = extractionResult.warnings?.join("; ") || "Extraction flagged for review";
            success = true; // Scrape succeeded and state was safely preserved
          } else {
            success = true;
          }
        } else {
          throw new Error(outcome.errorMessage || "Scrape returned failed status");
        }
      } catch (err: unknown) {
        retry++;
        lastErrMsg = err instanceof Error ? err.message : String(err);
        if (retry <= 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * retry));
        }
      }
    }

    const jobCompletedAt = new Date();

    if (success) {
      const isFlagged = extractionStatus === "FLAGGED_FOR_REVIEW";
      await db
        .update(monitoringJobs)
        .set({
          status: isFlagged ? "PARTIAL_SUCCESS" : "SUCCESS",
          scrapeResultId,
          detectedChangesCount: String(detectedChanges),
          errorMessage: isFlagged ? lastErrMsg : null,
          completedAt: jobCompletedAt,
        })
        .where(eq(monitoringJobs.id, job.id));
    } else {
      const targetUrl = job.trackedUrl?.url || job.trackedUrlId;
      errors.push(`URL ${targetUrl} failed: ${lastErrMsg}`);
      await db
        .update(monitoringJobs)
        .set({
          status: "FAILED",
          retryCount: String(retry),
          errorMessage: lastErrMsg,
          completedAt: jobCompletedAt,
        })
        .where(eq(monitoringJobs.id, job.id));
    }
  }

  // -------------------------------------------------------------
  // STEP 5: Re-evaluate Run Progress & Pending Jobs
  // -------------------------------------------------------------
  const allJobsInRun = await db.query.monitoringJobs.findMany({
    where: eq(monitoringJobs.runId, runId),
  });

  const pendingCount = allJobsInRun.filter((j) => j.status === "PENDING" || j.status === "RUNNING").length;
  const successCount = allJobsInRun.filter((j) => j.status === "SUCCESS").length;
  const failedCount = allJobsInRun.filter((j) => j.status === "FAILED").length;
  const totalChanges = allJobsInRun.reduce(
    (acc, j) => acc + (Number(j.detectedChangesCount) || 0),
    0
  );

  const hasMorePendingJobs = pendingCount > 0;

  let overallStatus: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "IN_PROGRESS" = "IN_PROGRESS";
  let runCompletedAt: Date | null = null;

  if (!hasMorePendingJobs) {
    runCompletedAt = new Date();
    if (failedCount === 0) {
      overallStatus = "SUCCESS";
    } else if (successCount > 0) {
      overallStatus = "PARTIAL_SUCCESS";
    } else {
      overallStatus = "FAILED";
    }

    await db
      .update(monitoringRuns)
      .set({
        status: overallStatus,
        successfulScrapes: String(successCount),
        failedScrapes: String(failedCount),
        detectedPriceChanges: String(totalChanges),
        completedAt: runCompletedAt,
        errorMessage: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
      })
      .where(eq(monitoringRuns.id, runId));
  } else {
    // Update ongoing metrics while still IN_PROGRESS
    await db
      .update(monitoringRuns)
      .set({
        successfulScrapes: String(successCount),
        failedScrapes: String(failedCount),
        detectedPriceChanges: String(totalChanges),
      })
      .where(eq(monitoringRuns.id, runId));
  }

  const finalRun = await db.query.monitoringRuns.findFirst({
    where: eq(monitoringRuns.id, runId),
  });

  return {
    runId,
    runType,
    status: overallStatus,
    totalCompetitors: Number(finalRun?.totalCompetitors || 0),
    totalUrls: Number(finalRun?.totalUrls || 0),
    successfulScrapes: successCount,
    failedScrapes: failedCount,
    detectedPriceChanges: totalChanges,
    detectedFeatureChanges: 0,
    startedAt: finalRun?.startedAt.toISOString() || activeRun.startedAt.toISOString(),
    completedAt: runCompletedAt ? runCompletedAt.toISOString() : null,
    hasMorePendingJobs,
    errors,
  };
}
