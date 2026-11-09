"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Globe, Building2, Tag, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { addCompetitorSchema, AddCompetitorFormData } from "@/schemas/competitor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddCompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddCompetitorModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCompetitorModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddCompetitorFormData>({
    resolver: zodResolver(addCompetitorSchema),
    defaultValues: {
      name: "",
      website: "",
      category: "",
      notes: "",
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: AddCompetitorFormData) => {
    setServerError(null);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          website: data.website,
          industry: data.category,
          description: data.notes || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to add competitor");
      }

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setIsSuccess(false);
        reset();
        onClose();
        // Dispatch window event so any listening pages refresh their list
        window.dispatchEvent(new CustomEvent("competitor-created"));
      }, 1200);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : "Failed to register competitor"
      );
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setServerError(null);
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Add New Competitor
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registers company and website in PostgreSQL
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Competitor Registered in Database
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Domain indexed and initial tracking URL configured.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
            {serverError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Competitor Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Company / Competitor Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  {...register("name")}
                  placeholder="e.g. Acme Corp"
                  className="pl-9 text-xs sm:text-sm"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-rose-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Competitor Website */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Website or Pricing URL
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  {...register("website")}
                  placeholder="https://acme.com/pricing"
                  className="pl-9 text-xs sm:text-sm"
                />
              </div>
              {errors.website && (
                <p className="text-xs text-rose-500 mt-1">{errors.website.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Industry Category
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  {...register("category")}
                  placeholder="e.g. SaaS Analytics, AI Infrastructure"
                  className="pl-9 text-xs sm:text-sm"
                />
              </div>
              {errors.category && (
                <p className="text-xs text-rose-500 mt-1">{errors.category.message}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description / Notes (Optional)
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  {...register("notes")}
                  placeholder="Key plans to monitor or tier notes"
                  className="pl-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isSubmitting ? "Saving to Database..." : "Save Competitor"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
