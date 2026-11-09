"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  BrainCircuit,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Filter,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ActionPlaybook {
  product: string[];
  pricing: string[];
  marketing: string[];
  sales: string[];
}

interface EvidenceItem {
  claim: string;
  sourceType: string;
  sourceReference?: string;
  observedValue?: string;
  previousValue?: string;
}

interface AIInsightRecord {
  id: string;
  competitorId: string | null;
  competitorName: string | null;
  category: string;
  title: string;
  summary: string;
  impact: "high" | "medium" | "low";
  marketPosture?: "aggressive" | "defensive" | "neutral" | "expansionary";
  strategicImplications?: string[];
  actionPlaybook?: ActionPlaybook;
  evidenceList?: EvidenceItem[];
  confidence?: number;
  createdAt: string;
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<AIInsightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [impactFilter, setImpactFilter] = useState<string>("all");

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = impactFilter !== "all" 
        ? `/api/insights?impact=${impactFilter}` 
        : `/api/insights`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load insights");
      setInsights(data.insights || []);
    } catch (err: any) {
      setError(err.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [impactFilter]);

  const handleGenerateMarketInsights = async () => {
    setGenerating(true);
    setStatusMessage("Analyzing stored competitor snapshots, diffs & extracting strategic patterns via Groq LLM...");
    setError(null);

    try {
      const res = await fetch("/api/insights/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate market insights");

      setStatusMessage(
        `Analysis complete! Generated ${data.insightsGenerated} strategic insights grounded in ${data.dataCoverage?.plansCount || 0} plans and ${data.dataCoverage?.changesCount || 0} historical changes.`
      );
      await fetchInsights();
    } catch (err: any) {
      setError(err.message || "Error generating strategic intelligence");
    } finally {
      setGenerating(false);
    }
  };

  const getImpactBadgeVariant = (impact: string) => {
    switch (impact.toLowerCase()) {
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-2">
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>Groq LLM Strategic Intelligence Engine</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Synthesized Competitive Insights
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Grounded intelligence deductions, unbundled feature alerts, and counter-positioning playbooks generated from historical crawl diffs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateMarketInsights}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold flex items-center gap-2"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Market Insights</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs sm:text-sm text-indigo-900 flex items-start gap-3">
          <BrainCircuit className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-indigo-950">Synthesis Status</p>
            <p className="mt-0.5 text-indigo-800">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs sm:text-sm text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-950">Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Filter controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-medium">Filter Impact:</span>
          {["all", "high", "medium", "low"].map((level) => (
            <button
              key={level}
              onClick={() => setImpactFilter(level)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                impactFilter === level
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          Showing {insights.length} insight{insights.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Insights Stream */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-medium text-slate-600">Retrieving strategic intelligence from database...</p>
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/60 rounded-xl border border-dashed border-slate-300 space-y-4">
          <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-900">No Strategic Insights Available Yet</h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              Click &quot;Generate Market Insights&quot; above to synthesize executive takeaways from your scraped competitor plans and detected change history.
            </p>
          </div>
          <Button
            onClick={handleGenerateMarketInsights}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate Now
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {insights.map((insight) => (
            <Card
              key={insight.id}
              className="border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors overflow-hidden"
            >
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {(insight.competitorName || "MK").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block leading-tight">
                        {insight.title}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {insight.competitorName || "Market-Wide"} •{" "}
                        {new Date(insight.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Badge
                      variant={getImpactBadgeVariant(insight.impact)}
                      className="uppercase text-[10px] tracking-wider font-semibold"
                    >
                      {insight.impact} impact
                    </Badge>
                    <Badge variant="outline" className="capitalize text-xs font-normal">
                      {insight.category}
                    </Badge>
                    {insight.marketPosture && (
                      <Badge variant="secondary" className="capitalize text-[10px] font-medium bg-slate-200/80">
                        {insight.marketPosture}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div>
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Executive Analysis
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                    {insight.summary}
                  </p>
                </div>

                {/* Evidence Grounding */}
                {insight.evidenceList && insight.evidenceList.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Grounded Historical Evidence
                    </span>
                    <ul className="space-y-1.5">
                      {insight.evidenceList.map((ev, i) => (
                        <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium">{ev.claim}</span>
                            {ev.observedValue && (
                              <span className="text-slate-500 block text-[11px]">
                                Current: <code className="text-slate-800">{ev.observedValue}</code>
                                {ev.previousValue && (
                                  <> • Previous: <code className="text-slate-800">{ev.previousValue}</code></>
                                )}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strategic Implications */}
                {insight.strategicImplications && insight.strategicImplications.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Strategic Implications
                    </h5>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {insight.strategicImplications.map((imp, i) => (
                        <li
                          key={i}
                          className="text-xs text-slate-600 bg-slate-100/60 p-2.5 rounded-md border border-slate-200/50 flex items-start gap-2"
                        >
                          <TrendingUp className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Playbook */}
                {insight.actionPlaybook && (
                  <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        Action Playbook & Recommendations
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {insight.actionPlaybook.product && insight.actionPlaybook.product.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-indigo-900 block">Product:</span>
                          <ul className="text-xs text-indigo-950/80 space-y-1 list-disc pl-4">
                            {insight.actionPlaybook.product.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insight.actionPlaybook.pricing && insight.actionPlaybook.pricing.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-indigo-900 block">Pricing:</span>
                          <ul className="text-xs text-indigo-950/80 space-y-1 list-disc pl-4">
                            {insight.actionPlaybook.pricing.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insight.actionPlaybook.marketing && insight.actionPlaybook.marketing.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-indigo-900 block">Marketing:</span>
                          <ul className="text-xs text-indigo-950/80 space-y-1 list-disc pl-4">
                            {insight.actionPlaybook.marketing.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insight.actionPlaybook.sales && insight.actionPlaybook.sales.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-indigo-900 block">Sales:</span>
                          <ul className="text-xs text-indigo-950/80 space-y-1 list-disc pl-4">
                            {insight.actionPlaybook.sales.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
