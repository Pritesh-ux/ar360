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
        "group relative flex items-center rounded-2xl transition-all duration-200",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "h-11 gap-3 px-3",
        active
          ? "bg-[#C8FF46] text-[#151515] shadow-[0_8px_22px_rgba(200,255,70,0.14)]"
          : "text-white/75 hover:bg-white/[0.07] hover:text-white",
      ].join(" ")}
    >
      {active && !collapsed ? (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#151515]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : null}

      <Icon
        size={20}
        strokeWidth={2}
        className={active ? "text-[#151515]" : "text-white/70 group-hover:text-white"}
        aria-hidden
      />

      {!collapsed ? (
        <span className={`truncate text-[14px] ${active ? "font-bold text-[#151515]" : "font-medium"}`}>
          {label}
        </span>
      ) : null}
    </Link>
  );
}
