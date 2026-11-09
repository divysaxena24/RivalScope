"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Clock,
  Coins,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PriceObservation {
  snapshotId: string;
  competitorId: string;
  competitorName: string;
  pricingPlanId: string | null;
  planName: string;
  price: number;
  priceFormatted: string;
  currency: string;
  billingPeriod: string;
  observedAt: string;
  dateLabel: string;
}

interface CompetitorOption {
  id: string;
  name: string;
}

const PLAN_COLORS = [
  "#6366f1", // indigo
  "#0ea5e9", // sky blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#14b8a6", // teal
  "#f43f5e", // rose
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

interface PriceChangeAnnotation {
  id: string;
  competitorId: string;
  pricingPlanId: string | null;
  changeType: string;
  oldValue: any;
  newValue: any;
  absoluteDifference: string | null;
  percentageDifference: string | null;
  description: string;
  sourceUrl: string | null;
  detectedAt: string;
}

export function PricingTrendChart() {
  const [observations, setObservations] = useState<PriceObservation[]>([]);
  const [annotations, setAnnotations] = useState<PriceChangeAnnotation[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorOption[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>("all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load competitor options
  useEffect(() => {
    async function loadCompetitorList() {
      try {
        const res = await fetch("/api/competitors");
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const comps: CompetitorOption[] = json.data.map((c: any) => ({
            id: c.id,
            name: c.name,
          }));
          setCompetitors(comps);

          // Default to the first competitor so user immediately sees that competitor's offers
          const firstComp = comps[0];
          setSelectedCompetitor(firstComp.id);
        }
      } catch (err) {
        console.error("Failed to load competitor filter options:", err);
      }
    }
    loadCompetitorList();
  }, []);

  // Fetch real pricing observations from Neon database
  const fetchTrendData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const compParam = selectedCompetitor !== "all" ? `&competitorId=${selectedCompetitor}` : "";
      const periodParam = `&billingPeriod=${selectedPeriod}`;
      const currencyParam = `&currency=${selectedCurrency}`;
      const res = await fetch(`/api/dashboard/pricing-trends?${currencyParam}${periodParam}${compParam}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to load pricing trends");
      }

      setObservations(json.data.observations || []);
      setAnnotations(json.data.annotations || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load pricing trends");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendData();
  }, [selectedCompetitor, selectedCurrency, selectedPeriod]);

  // Extract distinct plan names present in the fetched observations
  const distinctPlans = React.useMemo(() => {
    const plansSet = new Set<string>();
    observations.forEach((obs) => {
      if (obs.planName) plansSet.add(obs.planName);
    });
    return Array.from(plansSet);
  }, [observations]);

  // Group observations by unique timestamp so each date tick holds all offers at that moment
  const { multiLineData, distinctDatesCount } = React.useMemo(() => {
    const timeMap = new Map<string, any>();

    observations.forEach((obs) => {
      const d = new Date(obs.observedAt);
      const timeKey = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const timeDetail = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const fullDate = `${timeKey} ${timeDetail}`;

      if (!timeMap.has(obs.observedAt)) {
        timeMap.set(obs.observedAt, {
          timestamp: obs.observedAt,
          date: fullDate,
          shortDate: timeKey,
        });
      }

      const row = timeMap.get(obs.observedAt);
      row[obs.planName] = obs.price;
      row[`${obs.planName}_formatted`] = obs.priceFormatted;
    });

    const data = Array.from(timeMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return { multiLineData: data, distinctDatesCount: data.length };
  }, [observations]);

  const currencySymbol = CURRENCY_SYMBOLS[selectedCurrency] || "$";

  return (
    <Card className="col-span-full lg:col-span-8">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Historical Pricing Observations & Trajectory
              </CardTitle>
              {!isLoading && !error && observations.length > 0 ? (
                <Badge variant="outline" className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 border-emerald-200">
                  Live Database Data
                </Badge>
              ) : isLoading ? (
                <Badge variant="outline" className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-50 border-slate-200">
                  Connecting...
                </Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1 text-xs text-slate-500">
              All plan offers plotted together over time ({selectedCurrency} / {selectedPeriod}).
            </CardDescription>
          </div>

          {/* Interactive Filters Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Competitor Selector */}
            {competitors.length > 0 && (
              <select
                value={selectedCompetitor}
                onChange={(e) => setSelectedCompetitor(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                aria-label="Filter by competitor"
              >
                <option value="all">All Competitors</option>
                {competitors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Currency Selector */}
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-indigo-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              aria-label="Filter by currency"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>

            {/* Billing Period Selector */}
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedPeriod("monthly")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  selectedPeriod === "monthly"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod("yearly")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  selectedPeriod === "yearly"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="h-[280px] w-full flex flex-col items-center justify-center space-y-2 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
            <p className="text-xs">Querying {selectedCurrency} snapshots from Neon PostgreSQL...</p>
          </div>
        ) : error ? (
          <div className="h-[280px] w-full flex flex-col items-center justify-center space-y-3 bg-rose-50/50 rounded-lg p-6 border border-rose-100">
            <AlertCircle className="h-6 w-6 text-rose-600" />
            <p className="text-xs text-rose-700 text-center">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchTrendData}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Query</span>
            </Button>
          </div>
        ) : observations.length === 0 ? (
          <div className="h-[280px] w-full flex flex-col items-center justify-center space-y-2 bg-slate-50/50 rounded-lg p-6 border border-dashed border-slate-200 text-center">
            <Coins className="h-6 w-6 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-800">
              No Recorded Observations in {selectedCurrency} ({selectedPeriod})
            </h4>
            <p className="text-[11px] text-slate-500 max-w-sm">
              No pricing snapshots have been extracted in {selectedCurrency} with {selectedPeriod} billing. Try switching to USD or another billing interval.
            </p>
          </div>
        ) : distinctDatesCount === 1 ? (
          /* When only 1 scan/snapshot observation date exists, display a clear offers comparison card matrix */
          <div className="h-[280px] w-full flex flex-col justify-between py-2">
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2.5">
              <TrendingUp className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-950">
                  Current Active Plan Offers ({selectedCurrency})
                </p>
                <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                  Displaying all {distinctPlans.length} plans recorded at {multiLineData[0]?.date}. As subsequent scans are performed, continuous trajectory lines for all offers will plot across time.
                </p>
              </div>
            </div>

            {/* Discrete price cards for all plan offers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-auto">
              {observations.map((obs) => (
                <div
                  key={obs.snapshotId}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1"
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate block">
                    {obs.competitorName}
                  </span>
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {obs.planName}
                  </p>
                  <p className="text-xl font-black text-indigo-600">
                    {obs.priceFormatted}
                  </p>
                  <span className="text-[10px] text-slate-400 block">
                    {obs.dateLabel} • {obs.billingPeriod}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center text-[11px] text-slate-400">
              Deterministic data from PostgreSQL <code className="font-mono text-slate-600">pricing_snapshots</code>
            </div>
          </div>
        ) : (
          /* Multi-Offer Line Chart: plots each plan tier on its own distinct line across time */
          <div className="space-y-3">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={multiLineData}
                  margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${currencySymbol}${val}`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white rounded-lg p-3 text-xs shadow-xl space-y-1.5 min-w-[160px]">
                            <p className="text-[11px] font-semibold text-slate-400 border-b border-slate-800 pb-1">
                              {label} ({selectedCurrency})
                            </p>
                            {payload.map((entry: any, idx: number) => {
                              const val = entry.value;
                              return (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}
                                  </span>
                                  <span className="font-bold text-white">
                                    {currencySymbol}{val}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {distinctPlans.map((planName, index) => (
                    <Line
                      key={planName}
                      type="monotone"
                      dataKey={planName}
                      name={planName}
                      stroke={PLAN_COLORS[index % PLAN_COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 1.5, fill: "#fff" }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Change Annotations Banner directly below graph */}
            {annotations.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Detected Price Movements on this Timeline
                </span>
                <div className="flex flex-wrap gap-2">
                  {annotations.map((ann) => {
                    const isHike = ann.changeType === "PRICE_INCREASED" || ann.changeType === "PRICE_NO_LONGER_FREE";
                    return (
                      <div
                        key={ann.id}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1.5 ${
                          isHike
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                        title={ann.description}
                      >
                        <span className="font-bold">{isHike ? "▲ Hike:" : "▼ Drop:"}</span>
                        <span>
                          {ann.oldValue ? `${currencySymbol}${ann.oldValue}` : "Free"} →{" "}
                          <strong>{ann.newValue ? `${currencySymbol}${ann.newValue}` : "Free"}</strong>
                        </span>
                        {ann.percentageDifference && (
                          <span className="text-[10px] opacity-80">
                            ({Number(ann.percentageDifference) > 0 ? "+" : ""}
                            {ann.percentageDifference}%)
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          • {new Date(ann.detectedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
