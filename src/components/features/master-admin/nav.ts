import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  Database,
  FileClock,
  FileText,
  HardDrive,
  HeartPulse,
  LayoutDashboard,
  Mail,
  Package,
  Plus,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Ticket,
  UserCog,
  UserPlus,
  Users,
  Puzzle,
} from "lucide-react";
import type { AdminPermission } from "@/lib/permissions/admin-permissions";

export type MasterAdminNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  mobilePrimary?: boolean;
  badge?: string;
};

export type MasterAdminQuickAction = {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permissions?: AdminPermission[];
};

/**
 * Master Admin navigation.
 * Route targets intentionally reuse the existing pages and APIs.
 */
export const masterAdminNav: MasterAdminNavItem[] = [
  { name: "Admins", href: "/master-admin/admins", icon: UserCog },
  { name: "Audit Logs", href: "/master-admin/audit-logs", icon: ShieldCheck },
  { name: "Billing", href: "/master-admin/billing", icon: CreditCard },
  { name: "Coupons", href: "/master-admin/coupons", icon: Tag },
  { name: "Customers", href: "/master-admin/customers", icon: Users, mobilePrimary: true },
  { name: "Database", href: "/master-admin/database", icon: Database },
  { name: "Email Center", href: "/master-admin/email-center", icon: Mail },
  { name: "Enterprise Requests", href: "/master-admin/enterprise-requests", icon: Building2 },
  { name: "Logs", href: "/master-admin/activity-logs", icon: FileClock },
  { name: "Notifications", href: "/master-admin/notifications", icon: Bell },
  { name: "Object Capture", href: "/master-admin/object-capture", icon: ScanLine },
  { name: "Overview", href: "/master-admin", icon: LayoutDashboard, mobilePrimary: true },
  { name: "Plans & Pricing", href: "/master-admin/plans", icon: FileText },
  { name: "Premium Add-ons", href: "/master-admin/addons", icon: Puzzle },
  { name: "Products", href: "/master-admin/products", icon: Package, mobilePrimary: true },
  { name: "Settings", href: "/master-admin/settings", icon: Settings },
  { name: "Storage", href: "/master-admin/storage", icon: HardDrive },
  {
    name: "Subscriptions",
    href: "/master-admin/subscriptions",
    icon: SlidersHorizontal,
    mobilePrimary: true,
  },
  { name: "Support Tickets", href: "/master-admin/support-tickets", icon: Ticket },
  { name: "System Health", href: "/master-admin/system-health", icon: HeartPulse },
  { name: "Viewer Analytics", href: "/master-admin/viewer-analytics", icon: BarChart3 },
];

export const masterAdminQuickActions: MasterAdminQuickAction[] = [
  {
    name: "Add Customer",
    description: "Open customers module to create or import accounts",
    href: "/master-admin/customers",
    icon: UserPlus,
    permissions: ["customers.update"],
  },
  {
    name: "Record Payment",
    description: "Billing ledger — manual payment entry",
    href: "/master-admin/billing",
    icon: CreditCard,
    permissions: ["billing.manual_payment"],
  },
  {
    name: "Issue Refund",
    description: "Review paid invoices and process refunds",
    href: "/master-admin/billing",
    icon: RotateCcw,
    permissions: ["billing.refund"],
  },
  {
    name: "Storage Report",
    description: "Platform storage usage and largest files",
    href: "/master-admin/storage",
    icon: HardDrive,
    permissions: ["storage.read"],
  },
  {
    name: "Open Tickets",
    description: "Support queue and ticket assignments",
    href: "/master-admin/support-tickets",
    icon: Ticket,
    permissions: ["tickets.read"],
  },
  {
    name: "Create Coupon",
    description: "Coupons and promotional codes",
    href: "/master-admin/coupons",
    icon: Tag,
    permissions: ["coupons.manage"],
  },
  {
    name: "Platform Settings",
    description: "SMTP, Razorpay, and platform configuration",
    href: "/master-admin/settings",
    icon: Settings,
    permissions: ["settings.manage"],
  },
  {
    name: "New Product Review",
    description: "Browse recently uploaded customer products",
    href: "/master-admin/products",
    icon: Plus,
    permissions: ["products.read"],
  },
];

export function isNavActive(pathname: string, href: string) {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const target = href.endsWith("/") && href.length > 1 ? href.slice(0, -1) : href;

  if (target === "/master-admin") return normalized === target;

  if (target === "/master-admin/billing") {
    return normalized === target || normalized.startsWith(`${target}/`);
  }

  return normalized === target || normalized.startsWith(`${target}/`);
}

export function filterQuickActionsByPermissions(
  permissions: readonly string[],
  roleCode?: string,
) {
  if (roleCode === "super_admin") return masterAdminQuickActions;
  const set = new Set(permissions);
  return masterAdminQuickActions.filter((action) => {
    if (!action.permissions?.length) return true;
    return action.permissions.some((permission) => set.has(permission));
  });
}
