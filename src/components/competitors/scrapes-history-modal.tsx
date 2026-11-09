"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Hash,
  Loader2,
  Clock,
  ArrowRight,
  GitCompare,
  TrendingUp,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScrapeRecord {
  id: string;
  sourceUrl: string;
  pageTitle: string | null;
  contentHash: string;
  status: "SUCCESS" | "FAILED";
  errorMessage: string | null;
  scrapedAt: string;
  trackedUrl?: { pageType: string };
}

interface ScrapesModalProps {
  competitorId: string | null;
  competitorName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ScrapesHistoryModal({
  competitorId,
  competitorName,
  isOpen,
  onClose,
}: ScrapesModalProps) {
  const [history, setHistory] = useState<ScrapeRecord[]>([]);
  const [summary, setSummary] = useState<{
    latestSuccessful: any | null;
    previousWeekly: any | null;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScrape, setSelectedScrape] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Scrape comparison state
  const [comparison, setComparison] = useState<any | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  useEffect(() => {
    if (isOpen && competitorId) {
      loadHistory(competitorId);
    } else {
      setHistory([]);
      setSummary(null);
      setSelectedScrape(null);
      setComparison(null);
    }
  }, [isOpen, competitorId, statusFilter]);

  const loadHistory = async (id: string) => {
    setIsLoading(true);
    try {
      const filterParam = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";
      const res = await fetch(`/api/competitors/${id}/scrapes?limit=30${filterParam}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setHistory(json.data.history || []);
        if (json.data.summary) {
          setSummary(json.data.summary);
        }
      }
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScrapeDetails = async (scrapeId: string) => {
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/scrapes/${scrapeId}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setSelectedScrape(json.data);
        setComparison(null);
      }
    } catch {
      setSelectedScrape(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const loadComparison = async (baseId: string, compareId: string) => {
    setIsLoadingCompare(true);
    try {
      const res = await fetch(`/api/scrapes/compare?baseId=${baseId}&compareId=${compareId}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setComparison(json.data);
        setSelectedScrape(null);
      }
    } catch (err: unknown) {
      alert("Failed to compare scrape observations");
    } finally {
      setIsLoadingCompare(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Scraping History & Observations — {competitorName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical crawl logs, latest observation, and weekly lookback comparison
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Comparison View */}
          {comparison ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setComparison(null)}
                  className="text-xs"
                >
                  ← Back to Scrape History
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant={comparison.contentChanged ? "destructive" : "success"}>
                    {comparison.contentChanged ? "Page Content Changed" : "Content Identical"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Older Observation */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Earlier Observation
                  </span>
                  <div className="text-xs font-semibold text-slate-900">
                    {new Date(comparison.older.scrapedAt).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono break-all">
                    Hash: {comparison.older.contentHash}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Size: {comparison.older.charCount.toLocaleString()} chars • {comparison.older.lineCount} lines
                  </div>
                </div>

                {/* Newer Observation */}
                <div className="p-4 rounded-xl border border-slate-200 bg-indigo-50/30 space-y-2">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                    Latest Observation
                  </span>
                  <div className="text-xs font-semibold text-slate-900">
                    {new Date(comparison.newer.scrapedAt).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono break-all">
                    Hash: {comparison.newer.contentHash}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Size: {comparison.newer.charCount.toLocaleString()} chars • {comparison.newer.lineCount} lines
                  </div>
                </div>
              </div>

              {/* Differences Summary */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                <h4 className="font-semibold text-slate-900">Observation Comparison Summary</h4>
                <p className="text-slate-600 leading-relaxed">
                  {comparison.contentChanged ? (
                    <>
                      The HTML/Markdown document content changed between these two crawl snapshots.
                      Difference in content length:{" "}
                      <strong>
                        {comparison.differenceSummary.contentLengthDiff > 0 ? "+" : ""}
                        {comparison.differenceSummary.contentLengthDiff.toLocaleString()} characters
                      </strong>{" "}
                      ({comparison.differenceSummary.lineCountDiff > 0 ? "+" : ""}
                      {comparison.differenceSummary.lineCountDiff} lines).
                    </>
                  ) : (
                    <>
                      The cryptographic SHA-256 hash of both captures is identical. The target webpage content was unchanged between observations.
                    </>
                  )}
                </p>
                <div className="text-[11px] text-slate-400 italic pt-1">
                  Note: A content change indicates DOM/text modification on the competitor website. Detected pricing plan changes are evaluated separately during extraction.
                </div>
              </div>
            </div>
          ) : selectedScrape ? (
            /* Scrape Detail View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedScrape(null)}
                  className="text-xs"
                >
                  ← Back to History List
                </Button>
                <Badge
                  variant={selectedScrape.status === "SUCCESS" ? "success" : "destructive"}
                >
                  {selectedScrape.status}
                </Badge>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  {selectedScrape.pageTitle || "Untitled Page"}
                </div>
                <div className="text-slate-500 break-all">{selectedScrape.sourceUrl}</div>
                <div className="text-[11px] text-slate-400 font-mono pt-1">
                  SHA-256 Hash: {selectedScrape.contentHash || "N/A"}
                </div>
              </div>

              {selectedScrape.errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                  {selectedScrape.errorMessage}
                </div>
              )}

              {selectedScrape.markdownContent && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">
                    Scraped Markdown Output
                  </h4>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-80 whitespace-pre-wrap">
                    {selectedScrape.markdownContent}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* Main List & Two Prominent Summary Cards */
            <>
              {/* Two Observation Summaries: Latest & Previous Weekly */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Latest Successful Scrape */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Latest Successful Scrape
                      </span>
                      {summary?.latestSuccessful && (
                        <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4">
                          Live
                        </Badge>
                      )}
                    </div>

                    {summary?.latestSuccessful ? (
                      <div>
                        <div className="text-sm font-bold text-slate-900 mt-1">
                          {new Date(summary.latestSuccessful.scrapedAt).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                          Hash: {summary.latestSuccessful.contentHash.slice(0, 16)}...
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          {summary.latestSuccessful.contentChanged ? (
                            <span className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
                              • Content changed vs preceding observation
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                              • Unchanged from preceding observation
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-2">
                        No successful scrape has been recorded yet.
                      </p>
                    )}
                  </div>

                  {summary?.latestSuccessful && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs w-full"
                      onClick={() => loadScrapeDetails(summary.latestSuccessful.id)}
                    >
                      View Latest Markdown
                    </Button>
                  )}
                </div>

                {/* Previous Weekly Observation */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Previous Weekly Observation (7d Lookback)
                      </span>
                      {summary?.previousWeekly && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-indigo-700 border-indigo-200">
                          ~{summary.previousWeekly.daysAgo}d ago
                        </Badge>
                      )}
                    </div>

                    {summary?.previousWeekly ? (
                      <div>
                        <div className="text-sm font-bold text-slate-900 mt-1">
                          {new Date(summary.previousWeekly.scrapedAt).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                          Hash: {summary.previousWeekly.contentHash.slice(0, 16)}...
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          {summary.previousWeekly.contentChangedFromLatest ? (
                            <span className="text-amber-600 font-medium">
                              Content differences detected across weekly interval
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">
                              Content identical to current latest observation
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 font-medium">
                          No eligible weekly observation found (≥ 7 days old).
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Observations must be at least 7 days older than the latest crawl to qualify as a weekly lookback baseline.
                        </p>
                      </div>
                    )}
                  </div>

                  {summary?.previousWeekly && summary?.latestSuccessful && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs w-full gap-1.5 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200"
                      onClick={() =>
                        loadComparison(summary.previousWeekly.id, summary.latestSuccessful.id)
                      }
                      disabled={isLoadingCompare}
                    >
                      <GitCompare className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Compare Weekly vs Latest</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Complete Paginated Scrape History */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Complete Crawl History Timeline ({history.length} records)
                  </h3>

                  {/* Status Filter */}
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ALL")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        statusFilter === "ALL"
                          ? "bg-white text-indigo-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("SUCCESS")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        statusFilter === "SUCCESS"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Successful
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("FAILED")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        statusFilter === "FAILED"
                          ? "bg-white text-rose-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Failed
                    </button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span className="text-xs">Loading crawl records...</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No Scrape Records Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Run a scan on this competitor to capture pricing HTML/Markdown.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {history.map((record, index) => {
                      const precedingRecord = history[index + 1];
                      const contentChanged =
                        precedingRecord &&
                        record.status === "SUCCESS" &&
                        precedingRecord.status === "SUCCESS"
                          ? record.contentHash !== precedingRecord.contentHash
                          : false;

                      return (
                        <div
                          key={record.id}
                          className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="space-y-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={record.status === "SUCCESS" ? "success" : "destructive"}
                                className="text-[10px] px-1.5 py-0 h-4"
                              >
                                {record.status}
                              </Badge>
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {record.pageTitle || record.sourceUrl}
                              </span>
                              {contentChanged && (
                                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0 rounded font-medium">
                                  Content Modified
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span>{new Date(record.scrapedAt).toLocaleString()}</span>
                              {record.contentHash && (
                                <span className="font-mono text-[10px]">
                                  hash: {record.contentHash.slice(0, 12)}...
                                </span>
                              )}
                            </div>
                            {record.errorMessage && (
                              <p className="text-xs text-rose-600">{record.errorMessage}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {summary?.latestSuccessful &&
                              record.id !== summary.latestSuccessful.id &&
                              record.status === "SUCCESS" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                  onClick={() =>
                                    loadComparison(record.id, summary.latestSuccessful.id)
                                  }
                                >
                                  Compare vs Latest
                                </Button>
                              )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => loadScrapeDetails(record.id)}
                              disabled={isLoadingDetails}
                            >
                              View Output
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
