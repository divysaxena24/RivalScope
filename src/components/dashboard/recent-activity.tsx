"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Layers, Clock, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChangeItem {
  id: string;
  competitorId: string;
  competitorName: string;
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

export function RecentActivity() {
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRecentChanges() {
      try {
        const res = await fetch("/api/dashboard/changes?pageSize=5");
        const json = await res.json();
        if (json.success && json.data) {
          setChanges(json.data);
        }
      } catch (err) {
        console.error("Failed to load recent changes:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadRecentChanges();
  }, []);

  return (
    <Card className="col-span-full lg:col-span-6">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Competitor Activity</CardTitle>
          <CardDescription className="mt-1">
            Latest price variations and detected packaging updates
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            Loading recent activities...
          </div>
        ) : changes.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Clock className="h-5 w-5 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-slate-700">No recent changes detected</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Run crawl and change detection scans on competitors to discover updates.
            </p>
          </div>
        ) : (
          changes.map((change) => {
            const isIncrease = change.changeType === "price_increase";
            const isDecrease = change.changeType === "price_decrease";

            return (
              <div
                key={change.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${
                      isIncrease
                        ? "bg-rose-50 text-rose-600"
                        : isDecrease
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {isIncrease ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : isDecrease ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <Layers className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {change.competitorName}
                      </span>
                      {change.planName && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                          {change.planName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {change.description}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {change.percentageDifference ? (
                    <span
                      className={`text-xs font-bold block ${
                        isIncrease ? "text-rose-600" : isDecrease ? "text-emerald-600" : "text-slate-700"
                      }`}
                    >
                      {parseFloat(change.percentageDifference) > 0 ? "+" : ""}
                      {change.percentageDifference}%
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 capitalize">
                      {change.changeType.replace("_", " ")}
                    </Badge>
                  )}
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {new Date(change.detectedAt).toLocaleDateString(undefined, {
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
