"use client";

import Link from "next/link";

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
  if (value >= 10) return `${value.toFixed(1)} GB`;
  if (value >= 1) return `${value.toFixed(1)} GB`;
  if (value > 0) return `${value.toFixed(1)} GB`;
  return "0 GB";
}

export default function SidebarPlanCard({
  planName,
  renewalDate,
  usedStorageGb,
  totalStorageGb,
  upgradeHref,
  onNavigate,
}: Props) {
  const percent = clampPercent(usedStorageGb, totalStorageGb);
  const usedLabel = fmtGb(usedStorageGb);
  const totalLabel = totalStorageGb ? fmtGb(totalStorageGb) : "∞";
  const planInitial = planName.charAt(0).toUpperCase() || "P";

  return (
    <div className="relative z-[2] mx-[8px] rounded-[12px] border border-black/[0.04] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-b from-[#9AF500] to-[#43CE00] text-[13px] font-semibold text-white"
          aria-hidden
        >
          {planInitial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold leading-tight text-[#151515]">{planName} Plan</p>
          <p className="mt-0.5 text-[10px] leading-tight text-[#555555]">Renews on {renewalDate}</p>
        </div>
      </div>

      <p className="mt-5 text-[11px] font-medium leading-none text-[#555555]">
        <span className="font-semibold text-[#3BA91C]">{usedLabel}</span>
        {" / "}
        {totalLabel} Used
      </p>

      <div
        className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full bg-[#E9E9E9]"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Storage used ${usedLabel} of ${totalLabel}`}
      >
        <div
          className="h-full rounded-full bg-[#68D511] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      <Link
        href={upgradeHref}
        onClick={onNavigate}
        className="mt-[17px] flex h-[41px] w-full items-center justify-center rounded-[10px] bg-gradient-to-b from-[#F5FCEB] to-[#ECF8DF] text-[12px] font-medium text-[#3BA91C] transition hover:from-[#EFF9E0] hover:to-[#E4F5D4] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55CE0C]"
      >
        Upgrade Plan
      </Link>
    </div>
  );
}
