import type { LucideIcon } from "lucide-react";
import {
  DASHBOARD_NAV_ITEMS,
  isDashboardNavActive,
  type DashboardNavItem,
} from "@/config/dashboard-navigation";

/** @deprecated Use DashboardNavItem from @/config/dashboard-navigation */
export type UserNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  matchPrefix?: boolean;
};

export const USER_PRIMARY_NAV: UserNavItem[] = DASHBOARD_NAV_ITEMS.slice(0, 6).map((item) => ({
  name: item.label,
  href: item.href,
  icon: item.icon,
  matchPrefix: !item.exact,
}));

export const USER_BILLING_NAV: UserNavItem[] = DASHBOARD_NAV_ITEMS.slice(6).map((item) => ({
  name: item.label,
  href: item.href,
  icon: item.icon,
  matchPrefix: !item.exact,
}));

export function isNavActive(pathname: string, item: UserNavItem) {
  const mapped: DashboardNavItem = {
    label: item.name,
    href: item.href,
    icon: item.icon,
    exact: item.matchPrefix === false,
  };
  return isDashboardNavActive(pathname, mapped);
}

export { DASHBOARD_NAV_ITEMS, isDashboardNavActive };
