"use client";

import Link from "next/link";
import type { DashboardNavItem } from "@/config/dashboard-navigation";

type Props = {
  item: DashboardNavItem;
  active: boolean;
  onNavigate?: () => void;
};

export default function SidebarNavItem({ item, active, onNavigate }: Props) {
  const Icon = item.icon;

  return (
    <div className="relative px-[5px]">
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={[
          "group relative flex h-[46px] items-center rounded-[10px] transition-colors duration-150",
          active
            ? "bg-gradient-to-r from-white via-[#F8FFF2] to-[#EFF9E4] shadow-[0_4px_12px_rgba(28,44,22,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
            : "bg-transparent hover:[&_.sidebar-nav-label]:bg-[#F3F3F1]",
        ].join(" ")}
      >
        <span
          className={[
            "relative z-[2] flex w-[58px] shrink-0 items-center justify-center",
            active ? "text-[#49C329]" : "text-white",
          ].join(" ")}
        >
          <Icon size={20} strokeWidth={2} aria-hidden />
        </span>
        <span
          className={[
            "sidebar-nav-label relative z-[2] min-w-0 flex-1 rounded-[8px] py-2 pr-3 text-[14px] font-medium leading-none transition-colors duration-150",
            active ? "font-semibold text-[#42B928]" : "text-[#101010]",
          ].join(" ")}
        >
          {item.label}
        </span>
      </Link>
    </div>
  );
}
