"use client";

import { CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

type Props = {
  message: string;
  severity: "good" | "warning" | "info";
  progress: number;
  nextAngle: string;
};

export function LiveGuidedCaptureOverlay({ message, severity, progress, nextAngle }: Props) {
  const Icon = severity === "good" ? CheckCircle2 : severity === "warning" ? AlertTriangle : Sparkles;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-4 top-4 rounded-2xl bg-white/90 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#00B2CA]" />
          <p className="text-xs font-semibold text-slate-950">Live Guide</p>
        </div>
        <p className="mt-1 text-xs text-slate-600">{message}</p>
      </div>

      <div className="absolute right-4 top-4 rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur">
        <p className="text-[11px] uppercase tracking-wide text-white/60">Next angle</p>
        <p className="text-sm font-semibold">{nextAngle}</p>
      </div>

      <div className="absolute bottom-4 left-1/2 w-[min(420px,80%)] -translate-x-1/2 rounded-full bg-black/55 p-2 backdrop-blur">
        <div className="h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[#00B2CA] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
