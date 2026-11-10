"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmDeleteAlertProps {
  isOpen: boolean;
  title: string;
  description: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
  requireTypingConfirm?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDeleteAlert({
  isOpen,
  title,
  description,
  itemName,
  confirmText = "Delete Permanently",
  cancelText = "Cancel",
  isDeleting = false,
  requireTypingConfirm = false,
  onConfirm,
  onClose,
}: ConfirmDeleteAlertProps) {
  const [typedValue, setTypedValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTypedValue("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = requireTypingConfirm
    ? typedValue.trim().toLowerCase() === (itemName || "").trim().toLowerCase()
    : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-rose-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100 bg-rose-50/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-[11px] text-rose-600 font-medium">Irreversible destructive action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {description}
          </p>

          {itemName && (
            <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-100 text-xs text-rose-900 flex items-center gap-2">
              <span className="font-semibold text-rose-950">Target:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-rose-200 font-bold truncate">
                {itemName}
              </span>
            </div>
          )}

          {requireTypingConfirm && itemName && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-slate-700 block">
                Type <strong className="text-rose-600 font-mono">{itemName}</strong> to confirm:
              </label>
              <input
                type="text"
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                placeholder={itemName}
                disabled={isDeleting}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-mono"
              />
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs h-8"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting || !isConfirmed}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 gap-1.5 shadow-xs"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span>{confirmText}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
