"use client";

import Link from "next/link";
import PlanCard from "./PlanCard";
import SidebarBottomActions from "@/components/layout/SidebarBottomActions";

type Props = {
  collapsed?: boolean;
  planName: string;
  renewalDate: string;
  usedStorageGb: number;
  totalStorageGb: number | null;
  notificationCount: number;
  planHref?: string;
  ctaLabel?: string;
  showCta?: boolean;
  onNavigate?: () => void;
};

export default function SidebarFooter({
  collapsed = false,
  planName,
  renewalDate,
  usedStorageGb,
  totalStorageGb,
  notificationCount,
  planHref = "/dashboard/subscription#available-plans",
  ctaLabel = "Upgrade Plan",
  showCta = true,
  onNavigate,
}: Props) {
  return (
    <div
      className={[
        "shrink-0 space-y-3 border-t border-white/[0.06] py-4",
        collapsed ? "px-2" : "px-3",
      ].join(" ")}
    >
      {!collapsed ? (
        <PlanCard
          planName={planName}
          renewalDate={renewalDate}
          usedStorageGb={usedStorageGb}
          totalStorageGb={totalStorageGb}
          upgradeHref={planHref}
          ctaLabel={ctaLabel}
          showCta={showCta}
          onNavigate={onNavigate}
        />
      ) : (
        <Link
          href={planHref.split("#")[0] || "/dashboard/subscription"}
          onClick={onNavigate}
          title={`${planName} plan`}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#C8FF46] text-[11px] font-black text-[#171717]"
        >
          {planName.charAt(0).toUpperCase()}
        </Link>
      )}

      <div className={collapsed ? "flex justify-center" : "flex items-center justify-end"}>
        <SidebarBottomActions notificationCount={notificationCount} stacked={collapsed} />
      </div>
    </div>
  );
}
