"use client";

import React, { useEffect, useState } from "react";
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SchedulerData {
  latestRun: {
    id: string;
    runType: string;
    status: string;
    totalCompetitors: number;
    totalUrls: number;
    successfulScrapes: number;
    failedScrapes: number;
    detectedPriceChanges: number;
    detectedFeatureChanges: number;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
    recentJobs: Array<{
      id: string;
      competitorName: string;
      url: string;
      status: string;
      changesCount: number;
      retryCount: number;
    }>;
  } | null;
  schedule: {
    frequency: string;
    nextScheduledRun: string;
  };
}

export function SchedulerVisibilityCard() {
  const [data, setData] = useState<SchedulerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState<string | null>(null);

  const fetchSchedulerStatus = async () => {
    try {
      const res = await fetch("/api/dashboard/scheduler-status");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch scheduler status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedulerStatus();
  }, []);

  const handleManualRunNow = async () => {
    setIsTriggering(true);
    setTriggerFeedback(null);
    try {
      const res = await fetch("/api/cron/daily-monitor", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to trigger run");
      }
      setTriggerFeedback("Monitoring run successfully executed!");
      fetchSchedulerStatus();
    } catch (err: unknown) {
      setTriggerFeedback(err instanceof Error ? err.message : "Run failed");
    } finally {
      setIsTriggering(false);
    }
  };

  const run = data?.latestRun;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold text-slate-900">
              Daily Automated Competitor Scheduler
            </CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase font-semibold text-indigo-700 bg-indigo-50 border-indigo-200">
              Vercel Cron Active
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-0.5">
            {data?.schedule.frequency || "Daily at 09:00 AM IST (03:30 AM UTC)"}
          </CardDescription>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isTriggering}
          onClick={handleManualRunNow}
          className="text-xs gap-1.5 self-start sm:self-auto shrink-0"
        >
          {isTriggering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3 w-3 text-indigo-600" />
          )}
          <span>{isTriggering ? "Running Pipeline..." : "Trigger Run Now"}</span>
        </Button>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {triggerFeedback && (
          <div className="p-2.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-medium">
            {triggerFeedback}
          </div>
        )}

        {isLoading ? (
          <div className="py-6 flex items-center justify-center text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>Loading telemetry...</span>
          </div>
        ) : !run ? (
          <div className="p-6 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
            <Clock className="h-6 w-6 text-slate-400 mx-auto" />
            <h4 className="text-xs font-semibold text-slate-800">No Scheduled Runs Recorded Yet</h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              The automated daily scheduler will execute at 09:00 AM IST. You can also trigger an immediate execution with "Trigger Run Now".
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top Telemetry Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Last Run Status
                </span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Badge
                    variant={
                      run.status === "SUCCESS"
                        ? "success"
                        : run.status === "PARTIAL_SUCCESS"
                        ? "outline"
                        : "destructive"
                    }
                    className="text-[10px] font-semibold"
                  >
                    {run.status}
                  </Badge>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  URLs Checked
                </span>
                <div className="text-sm font-bold text-slate-900">
                  {run.successfulScrapes} / {run.totalUrls}{" "}
                  <span className="text-[10px] font-normal text-slate-500">success</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Price Changes
                </span>
                <div className="text-sm font-bold text-indigo-600">
                  {run.detectedPriceChanges}{" "}
                  <span className="text-[10px] font-normal text-slate-500">detected</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Next Execution
                </span>
                <div className="text-xs font-semibold text-slate-800 truncate" title={data?.schedule.nextScheduledRun}>
                  {data?.schedule.nextScheduledRun
                    ? new Date(data.schedule.nextScheduledRun).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      }) + " (Tomorrow)"
                    : "Scheduled"}
                </div>
              </div>
            </div>

            {/* Run details */}
            <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>Executed: {new Date(run.startedAt).toLocaleString()}</span>
              <span>Competitors processed: {run.totalCompetitors}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
