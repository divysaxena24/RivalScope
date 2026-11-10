"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  GitCompare,
  TrendingUp,
  Sparkles,
  Settings,
  Radar,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Competitors",
    href: "/dashboard/competitors",
    icon: Building2,
  },
  {
    name: "Comparison",
    href: "/dashboard/comparison",
    icon: GitCompare,
  },
  {
    name: "Price History",
    href: "/dashboard/price-history",
    icon: TrendingUp,
  },
  {
    name: "AI Insights",
    href: "/dashboard/insights",
    icon: Sparkles,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [competitorCount, setCompetitorCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/overview");
        const json = await res.json();
        if (isMounted && json.success && json.data?.metrics) {
          setCompetitorCount(json.data.metrics.totalCompetitors ?? 0);
        }
      } catch (err) {
        console.error("Failed to fetch sidebar competitor count:", err);
      } finally {
        if (isMounted) {
          setIsLoadingCount(false);
        }
      }
    }

    fetchStats();

    const handleCompetitorChange = () => {
      fetchStats();
    };

    window.addEventListener("competitor-created", handleCompetitorChange);
    return () => {
      isMounted = false;
      window.removeEventListener("competitor-created", handleCompetitorChange);
    };
  }, []);

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0">
      {/* Brand Logo & Name */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200">
        <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
          <Radar className="h-5 w-5" />
        </div>
        <div>
          <span className="font-bold text-slate-900 tracking-tight text-base block leading-none">
            RivalScope
          </span>
          <span className="text-[11px] text-slate-400 font-medium">Competitive Intel</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Main Menu
        </div>
        {navigationItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer / Telemetry Status */}
      <div className="p-3 border-t border-slate-200">
        <div className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
            <Building2 className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">Live Tracking</p>
            <p className="text-[11px] text-slate-500 truncate">
              {isLoadingCount ? (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </span>
              ) : competitorCount !== null ? (
                <span>
                  {competitorCount} monitored {competitorCount === 1 ? "competitor" : "competitors"}
                </span>
              ) : (
                <span className="text-slate-400">Database offline</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
