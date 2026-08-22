"use client";

import { Box, Camera, QrCode, Share2 } from "lucide-react";

const floating = [
  {
    Icon: Camera,
    className: "left-[2%] top-[20%] bg-sky-50 text-[#3B82F6] dash-hero-float",
  },
  {
    Icon: QrCode,
    className: "right-[4%] top-[12%] bg-violet-50 text-[#A855F7] dash-hero-float-delay",
  },
  {
    Icon: Share2,
    className: "right-[6%] bottom-[22%] bg-blue-50 text-[#3B82F6] dash-hero-float",
  },
  {
    Icon: Box,
    className: "left-[6%] bottom-[18%] bg-[#F0FDF4] text-[#22C55E] dash-hero-float-delay",
  },
];

export default function DashboardHeroIllustration() {
  return (
    <div className="relative mx-auto flex h-[160px] w-full max-w-[300px] items-center justify-center md:h-[170px]">
      <div className="dash-hero-glow absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(182,255,56,0.14),transparent_68%)]" />

      {/* Orbit rings */}
      <div className="dash-hero-orbit pointer-events-none absolute h-[200px] w-[200px] rounded-full border border-dashed border-[#E5E7EB]/80 opacity-60" />
      <div
        className="dash-hero-orbit pointer-events-none absolute h-[160px] w-[160px] rounded-full border border-dashed border-[#B6FF38]/25 opacity-50"
        style={{ animationDirection: "reverse", animationDuration: "18s" }}
      />

      {/* Browser mockup */}
      <div className="relative z-10 w-[82%] max-w-[280px] overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white/95 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="flex items-center gap-1.5 border-b border-[#F3F4F6] px-3 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#FCA5A5]" />
          <span className="h-2 w-2 rounded-full bg-[#FDE047]" />
          <span className="h-2 w-2 rounded-full bg-[#86EFAC]" />
          <div className="ml-2 h-4 flex-1 rounded-md bg-[#F9FAFB]" />
        </div>
        <div className="relative flex h-[110px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#FAFAFB] to-white">
          {floating.map(({ Icon, className }, index) => (
            <div
              key={index}
              className={`absolute grid h-9 w-9 place-items-center rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.06)] ${className}`}
            >
              <Icon size={16} strokeWidth={2} />
            </div>
          ))}
          <div className="dash-hero-float relative z-10 grid h-[72px] w-[72px] place-items-center rounded-[18px] bg-gradient-to-br from-[#D9FF8C] via-[#B6FF38] to-[#84D400] shadow-[0_12px_32px_rgba(182,255,56,0.35)]">
            <Box size={32} className="text-[#102000]" strokeWidth={1.6} />
          </div>
        </div>
      </div>
    </div>
  );
}
