"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  RefreshCw,
  Play,
  History,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddCompetitorModal } from "@/components/competitors/add-competitor-modal";
import { EditCompetitorModal } from "@/components/competitors/edit-competitor-modal";
import { DeleteCompetitorModal } from "@/components/competitors/delete-competitor-modal";
import { ScrapesHistoryModal } from "@/components/competitors/scrapes-history-modal";

interface TrackedUrl {
  id: string;
  url: string;
  pageType: string;
  lastScannedAt: string | null;
  lastScanStatus: string | null;
  lastExtractionStatus: string | null;
  lastExtractedAt: string | null;
  lastExtractionError: string | null;
  lastExtractedPlanCount: string | null;
  lastExtractedFeatureCount: string | null;
}

interface CompetitorRecord {
  id: string;
  name: string;
  website: string;
  domain: string;
  industry?: string | null;
  description?: string | null;
  status?: string | null;
  createdAt: string;
  trackedUrls?: TrackedUrl[];
  pricingPlans?: Array<{
    id: string;
    planName: string;
    price: string | null;
    currency: string | null;
    billingPeriod: string;
  }>;
}

export function CompetitorsManager() {
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<CompetitorRecord | null>(null);
  const [deletingCompetitor, setDeletingCompetitor] = useState<{ id: string; name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  // Scanning & Extraction action states
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, string | null>>({});
  const [feedbackMap, setFeedbackMap] = useState<
    Record<string, { type: "success" | "warning" | "error"; message: string }>
  >({});

  // History modal state
  const [historyTarget, setHistoryTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const fetchCompetitors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/competitors");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch competitors");
      }
      setCompetitors(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load competitors");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();

    const handleCreated = () => {
      fetchCompetitors();
    };

    window.addEventListener("competitor-created", handleCreated);
    return () => window.removeEventListener("competitor-created", handleCreated);
  }, []);

  const handleToggleArchive = async (comp: CompetitorRecord) => {
    const isArchived = comp.status === "archived";
    const nextStatus = isArchived ? "active" : "archived";

    try {
      const res = await fetch(`/api/competitors/${comp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      fetchCompetitors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle archive status");
    }
  };

  const filteredCompetitors = competitors.filter((c) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "archived") return c.status === "archived";
    return c.status !== "archived";
  });

  const handleScanOnly = async (competitorId: string) => {
    setActionLoadingMap((prev) => ({ ...prev, [competitorId]: "scanning" }));
    setFeedbackMap((prev) => {
      const copy = { ...prev };
      delete copy[competitorId];
      return copy;
    });

    try {
      const res = await fetch(`/api/competitors/${competitorId}/scan`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Crawl failed");

      const s = json.data;
      setFeedbackMap((prev) => ({
        ...prev,
        [competitorId]: {
          type: s.successfulScrapes > 0 ? "success" : "error",
          message: `Scan complete: ${s.successfulScrapes} page(s) scraped.`,
        },
      }));
      fetchCompetitors();
    } catch (err: any) {
      setFeedbackMap((prev) => ({
        ...prev,
        [competitorId]: { type: "error", message: err.message },
      }));
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [competitorId]: null }));
    }
  };

  const handleExtractOnly = async (competitorId: string) => {
    setActionLoadingMap((prev) => ({ ...prev, [competitorId]: "extracting" }));
    setFeedbackMap((prev) => {
      const copy = { ...prev };
      delete copy[competitorId];
      return copy;
    });

    try {
      const res = await fetch(`/api/competitors/${competitorId}/extract`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI Extraction failed");

      const d = json.data;
      const failedResult = d.results?.find((r: any) => r.status === "FAILED");
      const noPricingResult = d.results?.find((r: any) => r.status === "NO_PRICING_FOUND");

      if (failedResult) {
        setFeedbackMap((prev) => ({
          ...prev,
          [competitorId]: {
            type: "error",
            message: `Extraction failed: ${failedResult.errorMessage || "Provider error"}. Please retry.`,
          },
        }));
      } else if (d.totalPlansExtracted === 0) {
        setFeedbackMap((prev) => ({
          ...prev,
          [competitorId]: {
            type: "warning",
            message: noPricingResult
              ? "Page was analyzed, but no supported pricing tables or plans were found."
              : "No pricing plans were extracted.",
          },
        }));
      } else {
        setFeedbackMap((prev) => ({
          ...prev,
          [competitorId]: {
            type: "success",
            message: `Extracted ${d.totalPlansExtracted} plan(s) & ${d.totalFeaturesExtracted} feature entitlements into database.`,
          },
        }));
      }
      fetchCompetitors();
    } catch (err: any) {
      setFeedbackMap((prev) => ({
        ...prev,
        [competitorId]: { type: "error", message: err.message },
      }));
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [competitorId]: null }));
    }
  };

  const handleFullPipeline = async (competitorId: string) => {
    setActionLoadingMap((prev) => ({ ...prev, [competitorId]: "pipeline" }));
    setFeedbackMap((prev) => {
      const copy = { ...prev };
      delete copy[competitorId];
      return copy;
    });

    try {
      const res = await fetch(`/api/competitors/${competitorId}/pipeline`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Pipeline failed");

      const d = json.data;
      const plansFound = d.extractionOutcomes.reduce(
        (acc: number, o: any) => acc + (o.extractedPlanCount || 0),
        0
      );
      setFeedbackMap((prev) => ({
        ...prev,
        [competitorId]: {
          type: "success",
          message: `Full run complete: Crawled + extracted ${plansFound} pricing plans.`,
        },
      }));
      fetchCompetitors();
    } catch (err: any) {
      setFeedbackMap((prev) => ({
        ...prev,
        [competitorId]: { type: "error", message: err.message },
      }));
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [competitorId]: null }));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Monitored Competitors
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated crawler ingestion with Groq LLM structured financial extraction.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status Filter Tabs */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                statusFilter === "all"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({competitors.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                statusFilter === "active"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({competitors.filter((c) => c.status !== "archived").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("archived")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                statusFilter === "archived"
                  ? "bg-white text-amber-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Archived ({competitors.filter((c) => c.status === "archived").length})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchCompetitors}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Competitor</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-28 bg-slate-100 rounded-t-lg" />
              <CardContent className="h-36 bg-slate-50" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-6 text-center text-sm text-rose-700">
            {error}
          </CardContent>
        </Card>
      ) : competitors.length === 0 ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              No Competitors Monitored Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              Get started by adding your first competitor to initiate live website scraping.
            </p>
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Your First Competitor</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompetitors.map((comp) => {
            const currentAction = actionLoadingMap[comp.id];
            const feedback = feedbackMap[comp.id];
            const primaryUrl = comp.trackedUrls?.[0];
            const lastScannedAt = primaryUrl?.lastScannedAt;
            const lastStatus = primaryUrl?.lastScanStatus;
            const extractionStatus = primaryUrl?.lastExtractionStatus;
            const extractionError = primaryUrl?.lastExtractionError;
            const activePlans = comp.pricingPlans || [];
            const isArchived = comp.status === "archived";

            // Derive accurate extraction badge
            let extractionBadgeText = "Pending Extract";
            let extractionBadgeColor = "text-slate-500 bg-slate-50 border-slate-200";

            if (currentAction === "extracting" || currentAction === "pipeline") {
              extractionBadgeText = "Extracting...";
              extractionBadgeColor = "text-indigo-600 bg-indigo-50 border-indigo-200 animate-pulse";
            } else if (activePlans.length > 0) {
              extractionBadgeText = "Normalized";
              extractionBadgeColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
            } else if (extractionStatus === "NO_PRICING_FOUND") {
              extractionBadgeText = "No Pricing Found";
              extractionBadgeColor = "text-amber-700 bg-amber-50 border-amber-200";
            } else if (extractionStatus === "FAILED") {
              extractionBadgeText = "Extraction Failed";
              extractionBadgeColor = "text-rose-700 bg-rose-50 border-rose-200";
            } else if (extractionStatus === "FLAGGED_FOR_REVIEW") {
              extractionBadgeText = "Review Required";
              extractionBadgeColor = "text-amber-700 bg-amber-50 border-amber-200";
            } else if (lastStatus === "FAILED") {
              extractionBadgeText = "Crawl Failed";
              extractionBadgeColor = "text-rose-700 bg-rose-50 border-rose-200";
            }

            return (
              <Card
                key={comp.id}
                className={`hover:border-slate-300 transition-colors flex flex-col justify-between ${
                  isArchived ? "opacity-75 bg-slate-50/60 border-dashed" : ""
                }`}
              >
                <div>
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-9 w-9 rounded-md flex items-center justify-center font-bold text-sm ${
                          isArchived ? "bg-slate-200 text-slate-600" : "bg-indigo-50 text-indigo-600"
                        }`}>
                          {comp.name.slice(0, 2).toUpperCase()}
                        </div>
                        {isArchived ? (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-[10px]">
                            Archived
                          </Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </div>

                      {/* Header Quick Actions: Edit, Archive, Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingCompetitor(comp)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit Competitor"
                          aria-label="Edit competitor"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(comp)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title={isArchived ? "Restore Competitor" : "Archive Competitor"}
                          aria-label={isArchived ? "Restore competitor" : "Archive competitor"}
                        >
                          {isArchived ? (
                            <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCompetitor({ id: comp.id, name: comp.name })}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Competitor Permanently"
                          aria-label="Delete competitor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <CardTitle className="mt-3 text-base flex items-center justify-between">
                      <Link
                        href={`/dashboard/competitors/${comp.id}`}
                        className="hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                      >
                        <span>{comp.name}</span>
                        <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {comp.industry || "General Industry"} • {comp.domain}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 text-xs">
                    {/* Live Extracted Plans Pill Matrix */}
                    <div>
                      <div className="flex items-center justify-between text-slate-500 mb-1.5">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">
                          Extracted Tiers ({activePlans.length})
                        </span>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${extractionBadgeColor}`}
                          title={extractionError || undefined}
                        >
                          {extractionBadgeText}
                        </span>
                      </div>

                      {activePlans.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {activePlans.map((p) => (
                            <span
                              key={p.id}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200"
                            >
                              {p.planName}:{" "}
                              <strong className="text-slate-900">
                                {p.price
                                  ? `${p.currency === "INR" || p.currency === "₹" ? "₹" : "$"}${Number(p.price).toLocaleString()}/${p.billingPeriod === "yearly" || p.billingPeriod === "annual" ? "year" : "month"}`
                                  : "Custom"}
                              </strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2.5 bg-slate-50 rounded-md border border-dashed border-slate-200 text-slate-400 text-center">
                          {extractionStatus === "FAILED"
                            ? `Extraction failed: ${extractionError || "Provider limit exceeded"}. Click "Extract with Groq" to retry.`
                            : extractionStatus === "NO_PRICING_FOUND"
                            ? "Page was analyzed, but no pricing tiers were found."
                            : 'No plans extracted yet. Click "Extract with Groq" below.'}
                        </div>
                      )}
                    </div>

                    {/* Metadata & Status */}
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>Tracked URLs: {comp.trackedUrls?.length || 1}</span>
                        {lastStatus && (
                          <Badge
                            variant={lastStatus === "SUCCESS" ? "success" : "destructive"}
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            Crawl: {lastStatus}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Last crawl: {lastScannedAt ? new Date(lastScannedAt).toLocaleString() : "Never"}
                      </div>
                    </div>

                    {/* Feedback alert */}
                    {feedback && (
                      <div
                        className={`p-2.5 rounded-md flex items-start gap-2 text-xs ${
                          feedback.type === "success"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : feedback.type === "warning"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {feedback.type === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : feedback.type === "warning" ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span className="leading-tight">{feedback.message}</span>
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Actions Grid Footer */}
                <div className="p-4 pt-0 border-t border-slate-100 space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1 gap-1"
                      disabled={!!currentAction || isArchived}
                      onClick={() => handleScanOnly(comp.id)}
                      title={isArchived ? "Restore competitor to run scans" : undefined}
                    >
                      {currentAction === "scanning" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      <span>{isArchived ? "Scan (Archived)" : "Scan"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1 gap-1 text-indigo-700 hover:text-indigo-800 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200"
                      disabled={!!currentAction || isArchived}
                      onClick={() => handleExtractOnly(comp.id)}
                    >
                      {currentAction === "extracting" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      ) : (
                        <Sparkles className="h-3 w-3 text-indigo-600" />
                      )}
                      <span>Extract (Groq)</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1 gap-1"
                      onClick={() => setHistoryTarget({ id: comp.id, name: comp.name })}
                    >
                      <History className="h-3 w-3 text-slate-400" />
                      <span>History</span>
                    </Button>

                    <Button
                      size="sm"
                      className="text-xs flex-1 gap-1"
                      disabled={!!currentAction || isArchived}
                      onClick={() => handleFullPipeline(comp.id)}
                    >
                      {currentAction === "pipeline" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Layers className="h-3 w-3" />
                          <span>Full Pipeline</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Competitor Modal */}
      <AddCompetitorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchCompetitors}
      />

      {/* Edit Competitor Modal */}
      <EditCompetitorModal
        isOpen={!!editingCompetitor}
        competitor={editingCompetitor}
        onClose={() => setEditingCompetitor(null)}
        onSuccess={fetchCompetitors}
      />

      {/* Delete Competitor Confirmation Modal */}
      <DeleteCompetitorModal
        isOpen={!!deletingCompetitor}
        competitor={deletingCompetitor}
        onClose={() => setDeletingCompetitor(null)}
        onSuccess={fetchCompetitors}
      />

      {/* Scrapes History & Raw Markdown viewer */}
      <ScrapesHistoryModal
        isOpen={!!historyTarget}
        competitorId={historyTarget?.id || null}
        competitorName={historyTarget?.name || ""}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
