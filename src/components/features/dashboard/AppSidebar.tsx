"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { UserSidebarNav } from "@/components/user-panel/UserSidebarParts";

/** Full dark AR360 sidebar used by the product canvas/editor. */
export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="editor-app-rail fixed bottom-0 left-0 top-0 z-50 flex w-[244px] flex-col bg-[#17191D] text-white">
      <div className="flex h-[72px] items-center px-4">
        <Link href="/dashboard" className="flex h-9 items-center" aria-label="AR360 Dashboard">
          <BrandLogo tone="dark" variant="wordmark" href={null} size={36} />
        </Link>
      </div>

      <div className="h-px shrink-0 bg-white/16" />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <UserSidebarNav pathname={pathname} />
      </div>

      <div className="h-px shrink-0 bg-white/16" />

      <div className="p-3">
        <div className="rounded-[18px] border border-white/12 bg-white/[0.045] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#C8FF46] text-[13px] font-black text-[#111416]">P</div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-extrabold text-white">PROFESSIONAL PLAN</div>
              <div className="mt-1 text-[11px] text-white/55">Manage from Subscription</div>
            </div>
          </div>
          <Link
            href="/dashboard/subscription?section=available-plans"
            className="mt-4 flex h-10 items-center justify-center rounded-[12px] bg-[#C8FF46] text-[13px] font-extrabold text-[#111416] transition-colors hover:bg-[#B9F337]"
          >
            Upgrade Plan
          </Link>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-[14px] border border-white/12 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-bold">D</div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-white">Demo Customer</div>
              <div className="truncate text-[10px] text-white/50">customer@ar360.com</div>
            </div>
          </div>
          <Link href="/logout" aria-label="Log out" className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-white/70 hover:bg-white/10 hover:text-white">
            <LogOut size={16} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
