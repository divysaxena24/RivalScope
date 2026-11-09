"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Globe, AlertCircle, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const addTrackedUrlFormSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .url("Please enter a valid HTTP or HTTPS URL")
    .refine((val) => /^https?:\/\//i.test(val), {
      message: "URL must begin with http:// or https://",
    }),
  pageType: z.enum(["pricing", "features", "product", "other"]),
});

type AddTrackedUrlFormData = z.infer<typeof addTrackedUrlFormSchema>;

interface AddTrackedUrlModalProps {
  isOpen: boolean;
  competitorId: string;
  competitorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTrackedUrlModal({
  isOpen,
  competitorId,
  competitorName,
  onClose,
  onSuccess,
}: AddTrackedUrlModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddTrackedUrlFormData>({
    resolver: zodResolver(addTrackedUrlFormSchema),
    defaultValues: {
      url: "",
      pageType: "pricing",
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    setServerError(null);
    setIsSuccess(false);
    onClose();
  };

  const onSubmit = async (data: AddTrackedUrlFormData) => {
    setServerError(null);
    try {
      const res = await fetch(`/api/competitors/${competitorId}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.url.trim(),
          pageType: data.pageType,
          isActive: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to add tracked URL");
      }

      setIsSuccess(true);
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 700);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to add tracked URL");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Tracked URL</h3>
              <p className="text-xs text-slate-500">Monitor new page for {competitorName}</p>
            </div>
          </div>
        </div>

        {serverError && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {isSuccess && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-medium">URL registered successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Page Endpoint URL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                {...register("url")}
                placeholder="https://example.com/pricing"
                className="pl-9 text-xs sm:text-sm"
                disabled={isSubmitting || isSuccess}
              />
            </div>
            {errors.url && (
              <p className="text-[11px] text-rose-600">{errors.url.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Page Category / Type
            </label>
            <select
              {...register("pageType")}
              disabled={isSubmitting || isSuccess}
              className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
            >
              <option value="pricing">Pricing (Pricing, Plans & Tiers)</option>
              <option value="features">Features (Product Entitlements)</option>
              <option value="product">Product (Main Product Overview)</option>
              <option value="other">Other (Documentation / Enterprise)</option>
            </select>
            {errors.pageType && (
              <p className="text-[11px] text-rose-600">{errors.pageType.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isSuccess}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add URL</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
