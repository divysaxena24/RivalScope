import React from "react";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { PricingTrendChart } from "@/components/charts/pricing-trend-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RecentInsights } from "@/components/dashboard/recent-insights";
import { SchedulerVisibilityCard } from "@/components/dashboard/scheduler-visibility-card";
import { Sparkles, ShieldCheck, ArrowUpRight, Zap } from "lucide-react";

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8 pb-10">
      {/* Top Banner / Hero Overview */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-xs border border-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Real-Time Market Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Competitive Radar & Pricing Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Monitoring SaaS competitors, indexing packaging shifts, and detecting price hikes using Firecrawl web extraction and Neon PostgreSQL storage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Pipeline Status</p>
                <p className="text-xs font-bold text-white">Firecrawl + Neon Live</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle background glow effect */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Key Performance Metrics
          </h3>
          <span className="text-xs text-indigo-600 font-semibold cursor-pointer hover:underline">
            Telemetry live
          </span>
        </div>
        <MetricsCards />
      </section>

      {/* Daily Automated Competitor Scheduler Section */}
      <section className="space-y-2">
        <SchedulerVisibilityCard />
      </section>

      {/* Pricing Trend Movement Chart */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Price Volatility & Market Index
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <PricingTrendChart />
        </div>
      </section>

      {/* Activity and AI Insights Grids */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Market Signals & Detected Events
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <RecentActivity />
          <RecentInsights />
        </div>
      </section>
    </div>
  );
}
