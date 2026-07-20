"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type Props = {
  planName: string;
  renewalDate: string;
  usedStorageGb: number;
  totalStorageGb: number | null;
  upgradeHref: string;
  onNavigate?: () => void;
};

function clampPercent(used: number, total: number | null): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

function fmtGb(value: number): string {
  if (value >= 1) return `${value.toFixed(1)} GB`;
  if (value > 0) return `${value.toFixed(1)} GB`;
  return "0 GB";
}

export default function PlanCard({
  planName,
  renewalDate,
  usedStorageGb,
  totalStorageGb,
  upgradeHref,
  onNavigate,
}: Props) {
  const [open, setOpen] = useState(true);
  const percent = clampPercent(usedStorageGb, totalStorageGb);
  const usedLabel = fmtGb(usedStorageGb);
  const totalLabel = totalStorageGb ? fmtGb(totalStorageGb) : "∞";

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4 shadow-none">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#C8FF46] text-[13px] font-black text-[#171717]">
          {planName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white" title={`${planName} plan`}>
            {planName}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-white/55">Renews {renewalDate}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-expanded={open}
          aria-label={open ? "Collapse plan details" : "Expand plan details"}
        >
          <ChevronDown
            size={18}
            strokeWidth={2.2}
            className={`transition-transform duration-200 ${open ? "" : "-rotate-180"}`}
          />
        </button>
      </div>

      {open ? (
        <>
          <p className="mt-4 text-[12px] font-medium text-white/70">
            <span className="font-semibold text-[#C8FF46]">{usedLabel}</span>
            {" / "}
            {totalLabel} used
          </p>

          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[#C8FF46] transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <Link
            href={upgradeHref}
            onClick={onNavigate}
            className="mt-4 flex h-10 w-full items-center justify-center rounded-2xl bg-[#C8FF46] text-[13px] font-bold text-[#171717] transition hover:bg-[#D5FF73] active:scale-[0.99]"
          >
            Upgrade Plan
          </Link>
        </>
      ) : null}
    </div>
  );
}
