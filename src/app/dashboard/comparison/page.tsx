"use client";

import React, { useEffect, useState, useMemo } from "react";
import { GitCompare, Layers, Check, X, Shield, RefreshCw, AlertCircle, HelpCircle, Building2, Filter } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PlanFeatureDetail {
  name: string;
  availability: "included" | "not_included" | "limited" | "unknown";
  originalValue: string;
  numericLimit?: number | null;
  limitUnit?: string | null;
  limitationDescription?: string | null;
  evidenceText?: string | null;
  inheritedFromLowerPlan?: string | null;
}

interface ComparedPlan {
  id: string;
  planName: string;
  description: string | null;
  price: string | null;
  numericPrice: number | null;
  isFree: boolean;
  isCustomPricing: boolean;
  currency: string | null;
  billingPeriod: string | null;
  isComparable: boolean;
  features: string[];
  featureDetails?: Record<string, PlanFeatureDetail>;
  usageLimits: Record<string, unknown>;
  sourceUrl: string | null;
}

interface CompetitorGroup {
  competitor: {
    id: string;
    name: string;
    domain: string;
    industry: string | null;
  };
  plans: ComparedPlan[];
}

interface ComparisonResponse {
  competitors: CompetitorGroup[];
  matrixSummary: {
    totalCompetitors: number;
    totalPlans: number;
    distinctFeaturesCount: number;
    distinctFeatures: string[];
  };
}

