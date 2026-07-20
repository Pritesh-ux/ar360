"use client";

import React from "react";
import { Play, Square, RotateCcw, HelpCircle } from "lucide-react";

type Props = {
  isRunning: boolean;
  captured: number;
  maxPhotos: number;
  progress: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
};

export function TurntableModeCard({
  isRunning,
  captured,
  maxPhotos,
  progress,
  onStart,
  onStop,
  onReset,
}: Props) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Turntable Rig Mode</h3>
          <p className="text-xs text-slate-400">Automated timed photo capture</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isRunning
              ? "bg-[#00B2CA]/10 text-[#00B2CA] animate-pulse"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {isRunning ? "Running" : "Standby"}
        </span>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Captured Progress</span>
            <span className="font-bold">
              {captured} / {maxPhotos}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#00B2CA] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 flex gap-2">
          <HelpCircle className="h-4.5 w-4.5 flex-shrink-0 text-slate-400 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-normal">
            Place product on a rotating lazy Susan turntable. Auto-snaps one image every 1.8 seconds.
          </p>
        </div>

        {/* Action Triggers Grid */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onStart}
            disabled={isRunning}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-white transition-all shadow"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start
          </button>

          <button
            onClick={onStop}
            disabled={!isRunning}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold text-slate-700 transition-all"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Pause
          </button>

          <button
            onClick={onReset}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-500 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
