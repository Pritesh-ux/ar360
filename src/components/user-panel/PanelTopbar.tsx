"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, LogOut, Settings, User } from "lucide-react";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { DASHBOARD_NAV_ITEMS, isDashboardNavActive } from "@/config/dashboard-navigation";
import NotificationPopover from "@/components/user-panel/NotificationPopover";

type Props = {
  session: UserPanelSessionSummary | null;
};

function titleForPath(pathname: string) {
  for (const item of DASHBOARD_NAV_ITEMS) {
    if (isDashboardNavActive(pathname, item)) return item.label;
  }
  return "Dashboard";
}

export default function PanelTopbar({ session }: Props) {
  const pathname = usePathname();
  const title = titleForPath(pathname);
  const name = session?.user?.name || "Account";
  const plan = session?.plan?.name || "Trial";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--ar-border)] bg-white/80 px-4 backdrop-blur-xl md:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--ar-text)]">{title}</p>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <NotificationPopover
          initialUnread={session?.unreadNotifications ?? 0}
          buttonClassName="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--ar-border)] bg-white text-[var(--ar-text-muted)] transition-colors hover:bg-[var(--ar-surface-soft)] hover:text-[var(--ar-text)]"
          badgeClassName="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ar-primary)] px-1 text-[10px] font-bold text-[var(--ar-text)]"
          iconSize={16}
        />

        <Link
          href="/dashboard/support"
          className="hidden h-9 w-9 place-items-center rounded-xl border border-[var(--ar-border)] text-[var(--ar-text-muted)] transition-colors hover:bg-[var(--ar-surface-soft)] hover:text-[var(--ar-text)] sm:grid"
          aria-label="Help and support"
        >
          <HelpCircle size={16} />
        </Link>

        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--ar-border)] bg-white py-1 pl-1.5 pr-2.5 transition-colors hover:bg-[var(--ar-surface-soft)]">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--ar-primary-soft)] text-[11px] font-bold text-[var(--ar-text)]">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[120px] truncate text-[12px] font-semibold text-[var(--ar-text)]">{name}</span>
              <span className="block text-[11px] text-[var(--ar-text-muted)]">{plan}</span>
            </span>
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--ar-border)] bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            <Link href="/dashboard/settings" className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--ar-text)] hover:bg-[var(--ar-surface-soft)]">
              <User size={14} /> Profile
            </Link>
            <Link href="/dashboard/settings" className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--ar-text)] hover:bg-[var(--ar-surface-soft)]">
              <Settings size={14} /> Settings
            </Link>
            <Link href="/dashboard/billing" className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--ar-text)] hover:bg-[var(--ar-surface-soft)]">
              Billing
            </Link>
            <div className="my-1 border-t border-[var(--ar-border)]" />
            <Link href="/logout" className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--ar-danger)] hover:bg-red-50">
              <LogOut size={14} /> Logout
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
