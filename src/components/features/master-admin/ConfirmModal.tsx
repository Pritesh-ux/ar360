"use client";

import { ReactNode } from "react";
import { X, AlertTriangle } from "lucide-react";

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                danger
                  ? "bg-red-50 text-red-600"
                  : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
              }`}
            >
              <AlertTriangle size={22} />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {description}
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="rounded-xl bg-slate-100 p-2 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {children}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className={`flex-1 rounded-2xl px-5 py-3 text-sm font-black text-[var(--color-text)] ${
              danger ? "bg-red-500 hover:bg-red-600" : "bg-[var(--color-primary)]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}