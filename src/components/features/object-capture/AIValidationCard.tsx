"use client";

import React from "react";
import { ShieldCheck, AlertTriangle, AlertCircle } from "lucide-react";
import { ValidationResults } from "@/hooks/useObjectCaptureUpload";

type Props = {
  validation: ValidationResults | null;
  onConfirmProcessAnyway?: () => void;
};

export function AIValidationCard({ validation, onConfirmProcessAnyway }: Props) {
  if (!validation) return null;

  const {
    qualityScore,
    coverageScore,
    blurCount,
    duplicateCount,
    exposureStatus,
    suggestions,
  } = validation;

  const isLowQuality = qualityScore < 60;

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-50 pb-4 mb-4">
        {isLowQuality ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-[#00B2CA]" />
        )}
        <h3 className="font-semibold text-slate-900">AI Validation Report</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Quality score */}
        <div className="rounded-2xl bg-slate-50 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Quality Score</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-2xl font-bold ${
                isLowQuality ? "text-amber-500" : "text-slate-800"
              }`}
            >
              {qualityScore}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                isLowQuality ? "bg-amber-500" : "bg-[#00B2CA]"
              }`}
              style={{ width: `${qualityScore}%` }}
            />
          </div>
        </div>

        {/* Coverage score */}
        <div className="rounded-2xl bg-slate-50 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Coverage Score</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-slate-800">{coverageScore}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00B2CA]"
              style={{ width: `${coverageScore}%` }}
            />
          </div>
        </div>

        {/* Details Grid */}
        <div className="col-span-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-slate-50 p-2">
            <p className="text-[9px] font-semibold uppercase text-slate-400">Blur Count</p>
            <p className={`text-base font-bold mt-0.5 ${blurCount > 0 ? "text-amber-600" : "text-slate-700"}`}>
              {blurCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-50 p-2">
            <p className="text-[9px] font-semibold uppercase text-slate-400">Duplicates</p>
            <p className={`text-base font-bold mt-0.5 ${duplicateCount > 0 ? "text-amber-600" : "text-slate-700"}`}>
              {duplicateCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-50 p-2">
            <p className="text-[9px] font-semibold uppercase text-slate-400">Exposure</p>
            <p className="text-xs font-bold mt-1 text-slate-700 truncate capitalize">{exposureStatus}</p>
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="mt-5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">AI Recommendations</span>
        <ul className="mt-2 space-y-1.5 pl-4 list-disc text-xs text-slate-600">
          {suggestions.map((suggestion, idx) => (
            <li key={idx} className="leading-normal">
              {suggestion}
            </li>
          ))}
        </ul>
      </div>

      {/* Warning Box for Low Quality */}
      {isLowQuality && (
        <div className="mt-5 rounded-2xl bg-amber-50/50 p-4 border border-amber-100/50">
          <div className="flex gap-2">
            <AlertCircle className="h-4.5 w-4.5 mt-0.5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-bold text-amber-900">Quality Score Warning</p>
              <p className="text-[11px] text-amber-700 mt-1 leading-normal">
                Generating models with low-quality photos can lead to alignment failures and visual artifacts. We suggest adding more photos from unique angles or improving illumination.
              </p>
              {onConfirmProcessAnyway && (
                <button
                  onClick={onConfirmProcessAnyway}
                  className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-amber-600 hover:bg-amber-700 px-3 text-[10px] font-bold text-white shadow transition-all"
                >
                  Force Process Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
