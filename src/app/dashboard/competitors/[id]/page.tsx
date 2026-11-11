"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Globe,
  Calendar,
  Layers,
  Sparkles,
  Play,
  History,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  ShieldCheck,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrapesHistoryModal } from "@/components/competitors/scrapes-history-modal";
import { AddTrackedUrlModal } from "@/components/competitors/add-tracked-url-modal";
import { DeleteTrackedUrlModal } from "@/components/competitors/delete-tracked-url-modal";
import { EditCompetitorModal } from "@/components/competitors/edit-competitor-modal";
import { DeleteCompetitorModal } from "@/components/competitors/delete-competitor-modal";
import { Plus, Trash2, Edit2, Archive, RotateCcw } from "lucide-react";

interface TrackedUrl {
  id: string;
  url: string;
  pageType: string;
  isActive: boolean;
  lastScannedAt: string | null;
  lastScanStatus: string | null;
  createdAt: string;
}

interface PricingPlan {
  id: string;
  planName: string;
  description: string | null;
  price: string | null;
  currency: string | null;
  billingPeriod: string;
  isCustomPricing: boolean;
  isActive: boolean;
  features: string[];
  usageLimits: Record<string, unknown>;
  updatedAt: string;
}

interface ScrapeRecord {
  id: string;
  sourceUrl: string;
  pageTitle: string | null;
  status: string;
  errorMessage: string | null;
  contentHash: string;
  scrapedAt: string;
}

interface ChangeRecord {
  id: string;
  pricingPlanId: string | null;
  planName: string | null;
  changeType: string;
  fieldName: string | null;
  oldValue: any;
  newValue: any;
  absoluteDifference: string | null;
  percentageDifference: string | null;
  description: string;
  detectedAt: string;
}

interface CompetitorDetail {
  id: string;
  name: string;
  website: string;
  domain: string;
  industry: string | null;
  description: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
  trackedUrls: TrackedUrl[];
  pricingPlans: PricingPlan[];
}

