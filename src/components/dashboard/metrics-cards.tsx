"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardOverviewData {
  metrics: {
    totalCompetitors: number;
    trackedUrls: {
      total: number;
      active: number;
      successfulScans: number;
      failedScans: number;
    };
    pricingPlans: {
      total: number;
      active: number;
      customPricing: number;
    };
    changesLast30Days: {
      total: number;
      priceIncreases: number;
      priceDecreases: number;
      featureUpdates: number;
    };
    insights: {
      total: number;
      highPriority: number;
    };
  };
  timestamps: {
    latestScanAt: string | null;
    latestExtractionAt: string | null;
  };
}

export function MetricsCards() {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await fetch("/api/dashboard/overview");
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard overview metrics:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5 h-28 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Competitors */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Competitors
            </span>
            <div className="h-8 w-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {m?.totalCompetitors ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 font-medium">
            <span>{m?.trackedUrls.active ?? 0} active tracked pages</span>
          </div>
        </CardContent>
      </Card>

      {/* Tracked Pricing Plans */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Tracked Plans
            </span>
            <div className="h-8 w-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {m?.pricingPlans.active ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 font-medium">
            <span>{m?.pricingPlans.customPricing ?? 0} custom enterprise</span>
          </div>
        </CardContent>
      </Card>

      {/* Detected Changes */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Price Changes (30d)
            </span>
            <div className="h-8 w-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {m?.changesLast30Days.total ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-medium">
            <span className="text-rose-600 flex items-center">
              <ArrowUpRight className="h-3.5 w-3.5 mr-0.5 shrink-0" />
              {m?.changesLast30Days.priceIncreases ?? 0} hikes
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-600 flex items-center">
              <ArrowDownRight className="h-3.5 w-3.5 mr-0.5 shrink-0" />
              {m?.changesLast30Days.priceDecreases ?? 0} drops
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Strategic AI Insights */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              AI Insights
            </span>
            <div className="h-8 w-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {m?.insights.total ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs font-medium text-amber-600">
            <span>{m?.insights.highPriority ?? 0} high-priority playbooks</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
