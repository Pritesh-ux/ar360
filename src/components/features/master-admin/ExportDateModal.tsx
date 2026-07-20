"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

interface ExportDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (startDate: string, endDate: string) => void;
  title?: string;
}

export function parseRelativeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.toLowerCase().trim();
  const now = new Date();
  if (clean.includes("today")) {
    return now;
  }
  if (clean.includes("yesterday")) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (clean.includes("days ago")) {
    const match = clean.match(/(\d+)\s+days?\s+ago/);
    if (match && match[1]) {
      const d = new Date();
      d.setDate(d.getDate() - Number(match[1]));
      return d;
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function isWithinDateRange(dateStr: string | null | undefined, start: string, end: string): boolean {
  const d = parseRelativeDate(dateStr);
  if (!d) return true;
  
  if (start) {
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    if (d < startDate) return false;
  }
  if (end) {
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    if (d > endDate) return false;
  }
  return true;
}

export default function ExportDateModal({ isOpen, onClose, onExport, title = "Export Report" }: ExportDateModalProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-[20px] border border-slate-200/60 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-950">{title}</h3>
          <button onClick={onClose} className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-xs font-semibold text-slate-500">
          Filter records by date range before exporting to CSV. Leave blank to export all records.
        </p>

        <div className="grid gap-4">
          <label>
            <span className="text-xs font-black uppercase text-slate-500">Start Date</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-2 h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[#A6FF2E] focus:ring-2 focus:ring-[#A6FF2E] transition-all"
            />
          </label>

          <label>
            <span className="text-xs font-black uppercase text-slate-500">End Date</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-2 h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[#A6FF2E] focus:ring-2 focus:ring-[#A6FF2E] transition-all"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-[14px] border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onExport(start, end);
              onClose();
            }}
            className="flex-1 rounded-[14px] bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-[var(--color-text)] hover:bg-[var(--color-primary-hover)] transition"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
