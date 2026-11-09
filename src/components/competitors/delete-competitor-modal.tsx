"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Trash2,
  X,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteCompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  competitor: {
    id: string;
    name: string;
  } | null;
}

export function DeleteCompetitorModal({
  isOpen,
  onClose,
  onSuccess,
  competitor,
}: DeleteCompetitorModalProps) {
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !competitor) return null;

  const isConfirmed = confirmName.trim().toLowerCase() === competitor.name.trim().toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/competitors/${competitor.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete competitor");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete competitor");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-rose-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950">Delete Competitor</h2>
              <p className="text-xs text-rose-600">Irreversible destructive action</p>
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

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5 leading-relaxed">
            <p className="font-semibold text-rose-950">
              Warning: All intelligence data will be permanently removed!
            </p>
            <p>
              Deleting <strong>{competitor.name}</strong> will permanently delete all associated:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-rose-800">
              <li>Tracked URLs and scraping results</li>
              <li>Historical pricing snapshots and plan records</li>
              <li>Detected pricing & feature changes</li>
              <li>Generated AI strategic intelligence insights</li>
            </ul>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-100 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Type <span className="font-mono text-rose-700 select-all font-bold">{competitor.name}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={competitor.name}
              className="w-full h-9 rounded-md border border-slate-200 px-3 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-medium"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
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
              disabled={!isConfirmed || isDeleting}
              onClick={handleDelete}
              className="text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-40"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting Everything...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Competitor</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
