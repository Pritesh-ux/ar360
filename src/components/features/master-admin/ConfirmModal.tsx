"use client";

import { ReactNode } from "react";
import { X, AlertTriangle } from "lucide-react";
import ViewportPortal from "@/components/shared/ViewportPortal";

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
  return (
    <ViewportPortal open={open}>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6"
        role="presentation"
        onClick={onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  danger
                    ? "bg-red-50 text-red-600"
                    : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                }`}
              >
                <AlertTriangle size={22} />
              </div>

              <div>
                <h2 id="confirm-modal-title" className="text-xl font-black text-slate-950">
                  {title}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl bg-slate-100 p-2 text-slate-500"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {children}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600"
            >
              {cancelText}
            </button>

            <button
              type="button"
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
    </ViewportPortal>
  );
}
