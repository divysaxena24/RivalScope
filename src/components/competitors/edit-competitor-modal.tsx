"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Globe,
  Tag,
  FileText,
  Loader2,
  AlertCircle,
  Archive,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateCompetitorSchema } from "@/schemas/api";

type FormValues = z.infer<typeof updateCompetitorSchema>;

interface EditCompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  competitor: {
    id: string;
    name: string;
    website: string;
    domain: string;
    industry?: string | null;
    description?: string | null;
    status?: string | null;
  } | null;
}

export function EditCompetitorModal({
  isOpen,
  onClose,
  onSuccess,
  competitor,
}: EditCompetitorModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(updateCompetitorSchema),
  });

  const [apiError, setApiError] = React.useState<string | null>(null);
  const currentStatus = watch("status");

  useEffect(() => {
    if (competitor && isOpen) {
      reset({
        name: competitor.name,
        website: competitor.website,
        industry: competitor.industry || "",
        description: competitor.description || "",
        status: (competitor.status as "active" | "archived") || "active",
      });
      setApiError(null);
    }
  }, [competitor, isOpen, reset]);

  if (!isOpen || !competitor) return null;

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    try {
      const res = await fetch(`/api/competitors/${competitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update competitor");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to update competitor");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Edit Competitor</h2>
              <p className="text-xs text-slate-500">Update company details and monitoring status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {apiError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Company / Competitor Name</label>
            <input
              type="text"
              {...register("name")}
              className="w-full h-9 rounded-md border border-slate-200 px-3 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              placeholder="e.g. Acme Corp"
            />
            {errors.name && <p className="text-[11px] text-rose-600">{errors.name.message}</p>}
          </div>

          {/* Website */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span>Website URL</span>
            </label>
            <input
              type="url"
              {...register("website")}
              className="w-full h-9 rounded-md border border-slate-200 px-3 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              placeholder="https://example.com"
            />
            {errors.website && <p className="text-[11px] text-rose-600">{errors.website.message}</p>}
          </div>

          {/* Industry */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <span>Industry / Category</span>
            </label>
            <input
              type="text"
              {...register("industry")}
              className="w-full h-9 rounded-md border border-slate-200 px-3 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              placeholder="e.g. AI / Productivity, Developer Tools, CRM"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>Description / Positioning</span>
            </label>
            <textarea
              {...register("description")}
              rows={2}
              className="w-full rounded-md border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              placeholder="Brief competitor summary or competitive notes..."
            />
          </div>

          {/* Status (Active / Archived) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-700 block mb-2">Monitoring Status</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue("status", "active")}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  currentStatus === "active"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <RotateCcw className="h-4 w-4 text-emerald-600" />
                <div className="text-left">
                  <div className="font-semibold">Active</div>
                  <div className="text-[10px] text-slate-400">Scanned & Monitored</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setValue("status", "archived")}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  currentStatus === "archived"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Archive className="h-4 w-4 text-amber-600" />
                <div className="text-left">
                  <div className="font-semibold">Archived</div>
                  <div className="text-[10px] text-slate-400">Historical Read-Only</div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
