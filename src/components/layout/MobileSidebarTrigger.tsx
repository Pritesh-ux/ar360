"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";

type Props = {
  onOpen: () => void;
  planName?: string;
};

export default function MobileSidebarTrigger({ onOpen, planName }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--ar-border)] bg-white/90 px-4 backdrop-blur-xl md:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ar-border)] bg-white text-[#111111] transition-colors hover:bg-[var(--ar-surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55CE0C]"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className="min-w-0">
        <BrandLogo tone="light" variant="wordmark" href="/dashboard" size={26} />
        <p className="mt-0.5 text-[11px] font-medium text-[#5B5B5B]">{planName || "Dashboard"}</p>
      </div>
    </header>
  );
}
