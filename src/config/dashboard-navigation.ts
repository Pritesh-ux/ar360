import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Box,
  Building2,
  Camera,
  House,
  MessageCircle,
  Palette,
  QrCode,
  MonitorSmartphone,
  ReceiptText,
  ScanLine,
  Settings,
  Share2,
  Users,
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
  { label: "Team", href: "/dashboard/team", icon: Users },
  { label: "Object Capture", href: "/dashboard/object-capture", icon: Camera },
  { label: "QR Center", href: "/dashboard/qr-center", icon: QrCode },
  { label: "Share Center", href: "/dashboard/share-center", icon: Share2 },
  { label: "Embed Center", href: "/dashboard/embed-center", icon: MonitorSmartphone },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Branding", href: "/dashboard/branding", icon: Palette },
  { label: "Subscription", href: "/dashboard/subscription", icon: ScanLine },
  { label: "Billing", href: "/dashboard/billing", icon: ReceiptText },
  { label: "Support", href: "/dashboard/support", icon: MessageCircle },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export const ENTERPRISE_DASHBOARD_NAV_ITEM: DashboardNavItem = {
  label: "Enterprise",
  href: "/dashboard/enterprise",
  icon: Building2,
};

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
