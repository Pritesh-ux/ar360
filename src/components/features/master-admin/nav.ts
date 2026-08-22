import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  Database,
  FileClock,
  FileText,
  Flag,
  HardDrive,
  HeartPulse,
  LayoutDashboard,
  Layers,
  Mail,
  Package,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Ticket,
  UserCog,
  UserPlus,
  Users,
  Puzzle,
  Globe,
} from "lucide-react";
import type { AdminPermission } from "@/lib/permissions/admin-permissions";

export type MasterAdminNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  mobilePrimary?: boolean;
  badge?: string;
};

export type MasterAdminNavGroup = {
  id: string;
  label: string;
  items: MasterAdminNavItem[];
};

export type MasterAdminQuickAction = {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permissions?: AdminPermission[];
};

/** Grouped Master Admin navigation (5 sections). */
export const masterAdminNavGroups: MasterAdminNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { name: "Overview", href: "/master-admin", icon: LayoutDashboard, mobilePrimary: true },
      { name: "Notifications", href: "/master-admin/notifications", icon: Bell },
      { name: "Viewer Analytics", href: "/master-admin/viewer-analytics", icon: BarChart3 },
      { name: "Live Visitors", href: "/master-admin/web-analytics", icon: Activity },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { name: "Customers", href: "/master-admin/customers", icon: Users, mobilePrimary: true },
      { name: "Support Tickets", href: "/master-admin/support-tickets", icon: Ticket },
      { name: "Object Capture", href: "/master-admin/object-capture", icon: ScanLine },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { name: "Enterprise Requests", href: "/master-admin/enterprise-requests", icon: Building2 },
      { name: "Billing", href: "/master-admin/billing", icon: CreditCard },
      {
        name: "Subscriptions",
        href: "/master-admin/subscriptions",
        icon: SlidersHorizontal,
        mobilePrimary: true,
      },
      { name: "Plans & Pricing", href: "/master-admin/plans", icon: FileText },
      { name: "Coupons", href: "/master-admin/coupons", icon: Tag },
      { name: "Premium Add-ons", href: "/master-admin/addons", icon: Puzzle },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { name: "Products", href: "/master-admin/products", icon: Package, mobilePrimary: true },
      { name: "Landing Page", href: "/master-admin/website", icon: Globe },
      { name: "Email Center", href: "/master-admin/email-center", icon: Mail },
      { name: "Storage", href: "/master-admin/storage", icon: HardDrive },
    ],
  },
  {
    id: "ar360-system",
    label: "AR360 System",
    items: [
      { name: "Releases", href: "/master-admin/ar360-system/releases", icon: Rocket },
      { name: "Stable Releases", href: "/master-admin/ar360-system/stable-releases", icon: ShieldCheck },
      { name: "Channels", href: "/master-admin/ar360-system/channels", icon: Layers },
      { name: "Component Versions", href: "/master-admin/ar360-system/component-versions", icon: Layers },
      { name: "Migrations", href: "/master-admin/ar360-system/migrations", icon: RefreshCw },
      { name: "Client Updates", href: "/master-admin/ar360-system/client-updates", icon: Users },
      { name: "Customer Rollouts", href: "/master-admin/ar360-system/customer-rollouts", icon: Rocket },
      { name: "Platform Compatibility", href: "/master-admin/ar360-system/platform-compatibility", icon: Search },
      { name: "Platform Updates", href: "/master-admin/ar360-system/platform-updates", icon: Bell },
      { name: "Customer Update Requests", href: "/master-admin/ar360-system/customer-update-requests", icon: FileText },
      { name: "Feature Flags", href: "/master-admin/ar360-system/feature-flags", icon: Flag },
      { name: "Product Resolution", href: "/master-admin/ar360-system/product-resolution", icon: Search },
      { name: "System Status", href: "/master-admin/ar360-system/status", icon: Activity },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { name: "Admins", href: "/master-admin/admins", icon: UserCog },
      { name: "Security", href: "/master-admin/security", icon: Shield },
      { name: "Settings", href: "/master-admin/settings", icon: Settings },
      { name: "Database", href: "/master-admin/database", icon: Database },
      { name: "System Health", href: "/master-admin/system-health", icon: HeartPulse },
      { name: "Audit Logs", href: "/master-admin/audit-logs", icon: ShieldCheck },
      { name: "Logs", href: "/master-admin/activity-logs", icon: FileClock },
      { name: "Login Logs", href: "/master-admin/login-logs", icon: FileClock },
    ],
  },
];

/** Flat list kept for mobile primary filter + legacy callers. */
export const masterAdminNav: MasterAdminNavItem[] = masterAdminNavGroups.flatMap(
  (group) => group.items,
);

export const masterAdminQuickActions: MasterAdminQuickAction[] = [
  {
    name: "Landing Page",
    description: "Homepage CMS, policies, models, and website assets",
    href: "/master-admin/website",
    icon: Globe,
    permissions: ["settings.manage"],
  },
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

  if (target === "/master-admin/website") {
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

/** Open the group that contains the current route by default. */
export function defaultOpenNavGroupIds(pathname: string): string[] {
  const open = new Set<string>();
  for (const group of masterAdminNavGroups) {
    if (group.items.some((item) => isNavActive(pathname, item.href))) {
      open.add(group.id);
    }
  }
  if (!open.size) open.add("overview");
  return [...open];
}
