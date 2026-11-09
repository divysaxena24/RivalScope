"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Lightbulb } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AIInsightSummary {
  id: string;
  competitorName: string | null;
  category: string;
  title: string;
  summary: string;
  impact: string;
  createdAt: string;
}

export function RecentInsights() {
  const [insights, setInsights] = useState<AIInsightSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecent() {
      try {
        const res = await fetch("/api/insights?limit=4");
        const data = await res.json();
        if (data.insights) {
          setInsights(data.insights);
        }
      } catch (e) {
        console.error("Failed to load dashboard recent insights:", e);
      } finally {
        setLoading(false);
      }
    }
    loadRecent();
  }, []);

  return (
    <Card className="col-span-full lg:col-span-6">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>Recent AI Insights</span>
          </CardTitle>
          <CardDescription className="mt-1">
            Automated intelligence & strategic takeaways synthesized by LLM
          </CardDescription>
        </div>
        <Link
          href="/dashboard/insights"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>View all</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            Loading recent insights...
          </div>
        ) : insights.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Lightbulb className="h-5 w-5 text-indigo-400 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-slate-700">No AI insights generated yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Run intelligence synthesis on the AI Insights tab to populate takeaways.
            </p>
          </div>
        ) : (
          insights.map((insight) => {
            const impactBadge =
              insight.impact === "high"
                ? "destructive"
                : insight.impact === "medium"
                ? "warning"
                : "secondary";

            return (
              <div
                key={insight.id}
                className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-600">
                      {insight.competitorName || "Market-Wide"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                      {insight.title}
                    </span>
                  </div>
                  <Badge variant={impactBadge} className="capitalize text-[10px] px-1.5 py-0 h-4 shrink-0">
                    {insight.impact} impact
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {insight.summary}
                </p>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="capitalize">Topic: {insight.category}</span>
                  <span>
                    {new Date(insight.createdAt).toLocaleDateString(undefined, {
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
  );
}