export default function ComparisonPage() {
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("all");

  useEffect(() => {
    async function loadComparison() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (billingFilter !== "all") params.append("billingPeriod", billingFilter);
        if (selectedCompetitorId !== "all") params.append("competitorIds", selectedCompetitorId);

        const url = `/api/dashboard/comparison?${params.toString()}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to load comparison data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadComparison();
  }, [billingFilter, selectedCompetitorId]);

  // Available competitors from data
  const competitorOptions = data?.competitors || [];

  // Helper to determine comparable price for ordering tiers ascendingly
  const getSortablePrice = (p: ComparedPlan): number => {
    if (p.isFree) return 0;
    if (p.numericPrice !== null && !p.isCustomPricing) return p.numericPrice;
    if (p.isCustomPricing) return 999999; // Enterprise custom ranks highest
    return 50000;
  };

  // Flatten plans and apply tier inheritance within each competitor:
  // If a higher tier has a feature as unspecified/missing, inherit the resolved availability
  // from the closest lower-priced tier of the SAME competitor if it's not unspecified.
  const processedPlans = useMemo(() => {
    const list: Array<{ competitorId: string; competitorName: string; plan: ComparedPlan }> = [];

    (data?.competitors || []).forEach((c) => {
      // Sort competitor plans from lowest price to highest price
      const sortedPlans = [...c.plans].sort((a, b) => getSortablePrice(a) - getSortablePrice(b));

      // Build effective feature detail map carrying forward lower-tier entitlements
      const resolvedPlans: ComparedPlan[] = [];

      sortedPlans.forEach((plan, idx) => {
        const effectiveFeatureDetails: Record<string, PlanFeatureDetail> = {
          ...(plan.featureDetails || {}),
        };

        // For every feature known across the competitor, if unspecified on this plan,
        // inspect lower-priced plans in ascending order up to this plan
        (data?.matrixSummary?.distinctFeatures || []).forEach((featureName) => {
          const lower = featureName.toLowerCase();
          const currentDetail = effectiveFeatureDetails[lower];

          const isUnspecified =
            !currentDetail ||
            currentDetail.availability === "unknown" ||
            currentDetail.originalValue === "—" ||
            currentDetail.originalValue === "-" ||
            currentDetail.originalValue.toLowerCase() === "unspecified";

          if (isUnspecified) {
            // Check immediately lower-priced plans of this same competitor (from closest lower tier downwards)
            for (let i = idx - 1; i >= 0; i--) {
              const lowerPlan = resolvedPlans[i];
              const lowerDetail = lowerPlan.featureDetails?.[lower];

              if (
                lowerDetail &&
                lowerDetail.availability !== "unknown" &&
                lowerDetail.originalValue !== "—" &&
                lowerDetail.originalValue !== "-" &&
                lowerDetail.originalValue.toLowerCase() !== "unspecified"
              ) {
                // Inherit lower tier's resolved availability
                effectiveFeatureDetails[lower] = {
                  ...lowerDetail,
                  inheritedFromLowerPlan: lowerPlan.planName,
                };
                break;
              }
            }
          }
        });

        const updatedPlan: ComparedPlan = {
          ...plan,
          featureDetails: effectiveFeatureDetails,
        };
        resolvedPlans.push(updatedPlan);

        list.push({
          competitorId: c.competitor.id,
          competitorName: c.competitor.name,
          plan: updatedPlan,
        });
      });
    });

    return list;
  }, [data]);

  const distinctFeatures = data?.matrixSummary?.distinctFeatures || [];

  return (
    <div className="space-y-8 pb-10">
      {/* Header with quick stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Feature & Tier Comparison Matrix
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Database-backed side-by-side comparison of competitor pricing tiers, packaging structures, and feature limits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs py-1 px-3 border-indigo-200 text-indigo-700 bg-indigo-50/50">
            {data?.matrixSummary.totalCompetitors || 0} Competitor{data?.matrixSummary.totalCompetitors === 1 ? "" : "s"} • {data?.matrixSummary.totalPlans || 0} Plans
          </Badge>
        </div>
      </div>

      {/* Filter toolbar: Competitor-Specific Selector + Billing Period + Legend */}
      <div className="space-y-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Competitor Selector Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5 mr-1">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              Competitor:
            </span>
            <button
              onClick={() => setSelectedCompetitorId("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCompetitorId === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Competitors ({competitorOptions.length})
            </button>
            {competitorOptions.map((c) => (
              <button
                key={c.competitor.id}
                onClick={() => setSelectedCompetitorId(c.competitor.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedCompetitorId === c.competitor.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{c.competitor.name}</span>
                <span className="text-[10px] opacity-75">({c.plans.length} plans)</span>
              </button>
            ))}
          </div>

          {/* Billing Period Filter */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              Billing:
            </span>
            {["all", "monthly", "yearly", "annual"].map((b) => (
              <button
                key={b}
                onClick={() => setBillingFilter(b)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  billingFilter === b
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pt-1">
          <span className="text-xs font-medium text-slate-400">Legend:</span>
          <div className="flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Included</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Limited / Quota (e.g. 27K, 10x)</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Not Included</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Unspecified (✕)</span>
          </div>
        </div>
      </div>

      {/* Comparison Matrix Table Card */}
      {isLoading ? (
        <div className="text-center py-16 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-medium text-slate-600">Retrieving comparison data from Neon database...</p>
        </div>
      ) : processedPlans.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
          <Layers className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No active pricing plans found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {selectedCompetitorId !== "all"
              ? "No plans match the selected competitor or billing filter."
              : "Run extraction on your monitored competitor URLs to populate the comparison matrix."}
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden border border-slate-200/80 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="p-4 sm:p-5 font-semibold text-slate-500 uppercase tracking-wider text-[11px] min-w-[220px]">
                    Plan & Feature Breakdown
                  </th>
                  {processedPlans.map(({ competitorName, plan }) => (
                    <th key={plan.id} className="p-4 sm:p-5 font-bold text-slate-900 min-w-[190px]">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-600" />
                        <span>{competitorName}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 block mt-1">
                        {plan.planName}
                      </span>
                      <span className="text-sm font-bold text-indigo-600 block mt-0.5">
                        {plan.isCustomPricing
                          ? "Custom / Contact Sales"
                          : plan.isFree
                          ? `Free (${plan.currency === "INR" || plan.currency === "₹" ? "₹0" : "$0"})`
                          : plan.price
                          ? `${plan.currency === "INR" || plan.currency === "₹" ? "₹" : "$"}${Number(plan.price).toLocaleString()} / ${plan.billingPeriod === "yearly" || plan.billingPeriod === "annual" ? "year" : "month"}`
                          : "Not disclosed"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/30">
                  <td className="p-4 sm:p-5 font-bold text-slate-700 bg-slate-50/50">
                    Pricing Mode
                  </td>
                  {processedPlans.map(({ plan }) => (
                    <td key={plan.id} className="p-4 sm:p-5 text-slate-600">
                      <Badge variant={plan.isCustomPricing ? "outline" : "secondary"} className="capitalize text-xs">
                        {plan.isCustomPricing ? "Enterprise Custom" : plan.isFree ? "Free Tier" : "Fixed Self-Serve"}
                      </Badge>
                    </td>
                  ))}
                </tr>

                {/* Features comparison rows */}
                {distinctFeatures.map((featureName, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 sm:p-5 font-medium text-slate-800">
                      {featureName}
                    </td>
                    {processedPlans.map(({ plan }) => {
                      const lower = featureName.toLowerCase();
                      const detail = plan.featureDetails?.[lower];

                      if (detail) {
                        if (detail.availability === "included") {
                          return (
                            <td key={plan.id} className="p-4 sm:p-5">
                              <div
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                                title={detail.inheritedFromLowerPlan ? `Included (Carried forward from ${detail.inheritedFromLowerPlan})` : undefined}
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Included</span>
                              </div>
                            </td>
                          );
                        }

                        if (detail.availability === "limited") {
                          const limitLabel = detail.originalValue || detail.limitationDescription || "Limited";
                          return (
                            <td key={plan.id} className="p-4 sm:p-5">
                              <div 
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold max-w-[170px]"
                                title={
                                  detail.inheritedFromLowerPlan
                                    ? `${detail.limitationDescription || detail.originalValue} (Carried forward from ${detail.inheritedFromLowerPlan})`
                                    : detail.limitationDescription || detail.originalValue
                                }
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span className="truncate">{limitLabel}</span>
                              </div>
                            </td>
                          );
                        }

                        if (detail.availability === "not_included") {
                          return (
                            <td key={plan.id} className="p-4 sm:p-5">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium">
                                <X className="h-3.5 w-3.5" />
                                <span>Not available</span>
                              </div>
                            </td>
                          );
                        }
                      }

                      // Check legacy string list if detail map misses it
                      const hasLegacy = plan.features.some((f) => f.toLowerCase() === lower);
                      if (hasLegacy) {
                        return (
                          <td key={plan.id} className="p-4 sm:p-5">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                              <Check className="h-3.5 w-3.5" />
                              <span>Included</span>
                            </div>
                          </td>
                        );
                      }

                      // Unspecified / Not mentioned -> Render as cross symbol
                      return (
                        <td key={plan.id} className="p-4 sm:p-5">
                          <div 
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-xs font-medium"
                            title="Feature not specified for this plan"
                          >
                            <X className="h-3.5 w-3.5 text-slate-400" />
                            <span>—</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
