import { describe, it, expect, vi } from "vitest";

describe("Daily Automated Competitor Monitoring Scheduler Tests", () => {
  describe("Cron Authentication & Fail-Closed Guarding", () => {
    function verifyCronAuth(
      authHeader: string | null,
      cronSecret: string | undefined,
      isProduction: boolean,
      host: string = "localhost:3000"
    ): { allowed: boolean; status: number; message?: string } {
      if (isProduction || cronSecret) {
        if (!cronSecret) {
          return { allowed: false, status: 500, message: "Missing secret in production" };
        }
        if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
          return { allowed: false, status: 401, message: "Unauthorized" };
        }
        return { allowed: true, status: 200 };
      } else {
        const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
        if (!isLocal) {
          return { allowed: false, status: 401, message: "Unauthorized non-local" };
        }
        return { allowed: true, status: 200 };
      }
    }

    it("rejects request when CRON_SECRET is set but Authorization header is missing", () => {
      const res = verifyCronAuth(null, "super-secret-key", true);
      expect(res.allowed).toBe(false);
      expect(res.status).toBe(401);
    });

    it("rejects request with invalid token in Authorization header", () => {
      const res = verifyCronAuth("Bearer invalid-secret", "super-secret-key", true);
      expect(res.allowed).toBe(false);
      expect(res.status).toBe(401);
    });

    it("allows request with valid matching Bearer token in production", () => {
      const res = verifyCronAuth("Bearer super-secret-key", "super-secret-key", true);
      expect(res.allowed).toBe(true);
      expect(res.status).toBe(200);
    });

    it("fails closed in production if CRON_SECRET is missing from environment", () => {
      const res = verifyCronAuth("Bearer any", undefined, true);
      expect(res.allowed).toBe(false);
      expect(res.status).toBe(500);
    });

    it("rejects remote non-localhost requests when CRON_SECRET is undefined in dev", () => {
      const res = verifyCronAuth(null, undefined, false, "rivalscope.vercel.app");
      expect(res.allowed).toBe(false);
      expect(res.status).toBe(401);
    });
  });

  describe("Active Competitor & Tracked URL Filtering", () => {
    interface CompetitorMock {
      id: string;
      name: string;
      status: "active" | "archived";
      trackedUrls: Array<{ id: string; url: string; isActive: boolean }>;
    }

    function filterEligibleUrls(comps: CompetitorMock[]) {
      // Must only schedule active competitors and active tracked URLs
      const activeCompetitors = comps.filter((c) => c.status === "active");
      const eligibleUrls: Array<{ competitorId: string; urlId: string; url: string }> = [];

      for (const comp of activeCompetitors) {
        for (const t of comp.trackedUrls) {
          if (t.isActive) {
            eligibleUrls.push({
              competitorId: comp.id,
              urlId: t.id,
              url: t.url,
            });
          }
        }
      }

      return { activeCompetitorsCount: activeCompetitors.length, eligibleUrls };
    }

    it("skips archived competitors even if their URLs are flagged active", () => {
      const mockComps: CompetitorMock[] = [
        {
          id: "comp-1",
          name: "Archived SaaS",
          status: "archived",
          trackedUrls: [{ id: "url-1", url: "https://archived.com/pricing", isActive: true }],
        },
        {
          id: "comp-2",
          name: "Active SaaS",
          status: "active",
          trackedUrls: [{ id: "url-2", url: "https://active.com/pricing", isActive: true }],
        },
      ];

      const { activeCompetitorsCount, eligibleUrls } = filterEligibleUrls(mockComps);
      expect(activeCompetitorsCount).toBe(1);
      expect(eligibleUrls).toHaveLength(1);
      expect(eligibleUrls[0].competitorId).toBe("comp-2");
    });

    it("skips inactive URLs for active competitors", () => {
      const mockComps: CompetitorMock[] = [
        {
          id: "comp-1",
          name: "Active SaaS",
          status: "active",
          trackedUrls: [
            { id: "url-1", url: "https://active.com/pricing", isActive: true },
            { id: "url-2", url: "https://active.com/features", isActive: false },
          ],
        },
      ];

      const { eligibleUrls } = filterEligibleUrls(mockComps);
      expect(eligibleUrls).toHaveLength(1);
      expect(eligibleUrls[0].urlId).toBe("url-1");
    });
  });

  describe("Scheduler Lock Lease & Recovery", () => {
    const STALE_RUN_LEASE_MINUTES = 15;

    function evaluateRunLease(run: { status: string; startedAt: Date }, now: Date): {
      isStale: boolean;
      canProceed: boolean;
    } {
      if (run.status !== "RUNNING") {
        return { isStale: false, canProceed: true };
      }
      const ageMinutes = (now.getTime() - run.startedAt.getTime()) / (1000 * 60);
      if (ageMinutes >= STALE_RUN_LEASE_MINUTES) {
        return { isStale: true, canProceed: true }; // Stale: auto-recovered
      }
      return { isStale: false, canProceed: false }; // Still active within lease
    }

    it("permits new run or batch if previous run completed with SUCCESS", () => {
      const now = new Date();
      const lastRun = {
        status: "SUCCESS",
        startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      };

      const res = evaluateRunLease(lastRun, now);
      expect(res.canProceed).toBe(true);
    });

    it("blocks new run if an existing run is actively RUNNING within the 15-minute lease", () => {
      const now = new Date();
      const lastRun = {
        status: "RUNNING",
        startedAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
      };

      const res = evaluateRunLease(lastRun, now);
      expect(res.canProceed).toBe(false);
      expect(res.isStale).toBe(false);
    });

    it("auto-recovers and permits execution if RUNNING run exceeded 15-minute lease", () => {
      const now = new Date();
      const lastRun = {
        status: "RUNNING",
        startedAt: new Date(now.getTime() - 16 * 60 * 1000), // 16 min ago
      };

      const res = evaluateRunLease(lastRun, now);
      expect(res.canProceed).toBe(true);
      expect(res.isStale).toBe(true);
    });
  });

  describe("Next Scheduled Execution Calculation (09:00 AM IST / 03:30 AM UTC)", () => {
    function computeNextScheduledRun(now: Date): Date {
      const nextCron = new Date(now);
      nextCron.setUTCHours(3, 30, 0, 0);
      if (now.getTime() >= nextCron.getTime()) {
        nextCron.setUTCDate(nextCron.getUTCDate() + 1);
      }
      return nextCron;
    }

    it("schedules for today at 03:30 UTC if current time is before 03:30 UTC", () => {
      // 02:00 AM UTC (07:30 AM IST)
      const now = new Date("2026-11-09T02:00:00.000Z");
      const next = computeNextScheduledRun(now);
      expect(next.toISOString()).toBe("2026-11-09T03:30:00.000Z");
    });

    it("schedules for tomorrow at 03:30 UTC if current time is after 03:30 UTC", () => {
      // 04:00 AM UTC (09:30 AM IST)
      const now = new Date("2026-11-09T04:00:00.000Z");
      const next = computeNextScheduledRun(now);
      expect(next.toISOString()).toBe("2026-11-10T03:30:00.000Z");
    });
  });

  describe("Batching & Resumable Job Execution", () => {
    it("slices eligible jobs to bounded maxJobsPerInvocation", () => {
      const allJobs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const maxJobs = 5;
      const batch = allJobs.slice(0, maxJobs);
      expect(batch).toHaveLength(5);
      expect(allJobs.length - batch.length).toBe(5);
    });

    it("correctly identifies when more pending jobs remain", () => {
      const jobs = [
        { id: "1", status: "SUCCESS" },
        { id: "2", status: "SUCCESS" },
        { id: "3", status: "PENDING" },
      ];
      const hasPending = jobs.some((j) => j.status === "PENDING" || j.status === "RUNNING");
      expect(hasPending).toBe(true);
    });
  });
});
