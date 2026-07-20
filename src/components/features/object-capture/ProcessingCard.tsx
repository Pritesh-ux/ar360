"use client";

import React from "react";
import { AlertCircle, RefreshCw, XCircle, ArrowRight } from "lucide-react";
import { CaptureJob } from "@/hooks/useObjectCaptureUpload";

type Props = {
  job: CaptureJob | null;
  onCancel: () => void;
  onRetry: () => void;
  onOpenEditor: () => void;
  isCreatingProduct?: boolean;
};

export function ProcessingCard({ job, onCancel, onRetry, onOpenEditor, isCreatingProduct }: Props) {
  if (!job) return null;

  const { status, progress, error_message, processing_stage } = job;

  const isProcessing = ["queued", "processing", "validating"].includes(status);
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";
  const isCompleted = status === "completed";

  const getStatusBadge = () => {
    switch (status) {
      case "completed":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Completed</span>;
      case "failed":
        return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">Failed</span>;
      case "cancelled":
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Cancelled</span>;
      case "processing":
        return <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-[#00B2CA] animate-pulse">Processing</span>;
      case "validating":
        return <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 animate-pulse">Validating AI</span>;
      case "queued":
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">In Queue</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 capitalize">{status}</span>;
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Pipeline Monitor</h3>
          <p className="text-xs text-slate-400">Job ID: {job.id}</p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-4">
        {processing_stage && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current Step</span>
            <p className="text-sm font-bold text-slate-700 capitalize mt-0.5">
              {processing_stage.replaceAll("_", " ")}
            </p>
          </div>
        )}

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Overall Progress</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#00B2CA] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Error message */}
        {isFailed && error_message && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-xs font-medium">{error_message}</p>
          </div>
        )}

        {/* Action button rows */}
        <div className="flex flex-col gap-2 pt-2">
          {isProcessing && (
            <button
              onClick={onCancel}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-all"
            >
              <XCircle className="h-3.5 w-3.5 text-slate-400" />
              Cancel Construction
            </button>
          )}

          {(isFailed || isCancelled) && (
            <button
              onClick={onRetry}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-all shadow"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-queue Job
            </button>
          )}

          {isCompleted && (
            <button
              onClick={onOpenEditor}
              disabled={isCreatingProduct}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-all shadow-md disabled:cursor-wait disabled:opacity-60"
            >
              {isCreatingProduct ? "Creating product…" : "Open in 3D Editor"}
              <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
