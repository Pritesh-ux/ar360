"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inter } from "next/font/google";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import {
  DASHBOARD_NAV_ITEMS,
  filterDashboardNavItems,
  isDashboardNavActive,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "@/config/dashboard-navigation";
import SidebarFooter from "./SidebarFooter";
import SidebarItem from "./SidebarItem";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const USER_SIDEBAR_WIDTH = SIDEBAR_WIDTH;
export const USER_SIDEBAR_COLLAPSED_WIDTH = SIDEBAR_COLLAPSED_WIDTH;

type Props = {
  session: UserPanelSessionSummary | null;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: () => void;
  embedded?: boolean;
};

function fmtRenewal(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function mbToGb(mb: number): number {
  return Math.round((mb / 1024) * 10) / 10;
}

export default function AppSidebar({
  session,
  collapsed = false,
  onCollapsedChange,
  onNavigate,
  embedded = false,
}: Props) {
  const pathname = usePathname();
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const planName = session?.plan.name || "Professional";
  const renewalDate = fmtRenewal(session?.subscription.expiresAt ?? null);
  const usedStorageGb = mbToGb(session?.usage.storageUsedMb ?? 0);
  const totalStorageGb = session?.usage.storageLimitMb ? mbToGb(session.usage.storageLimitMb) : null;
  const notificationCount = session?.unreadNotifications ?? 0;
  const clientActive = session?.addons?.clientManagement ?? false;
  const teamActive = session?.addons?.teamManagement ?? false;
  const objectCaptureActive = session?.platformFlags?.objectCaptureEnabled ?? true;
  const features = session?.features;
  const subscriptionLocked = session?.subscription.active === false;
  const accountSuspended = session?.accountSuspended === true;

  // Enterprise details live under Billing / Subscription — no separate nav item.
  const navItems = filterDashboardNavItems(DASHBOARD_NAV_ITEMS, {
    clientManagement: clientActive,
    teamManagement: teamActive,
    objectCaptureEnabled: objectCaptureActive,
    allowQr: features?.allowQr,
    allowShare: features?.allowShare,
    allowEmbed: features?.allowEmbed,
    allowAnalytics: features?.allowAnalytics,
    allowCustomBranding: features?.allowCustomBranding,
    allowObjectCapture: features?.allowObjectCapture,
    allowProductContact: features?.allowProductContact,
    accountSuspended,
    // Soft lock: keep full nav; mutations blocked via assertCan + upgrade banner.
  });

  const isOnboarding = !accountSuspended && !subscriptionLocked && !session?.onboarding.complete;
  const primaryItems = accountSuspended
    ? navItems
    : isOnboarding
      ? navItems.slice(0, 1)
      : navItems.slice(0, 6);
  const secondaryItems = accountSuspended || isOnboarding ? [] : navItems.slice(6);

  return (
    <aside
      className={[
        inter.className,
        "user-panel-sidebar flex flex-col overflow-hidden border-r border-white/[0.06] bg-[#141517] text-white shadow-none",
        embedded ? "relative h-full" : "fixed left-0 top-0 z-50 h-screen",
      ].join(" ")}
      style={{ width: embedded ? "100%" : width }}
      aria-label="Dashboard navigation"
    >
      <div className={`shrink-0 border-b border-white/[0.06] ${collapsed ? "px-2 py-4" : "px-4 py-4"}`}>
        <Link
          href={accountSuspended ? "/dashboard/support" : "/dashboard"}
          onClick={onNavigate}
          className={`flex h-9 items-center ${collapsed ? "justify-center" : ""}`}
        >
          {collapsed ? (
            <BrandLogo tone="dark" variant="mark" href={null} />
          ) : (
            <BrandLogo tone="dark" variant="wordmark" href={null} />
          )}
        </Link>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5"
        aria-label="Main menu"
      >
        {primaryItems.map((item) => (
          <SidebarItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
            active={isDashboardNavActive(pathname, item)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}

        {secondaryItems.length > 0 ? (
          <>
            {secondaryItems.map((item) => (
              <SidebarItem
                key={item.href}
                label={item.label}
                href={item.href}
                icon={item.icon}
                active={isDashboardNavActive(pathname, item)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </>
        ) : null}
      </nav>

      <SidebarFooter
        collapsed={collapsed}
        planName={planName}
        renewalDate={renewalDate}
        usedStorageGb={usedStorageGb}
        totalStorageGb={totalStorageGb}
        notificationCount={notificationCount}
        planHref={
          accountSuspended
            ? "/dashboard/support"
            : session?.hasActiveEnterpriseContract
              ? "/dashboard/billing"
              : "/dashboard/subscription#available-plans"
        }
        ctaLabel={
          accountSuspended
            ? "Contact support"
            : session?.hasActiveEnterpriseContract
              ? "Manage plan"
              : "Upgrade Plan"
        }
        showCta
        onNavigate={onNavigate}
      />

      {onCollapsedChange ? (
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="mx-2 mb-3 flex h-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] text-white/40 transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-white/70"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      ) : null}
    </aside>
  );
}
