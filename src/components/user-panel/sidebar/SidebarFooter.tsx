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
  onNavigate?: () => void;
};

export default function SidebarFooter({
  collapsed = false,
  planName,
  renewalDate,
  usedStorageGb,
  totalStorageGb,
  notificationCount,
  onNavigate,
}: Props) {
  return (
    <div
      className={[
        "shrink-0 space-y-3 border-t border-white/10 py-4",
        collapsed ? "px-2" : "px-3",
      ].join(" ")}
    >
      {!collapsed ? (
        <PlanCard
          planName={planName}
          renewalDate={renewalDate}
          usedStorageGb={usedStorageGb}
          totalStorageGb={totalStorageGb}
          upgradeHref="/dashboard/subscription#available-plans"
          onNavigate={onNavigate}
        />
      ) : (
        <Link
          href="/dashboard/subscription"
          onClick={onNavigate}
          title={`${planName} plan`}
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C8FF46] text-[12px] font-black text-[#171717]"
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
