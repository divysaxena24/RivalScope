"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Plus, Menu, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompetitorSearch } from "./competitor-search";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/competitors": "Competitors",
  "/dashboard/comparison": "Competitor Comparison",
  "/dashboard/price-history": "Price History",
  "/dashboard/insights": "AI Insights",
};

interface HeaderProps {
  onAddCompetitorClick?: () => void;
  onMobileMenuToggle?: () => void;
}

export function Header({ onAddCompetitorClick, onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const currentTitle = pageTitles[pathname] || "Dashboard";

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="p-1.5 -ml-1 text-slate-500 hover:text-slate-700 md:hidden rounded-md hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
          {currentTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Functional Global Competitor Search */}
        <CompetitorSearch />

        {/* Quick Add Competitor button */}
        <Button
          onClick={onAddCompetitorClick}
          size="sm"
          className="gap-1.5 font-medium shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Competitor</span>
          <span className="sm:hidden">Add</span>
        </Button>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center ring-2 ring-slate-200" title="User Profile">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