export default function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [competitor, setCompetitor] = useState<CompetitorDetail | null>(null);
  const [scrapes, setScrapes] = useState<ScrapeRecord[]>([]);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [totalChanges, setTotalChanges] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  // Scrapes modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Tracked URL modals
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<TrackedUrl | null>(null);

  // Competitor management modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const loadCompetitorData = async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);

    try {
      // 1. Fetch competitor profile with tracked URLs & plans
      const res = await fetch(`/api/competitors/${id}`);
      const json = await res.json();

      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        throw new Error(json.error || "Failed to load competitor");
      }

      setCompetitor(json.data);

      // 2. Fetch scrape history
      try {
        const scrapeRes = await fetch(`/api/competitors/${id}/scrapes?limit=5`);
        const scrapeJson = await scrapeRes.json();
        if (scrapeJson.data) {
          setScrapes(scrapeJson.data);
        }
      } catch (e) {
        console.error("Failed to load scrape history:", e);
      }

      // 3. Fetch recent changes
      try {
        const changeRes = await fetch(`/api/dashboard/changes?competitorId=${id}&pageSize=5`);
        const changeJson = await changeRes.json();
        if (changeJson.success && changeJson.data) {
          setChanges(changeJson.data);
          setTotalChanges(changeJson.pagination?.totalRecords || 0);
        }
      } catch (e) {
        console.error("Failed to load changes:", e);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load competitor details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitorData();
  }, [id]);

  const handleScan = async () => {
    setActionLoading("scanning");
    setFeedback(null);
    try {
      const res = await fetch(`/api/competitors/${id}/scan`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");

      const s = json.data;
      setFeedback({
        type: s.successfulScrapes > 0 ? "success" : "error",
        message: `Scan finished: ${s.successfulScrapes} page(s) scraped successfully.`,
      });
      loadCompetitorData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtract = async () => {
    setActionLoading("extracting");
    setFeedback(null);
    try {
      const res = await fetch(`/api/competitors/${id}/extract`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Extraction failed");

      const d = json.data;
      if (d.totalPlansExtracted === 0) {
        setFeedback({
          type: "warning",
          message: "Groq LLM analyzed scraped content, but found no pricing tiers.",
        });
      } else {
        const countsSummary = d.summary
          ? ` (Model: ${d.summary.modelExtracted}, Validated: ${d.summary.validated}, Distinct: ${d.summary.distinctOfferings}, Persisted: ${d.summary.persisted})`
          : "";
        setFeedback({
          type: "success",
          message: `Extracted & persisted ${d.totalPlansExtracted} plan(s) and ${d.totalFeaturesExtracted} feature entitlements${countsSummary}.`,
        });
      }
      loadCompetitorData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleArchive = async () => {
    if (!competitor) return;
    const isArchived = competitor.status === "archived";
    const nextStatus = isArchived ? "active" : "archived";

    try {
      const res = await fetch(`/api/competitors/${competitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      loadCompetitorData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle archive status");
    }
  };

  const handlePipeline = async () => {
    setActionLoading("pipeline");
    setFeedback(null);
    try {
      const res = await fetch(`/api/competitors/${id}/pipeline`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Pipeline execution failed");

      const d = json.data;
      const plansCount = d.extractionOutcomes.reduce(
        (acc: number, o: any) => acc + (o.extractedPlanCount || 0),
        0
      );
      setFeedback({
        type: "success",
        message: `Full pipeline completed: Scraped pages and extracted ${plansCount} plans with change detection.`,
      });
      loadCompetitorData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded-md" />
        <div className="h-40 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Competitor Not Found</h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
          The competitor ID requested does not exist in RivalScope database or has been deleted.
        </p>
        <Link href="/dashboard/competitors">
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Competitors</span>
          </Button>
        </Link>
      </div>
    );
  }

  if (error || !competitor) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
          <XCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Failed to Load Competitor</h2>
        <p className="text-xs sm:text-sm text-rose-600 max-w-sm mx-auto">{error}</p>
        <Button onClick={loadCompetitorData} size="sm" className="gap-2 text-xs">
          <RefreshCw className="h-4 w-4" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  const primaryUrl = competitor.trackedUrls[0];
  const lastScanStatus = primaryUrl?.lastScanStatus;
  const lastScannedAt = primaryUrl?.lastScannedAt;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/competitors"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {competitor.name}
              </h1>
              {competitor.status === "archived" ? (
                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-xs">
                  Archived
                </Badge>
              ) : (
                <Badge variant="success" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{competitor.industry || "SaaS / Technology"}</span>
              <span>•</span>
              <a
                href={competitor.website}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1"
              >
                <span>{competitor.domain}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Competitor Edit / Archive / Delete Toolbar */}
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 mr-1">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded flex items-center gap-1"
              title="Edit Competitor"
            >
              <Edit2 className="h-3 w-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={handleToggleArchive}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-amber-600 hover:bg-slate-50 rounded flex items-center gap-1"
              title={competitor.status === "archived" ? "Restore Competitor" : "Archive Competitor"}
            >
              {competitor.status === "archived" ? (
                <>
                  <RotateCcw className="h-3 w-3 text-amber-600" />
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <Archive className="h-3 w-3" />
                  <span>Archive</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded flex items-center gap-1"
              title="Delete Competitor Permanently"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={!!actionLoading || competitor.status === "archived"}
            onClick={handleScan}
            className="text-xs gap-1.5"
          >
            {actionLoading === "scanning" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>{competitor.status === "archived" ? "Scan (Archived)" : "Scan Pages"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!!actionLoading || competitor.status === "archived"}
            onClick={handleExtract}
            className="text-xs gap-1.5 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200"
          >
            {actionLoading === "extracting" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            )}
            <span>Extract Pricing</span>
          </Button>

          <Button
            size="sm"
            disabled={!!actionLoading || competitor.status === "archived"}
            onClick={handlePipeline}
            className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            {actionLoading === "pipeline" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <Layers className="h-3.5 w-3.5" />
                <span>Full Pipeline</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : feedback.type === "warning"
              ? "bg-amber-50 text-amber-900 border border-amber-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === "warning" ? (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{feedback.message}</span>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-50/50">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Tracked URLs
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {competitor.trackedUrls.length}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {competitor.trackedUrls.filter((u) => u.isActive).length} active pages
          </span>
        </Card>

        <Card className="p-4 bg-slate-50/50">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Extracted Plans
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {competitor.pricingPlans.length}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {competitor.pricingPlans.filter((p) => p.isCustomPricing).length} custom tiers
          </span>
        </Card>

        <Card className="p-4 bg-slate-50/50">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Latest Crawl Status
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-lg font-bold capitalize text-slate-900">
              {lastScanStatus || "Never Scanned"}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
            {lastScannedAt ? new Date(lastScannedAt).toLocaleDateString() : "Pending"}
          </span>
        </Card>

        <Card className="p-4 bg-slate-50/50">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Detected Changes
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {totalChanges}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Tracked price variations
          </span>
        </Card>
      </div>

      {/* Extracted Pricing Plans Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Extracted Pricing Plans & Tiers
            </h2>
            <p className="text-xs text-slate-500">
              Normalized pricing records extracted by Groq LLM from the latest crawl Markdown.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {competitor.pricingPlans.length} Plans
          </Badge>
        </div>

        {competitor.pricingPlans.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <Layers className="h-6 w-6 text-slate-400 mx-auto" />
            <p className="text-xs font-medium text-slate-700">No Pricing Plans Stored</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Scan competitor pages and trigger Groq LLM extraction to populate structured pricing tiers.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExtract}
              disabled={!!actionLoading}
              className="text-xs mt-2"
            >
              <Sparkles className="h-3 w-3 mr-1 text-indigo-600" />
              <span>Extract Now</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {competitor.pricingPlans.map((plan) => (
              <Card key={plan.id} className="border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      {plan.planName}
                    </CardTitle>
                    <Badge variant={plan.isCustomPricing ? "outline" : "secondary"} className="text-[10px]">
                      {plan.isCustomPricing ? "Custom" : plan.price === "0.00" ? "Free" : "Fixed"}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <span className="text-xl font-bold text-slate-900">
                      {plan.isCustomPricing
                        ? "Contact Sales"
                        : plan.price !== null
                        ? `${plan.currency || "$"}${plan.price}`
                        : "Custom"}
                    </span>
                    {!plan.isCustomPricing && plan.price !== null && (
                      <span className="text-xs text-slate-400 ml-1">
                        / {plan.billingPeriod || "month"}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3 text-xs flex-1">
                  {plan.description && (
                    <p className="text-slate-600 line-clamp-2">{plan.description}</p>
                  )}

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Entitlements ({plan.features.length})
                    </span>
                    <ul className="space-y-1">
                      {plan.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-slate-700 flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{f}</span>
                        </li>
                      ))}
                      {plan.features.length > 4 && (
                        <li className="text-[11px] text-slate-400 font-medium pl-5">
                          +{plan.features.length - 4} more features
                        </li>
                      )}
                    </ul>
                  </div>

                  {plan.usageLimits && Object.keys(plan.usageLimits).length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Usage Limits
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(plan.usageLimits).slice(0, 2).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono"
                          >
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Tracked URLs Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tracked Pages</h2>
            <p className="text-xs text-slate-500">
              Web endpoints monitored by the Firecrawl scraping engine.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsAddUrlModalOpen(true)}
            className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add URL</span>
          </Button>
        </div>

        <Card className="overflow-hidden border border-slate-200/90 shadow-xs">
          {competitor.trackedUrls.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 space-y-2">
              <Globe className="h-6 w-6 text-slate-400 mx-auto" />
              <p className="text-xs font-medium text-slate-700">No Tracked URLs Registered</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Add your first page URL to begin monitoring pricing tables and feature updates.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddUrlModalOpen(true)}
                className="text-xs mt-2 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-600" />
                <span>Add Tracked URL</span>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="p-3.5">URL</th>
                    <th className="p-3.5">Page Type</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Last Scanned</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {competitor.trackedUrls.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-3.5 font-medium text-slate-900 max-w-sm truncate">
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1.5 truncate"
                        >
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{u.url}</span>
                        </a>
                      </td>
                      <td className="p-3.5 text-slate-600 capitalize">
                        {u.pageType || "Pricing"}
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={u.lastScanStatus === "SUCCESS" ? "success" : "secondary"}
                          className="text-[10px] uppercase font-semibold"
                        >
                          {u.lastScanStatus || "Pending"}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-slate-400 text-xs">
                        {u.lastScannedAt
                          ? new Date(u.lastScannedAt).toLocaleString()
                          : "Never"}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setUrlToDelete(u)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Remove Tracked URL"
                          aria-label={`Remove URL ${u.url}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Two-Column Bottom Grid: Scrape History & Recent Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scrape History Section */}
        <Card className="border border-slate-200/90 shadow-xs">
          <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Recent Crawl Activity
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Firecrawl ingestion observations & SHA-256 hashes
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryModalOpen(true)}
              className="text-xs h-7 px-2.5 gap-1"
            >
              <History className="h-3 w-3" />
              <span>Full History</span>
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {scrapes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No scraping history recorded yet.
              </div>
            ) : (
              scrapes.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 truncate max-w-[240px]">
                    <span className="font-semibold text-slate-900 block truncate">
                      {s.pageTitle || s.sourceUrl}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono block truncate">
                      Hash: {s.contentHash.slice(0, 12)}...
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={s.status === "SUCCESS" ? "success" : "destructive"}
                      className="text-[10px] uppercase block"
                    >
                      {s.status}
                    </Badge>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {new Date(s.scrapedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Detected Changes */}
        <Card className="border border-slate-200/90 shadow-xs">
          <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Recent Detected Changes
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Deterministic price & feature diffs
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {changes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No changes detected for this competitor.
              </div>
            ) : (
              changes.map((ch) => {
                const isIncrease = ch.changeType === "price_increase";
                const isDecrease = ch.changeType === "price_decrease";

                return (
                  <div
                    key={ch.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 truncate max-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">
                          {ch.planName || "Plan"}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                          {ch.changeType.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {ch.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {ch.percentageDifference ? (
                        <span
                          className={`text-xs font-bold block ${
                            isIncrease
                              ? "text-rose-600"
                              : isDecrease
                              ? "text-emerald-600"
                              : "text-slate-800"
                          }`}
                        >
                          {parseFloat(ch.percentageDifference) > 0 ? "+" : ""}
                          {ch.percentageDifference}%
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono block">
                          {ch.fieldName || "Updated"}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {new Date(ch.detectedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scrapes History Modal */}
      <ScrapesHistoryModal
        isOpen={isHistoryModalOpen}
        competitorId={competitor.id}
        competitorName={competitor.name}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Add Tracked URL Modal */}
      <AddTrackedUrlModal
        isOpen={isAddUrlModalOpen}
        competitorId={competitor.id}
        competitorName={competitor.name}
        onClose={() => setIsAddUrlModalOpen(false)}
        onSuccess={loadCompetitorData}
      />

      {/* Delete Tracked URL Confirmation Modal */}
      <DeleteTrackedUrlModal
        isOpen={!!urlToDelete}
        trackedUrl={urlToDelete}
        onClose={() => setUrlToDelete(null)}
        onSuccess={loadCompetitorData}
      />

      {/* Edit Competitor Modal */}
      <EditCompetitorModal
        isOpen={isEditModalOpen}
        competitor={competitor}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={loadCompetitorData}
      />

      {/* Delete Competitor Confirmation Modal */}
      <DeleteCompetitorModal
        isOpen={isDeleteModalOpen}
        competitor={competitor}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={() => {
          router.push("/dashboard/competitors");
        }}
      />
    </div>
  );
}
