"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Building2, ExternalLink, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface SearchCompetitorResult {
  id: string;
  name: string;
  domain: string;
  industry: string | null;
  lastScanStatus: string | null;
  plansCount: number;
}

interface CompetitorSearchProps {
  className?: string;
  placeholder?: string;
}

export function CompetitorSearch({
  className = "relative w-48 sm:w-72 hidden sm:block",
  placeholder = "Search competitors...",
}: CompetitorSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchCompetitorResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced Search Request
  const performSearch = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cancel in-flight request to prevent race conditions / stale data
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setSelectedIndex(-1);

    try {
      const res = await fetch(
        `/api/dashboard/competitors?search=${encodeURIComponent(trimmed)}&pageSize=5&sortBy=name&sortOrder=asc`,
        { signal: controller.signal }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Search failed");
      }

      setResults(json.data || []);
      setIsOpen(true);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError("Failed to retrieve competitors");
        setResults([]);
        setIsOpen(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query, performSearch]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (competitorId: string) => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(-1);
    router.push(`/dashboard/competitors/${competitorId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" && query.trim().length >= 2) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex].id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={className}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim().length >= 2 && results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="pl-8 pr-8 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 focus-visible:bg-white"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
        />
        {isLoading && (
          <div className="absolute right-2.5 top-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-white p-1.5 shadow-xl border border-slate-200 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {error ? (
            <div className="p-3 text-center text-rose-600 font-medium">
              {error}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              <Building2 className="h-5 w-5 mx-auto text-slate-300 mb-1" />
              <p className="font-medium text-slate-700">No matching competitors</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                No monitored competitor matches &quot;{query}&quot;
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Matching Competitors ({results.length})
              </div>
              {results.map((comp, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <div
                    key={comp.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(comp.id)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-indigo-50 text-indigo-900" : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="h-7 w-7 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {comp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold block truncate leading-tight">
                          {comp.name}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                          {comp.domain} {comp.industry ? `• ${comp.industry}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-right">
                      {comp.plansCount > 0 && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                          {comp.plansCount} plans
                        </Badge>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
