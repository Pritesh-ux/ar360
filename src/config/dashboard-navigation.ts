import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Box,
  Building2,
  Camera,
  House,
  Inbox,
  Info,
  MessageCircle,
  Palette,
  QrCode,
  MonitorSmartphone,
  ReceiptText,
  ScanLine,
  Settings,
  Share2,
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When true, only exact path match activates the item */
  exact?: boolean;
};

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: House, exact: true },
  { label: "Products", href: "/dashboard/products", icon: Box },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "Enquiries", href: "/dashboard/enquiries", icon: Inbox },
  { label: "Object Capture", href: "/dashboard/object-capture", icon: Camera },
  { label: "QR Center", href: "/dashboard/qr-center", icon: QrCode },
  { label: "Share Center", href: "/dashboard/share-center", icon: Share2 },
  { label: "Embed Center", href: "/dashboard/embed-center", icon: MonitorSmartphone },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Branding", href: "/dashboard/branding", icon: Palette },
  { label: "Subscription", href: "/dashboard/subscription", icon: ScanLine },
  { label: "Billing", href: "/dashboard/billing", icon: ReceiptText },
  { label: "Support", href: "/dashboard/support", icon: MessageCircle },
  { label: "Platform", href: "/dashboard/platform", icon: Info },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

// Intentionally no customer-panel "Enterprise" nav — contract/plan details are on Billing & Subscription.
// Direct URL /dashboard/enterprise may still work for bookmarked links.

export function isDashboardNavActive(pathname: string, item: DashboardNavItem): boolean {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const href = item.href.endsWith("/") && item.href.length > 1 ? item.href.slice(0, -1) : item.href;

  if (item.exact) {
    return normalized === href;
  }

  if (href === "/dashboard/billing") {
    if (normalized === href) return true;
    if (!normalized.startsWith(`${href}/`)) return false;
    return !normalized.startsWith("/dashboard/billing/subscription");
  }

  return normalized === href || normalized.startsWith(`${href}/`);
}

export type DashboardNavAccess = {
  objectCaptureEnabled?: boolean;
  clientManagement?: boolean;
  /** @deprecated Team Management removed from customer panel — always hidden. */
  teamManagement?: boolean;
  /** Live Master Admin plan gates (default allow when omitted for backward compat). */
  allowQr?: boolean;
  allowShare?: boolean;
  allowEmbed?: boolean;
  allowAnalytics?: boolean;
  allowCustomBranding?: boolean;
  allowObjectCapture?: boolean;
  allowProductContact?: boolean;
  /** False once the trial or paid period lapsed — mutations stay locked; nav stays visible (soft lock). */
  subscriptionActive?: boolean;
  /** Master-admin account suspend — Support only. */
  accountSuspended?: boolean;
};

/** @deprecated Soft-lock shows full nav; kept for older callers. Prefer upgrade CTAs over hiding nav. */
export const SUBSCRIPTION_LOCKED_ALLOWED_HREFS = [
  "/dashboard/subscription",
  "/dashboard/billing",
];

/** Routes an admin-suspended customer may still open. */
export const ACCOUNT_SUSPENDED_ALLOWED_HREFS = ["/dashboard/support"];

/** Hide nav entries the current user cannot access (plan gates + add-ons + platform). */
export function filterDashboardNavItems(
  items: DashboardNavItem[],
  access: DashboardNavAccess = {},
): DashboardNavItem[] {
  if (access.accountSuspended === true) {
    return items.filter((item) => ACCOUNT_SUSPENDED_ALLOWED_HREFS.includes(item.href));
  }

  // Expired trial/plan: keep full nav visible; backend assertCan blocks working actions.

  return items.filter((item) => {
    // Team Management retired from customer panel.
    if (item.href === "/dashboard/team") return false;
    if (item.href === "/dashboard/clients") return access.clientManagement === true;
    if (item.href === "/dashboard/object-capture") {
      return access.objectCaptureEnabled !== false && access.allowObjectCapture !== false;
    }
    if (item.href === "/dashboard/qr-center") return access.allowQr !== false;
    if (item.href === "/dashboard/share-center") return access.allowShare !== false;
    if (item.href === "/dashboard/embed-center") return access.allowEmbed === true;
    if (item.href === "/dashboard/analytics") return access.allowAnalytics === true;
    if (item.href === "/dashboard/branding") return access.allowCustomBranding === true;
    if (item.href === "/dashboard/enquiries") return access.allowProductContact === true;
    return true;
  });
}
