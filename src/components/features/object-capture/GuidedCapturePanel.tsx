"use client";

import React from "react";
import { Check, Compass, Info } from "lucide-react";
import { useLiveCaptureGuide } from "@/hooks/useLiveCaptureGuide";

type Props = {
  photoCount: number;
  cameraReady: boolean;
};

const ANGLES = ["Front", "Left", "Back", "Right", "Top", "Bottom"];

export function GuidedCapturePanel({ photoCount, cameraReady }: Props) {
  const guide = useLiveCaptureGuide(photoCount, cameraReady);

  const currentAngleIndex = Math.min(ANGLES.length - 1, Math.floor(photoCount / 14));

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-50 pb-4 mb-4">
        <Compass className="h-5 w-5 text-[#00B2CA]" />
        <h3 className="font-semibold text-slate-900">Angle Coverage Guide</h3>
      </div>

      {/* Guide message banner */}
      <div className="rounded-2xl bg-slate-50 p-4 mb-5">
        <div className="flex items-start gap-2.5">
          <Info className="h-4.5 w-4.5 mt-0.5 flex-shrink-0 text-[#00B2CA]" />
          <div>
            <p className="text-xs font-semibold text-slate-800">Active Suggestion</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {guide.message}
            </p>
          </div>
        </div>
      </div>

      {/* Target Angle Checklist */}
      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sequence Progress</span>
        
        <div className="grid grid-cols-2 gap-2 mt-2">
          {ANGLES.map((angle, idx) => {
            const isCompleted = photoCount >= (idx + 1) * 14;
            const isActive = idx === currentAngleIndex && cameraReady;

            return (
              <div
                key={angle}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  isCompleted
                    ? "border-emerald-100 bg-emerald-50/50 text-emerald-800"
                    : isActive
                    ? "border-cyan-200 bg-cyan-50/30 text-[#00B2CA] ring-1 ring-cyan-200"
                    : "border-slate-100 bg-white text-slate-400"
                }`}
              >
                <span>{angle} Angle</span>
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : isActive ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00B2CA] animate-ping" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
