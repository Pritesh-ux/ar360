"use client";

import React from "react";
import Link from "next/link";
import { RefreshCw, Package } from "lucide-react";
import { CaptureJob } from "@/hooks/useObjectCaptureUpload";
import type { JobHistoryFilters } from "@/hooks/useObjectCaptureStatus";

type Props = {
  history: CaptureJob[];
  onRefresh: () => void;
  isRefreshing: boolean;
  error?: string;
  page: number;
  totalPages: number;
  filters: JobHistoryFilters;
  onFiltersChange: (filters: JobHistoryFilters) => void;
  onPageChange: (page: number) => void;
};

export function JobHistory({
  history, onRefresh, isRefreshing, error, page, totalPages,
  filters, onFiltersChange, onPageChange,
}: Props) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "failed":
        return "bg-red-50 text-red-700 border-red-100";
      case "cancelled":
        return "bg-slate-50 text-slate-500 border-slate-200";
      case "processing":
      case "validating":
        return "bg-cyan-50 text-cyan-700 border-cyan-100";
      default:
        return "bg-amber-50 text-amber-700 border-amber-100";
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Job History</h2>
          <p className="text-xs text-slate-400">Previous reconstruction sessions</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-all"
          title="Refresh History"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <form
        className="mb-4 grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onFiltersChange(filters);
        }}
      >
        <input
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Search job or product"
          aria-label="Search capture history"
          className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-cyan-500"
        />
        <select
          value={filters.status}
          onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
          aria-label="Filter by status"
          className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-cyan-500"
        >
          <option value="">All statuses</option>
          {["action_required","queued","processing","completed","failed","cancelled"].map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
        <input type="date" value={filters.from} aria-label="Created after"
          onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })}
          className="h-10 rounded-xl border border-slate-200 px-3 text-xs" />
        <input type="date" value={filters.to} aria-label="Created before"
          onChange={(event) => onFiltersChange({ ...filters, to: event.target.value })}
          className="h-10 rounded-xl border border-slate-200 px-3 text-xs" />
      </form>

      {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Package className="h-6 w-6 mx-auto mb-1 text-slate-300" />
            <p className="text-xs">No prior capture history found.</p>
          </div>
        ) : (
          history.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/object-capture/${item.id}`}
              className="flex items-center justify-between rounded-2xl border border-slate-50 bg-slate-50/50 p-4 transition-all hover:bg-slate-50"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    {item.photo_count || 0} Photos
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusStyle(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                  <span>Job ID: {item.id.slice(0, 8)}...</span>
                  {item.processing_stage && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{item.processing_stage.replaceAll("_", " ")}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-bold text-slate-800">{item.progress}%</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Progress</p>
              </div>
            </Link>
          ))
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
        <button type="button" disabled={page <= 1 || isRefreshing} onClick={() => onPageChange(page - 1)}
          className="h-9 rounded-xl border border-slate-200 px-3 disabled:opacity-40">Previous</button>
        <span className="text-slate-500">Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages || isRefreshing} onClick={() => onPageChange(page + 1)}
          className="h-9 rounded-xl border border-slate-200 px-3 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
