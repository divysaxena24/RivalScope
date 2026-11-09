"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  RefreshCw,
  Clock,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PriceHistoryRecord {
  id: string;
  competitorId: string;
  competitorName: string;
  pricingPlanId: string | null;
  planName: string;
  price: string | null;
  currency: string | null;
  billingPeriod: string | null;
  sourceUrl: string | null;
  features: string[];
  usageLimits: Record<string, unknown>;
  observedAt: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export default function PriceHistoryPage() {
  const [records, setRecords] = useState<PriceHistoryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/dashboard/price-history?page=${page}&pageSize=15`);
        const json = await res.json();
        if (json.success && json.data) {
          setRecords(json.data);
          setPagination(json.pagination);
        }
      } catch (err) {
        console.error("Failed to load price history:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadHistory();
  }, [page]);

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Historical Price Observations & Snapshots
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Immutable database observations of competitor plan pricing, historical snapshots, and extracted entitlements over time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs py-1 px-3 border-indigo-200 text-indigo-700 bg-indigo-50/50">
            {pagination?.totalRecords || 0} Total Snapshots
          </Badge>
        </div>
      </div>

      {/* Snapshot table */}
      <Card className="overflow-hidden border border-slate-200/90 shadow-xs">
        <CardHeader className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800">
              Pricing Observation Log
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Sequential observations captured by Firecrawl and normalized by Groq
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500">Querying historical snapshot logs...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Clock className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No Historical Snapshots Stored</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Snapshots are automatically created each time a competitor website is scanned and prices are extracted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="p-4">Competitor & Plan</th>
                    <th className="p-4">Recorded Price</th>
                    <th className="p-4">Billing Period</th>
                    <th className="p-4">Features Count</th>
                    <th className="p-4">Observed Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <span className="font-semibold text-slate-900 block">
                          {rec.competitorName}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {rec.planName}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-900">
                          {rec.price !== null ? `${rec.currency || "$"}${rec.price}` : "Custom / Enterprise"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 capitalize">
                        {rec.billingPeriod || "Monthly"}
                      </td>
                      <td className="p-4 text-slate-600">
                        <Badge variant="secondary" className="text-xs">
                          {rec.features?.length || 0} features
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-500 text-xs">
                        {new Date(rec.observedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalRecords} total records)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="text-xs h-7 px-2.5"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs h-7 px-2.5"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
