"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type SidebarItemProps = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
};

export default function SidebarItem({
  label,
  href,
  icon: Icon,
  active = false,
  collapsed = false,
  onNavigate,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex items-center rounded-xl transition-all duration-150",
        collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 gap-3 px-3",
        active
          ? "bg-[#C8FF46] text-[#151515] shadow-[0_4px_16px_rgba(200,255,70,0.12)]"
          : "text-white/60 hover:bg-white/[0.05] hover:text-white/90",
      ].join(" ")}
    >
      {active && !collapsed ? (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#151515]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : null}

      <Icon
        size={18}
        strokeWidth={active ? 2.2 : 1.8}
        className={active ? "text-[#151515]" : "text-white/50 group-hover:text-white/80"}
        aria-hidden
      />

      {!collapsed ? (
        <span className={`truncate text-[13px] ${active ? "font-bold text-[#151515]" : "font-medium text-white/70 group-hover:text-white/90"}`}>
          {label}
        </span>
      ) : null}
    </Link>
  );
}
