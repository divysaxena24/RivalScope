"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteTrackedUrlModalProps {
  isOpen: boolean;
  trackedUrl: {
    id: string;
    url: string;
    pageType: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteTrackedUrlModal({
  isOpen,
  trackedUrl,
  onClose,
  onSuccess,
}: DeleteTrackedUrlModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !trackedUrl) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tracked-urls/${trackedUrl.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete tracked URL");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete URL");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Remove Tracked URL</h3>
            <p className="text-xs text-slate-500">Stop monitoring this web endpoint</p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Target Page
          </span>
          <p className="font-mono text-slate-900 break-all">{trackedUrl.url}</p>
          <span className="text-[11px] text-slate-400 capitalize block">
            Type: {trackedUrl.pageType}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to remove this URL from future crawls? Existing scrape history,
          pricing snapshots, and detected change events will be safely preserved.
        </p>

        {error && (
          <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove URL</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
