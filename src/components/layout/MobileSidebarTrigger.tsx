"use client";

type Props = {
  onOpen: () => void;
  planName?: string;
};

export default function MobileSidebarTrigger({ onOpen, planName }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#ECECEC] bg-white px-4 md:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-black/[0.06] bg-white text-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55CE0C]"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div>
        <p className="text-sm font-bold text-[#0B0B0B]">AR360 Studio</p>
        <p className="text-[11px] font-medium text-[#5B5B5B]">{planName || "Dashboard"}</p>
      </div>
    </header>
  );
}
