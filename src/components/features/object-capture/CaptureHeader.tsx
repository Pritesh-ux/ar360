"use client";

import React from "react";

type Props = {
  photoCount: number;
  requiredPhotos: number;
};

export function CaptureHeader({ photoCount, requiredPhotos }: Props) {
  const percentage = Math.min((photoCount / requiredPhotos) * 100, 100);

  return (
    <header className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#84D400]">
            Object Capture
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-[#111111] md:text-[28px]">
            Object Capture Studio
          </h1>
          <p className="mt-1.5 text-[14px] font-medium text-[#737373]">
            Capture high-fidelity photos and generate web-ready AR 3D assets automatically.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-4">
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
              Session Progress
            </p>
            <p className="text-lg font-semibold text-[#111111]">
              {photoCount}{" "}
              <span className="text-xs font-medium text-[#737373]">/ {requiredPhotos} Photos</span>
            </p>
          </div>
          <div className="relative flex h-12 w-12 items-center justify-center">
            <svg className="h-full w-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                className="fill-none stroke-[#ECECEC]"
                strokeWidth="4"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                className="fill-none stroke-[#84D400] transition-all duration-500 ease-out"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - percentage / 100)}`}
              />
            </svg>
            <span className="absolute text-[10px] font-semibold text-[#525252]">
              {Math.round(percentage)}%
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
