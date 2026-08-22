"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Zap, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import AdminQuickActionsDrawer from "./AdminQuickActionsDrawer";
import AdminComposeMailModal, { type ComposeMailDefaults } from "./AdminComposeMailModal";
import AdminTopBar from "./AdminTopBar";
import {
  MasterAdminNotificationsProvider,
  useMasterAdminNotifications,
} from "./MasterAdminNotificationsContext";
import { MasterAdminToastProvider } from "./MasterAdminToastContext";
import {
  defaultOpenNavGroupIds,
  filterQuickActionsByPermissions,
  isNavActive,
  masterAdminNav,
  masterAdminNavGroups,
} from "./nav";
import "@/components/dashboard/dashboard-premium.css";
import ViewportPortal from "@/components/shared/ViewportPortal";

type AdminSession = {
  name: string;
  email: string;
  roleCode: string;
  permissions: string[];
};

function formatRoleLabel(roleCode: string) {
  return roleCode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Full document navigation — avoids Next RSC/prefetch cookie races that look like logout on VPS. */
function hardNavigate(href: string, onNavigate?: () => void) {
  onNavigate?.();
  if (typeof window !== "undefined") {
    window.location.assign(href);
  }
}

function SidebarContent({
  collapsed,
  pathname,
  onNavigate,
  unreadCount,
  customerUnreadCount,
  onCustomerNotificationsRead,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
  unreadCount: number;
  customerUnreadCount: number;
  onCustomerNotificationsRead?: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<string[]>(() => defaultOpenNavGroupIds(pathname));

  useEffect(() => {
    setOpenGroups((prev) => {
      const required = defaultOpenNavGroupIds(pathname);
      const next = new Set(prev);
      for (const id of required) next.add(id);
      return [...next];
    });
  }, [pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div
        className={`flex h-[72px] shrink-0 items-center border-b border-slate-200/80 ${collapsed ? "justify-center px-2" : "px-4"}`}
      >
        <Link
          href="/master-admin"
          prefetch={false}
          onClick={(event) => {
            event.preventDefault();
            hardNavigate("/master-admin", onNavigate);
          }}
          className={`flex min-w-0 items-center ${collapsed ? "justify-center" : ""}`}
          aria-label="AR360 Master Admin overview"
        >
          {collapsed ? (
            <BrandLogo tone="light" variant="mark" href={null} size={34} />
          ) : (
            <span className="flex min-w-0 flex-col justify-center gap-0.5">
              <BrandLogo tone="light" variant="wordmark" href={null} size={40} />
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                Master Admin
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1.5 py-4 [scrollbar-width:thin]"
        aria-label="Master Admin navigation"
      >
        {masterAdminNavGroups.map((group) => {
          const isOpen = collapsed || openGroups.includes(group.id);
          return (
            <div key={group.id} className="space-y-0.5">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex h-8 w-full items-center justify-between rounded-[5px] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#6B7280]"
                  aria-expanded={isOpen}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  />
                </button>
              ) : null}
              {isOpen
                ? group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(pathname, item.href);
                    const itemUnreadCount =
                      item.href === "/master-admin/notifications"
                        ? unreadCount
                        : item.href === "/master-admin/customers"
                          ? customerUnreadCount
                          : 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        title={item.name}
                        onClick={(event) => {
                          event.preventDefault();
                          if (item.href === "/master-admin/customers" && itemUnreadCount > 0) {
                            onCustomerNotificationsRead?.();
                          }
                          hardNavigate(item.href, onNavigate);
                        }}
                        aria-current={active ? "page" : undefined}
                        aria-label={collapsed ? item.name : undefined}
                        className={[
                          "group flex h-10 items-center rounded-[5px] text-[12px] font-medium transition-colors duration-150",
                          collapsed ? "justify-center px-2" : "gap-3 px-3",
                          active
                            ? "bg-[rgba(182,255,56,0.16)] text-[#18210D]"
                            : "text-[#1F2937] hover:bg-[#F3F4F6]",
                        ].join(" ")}
                      >
                        <span className="relative shrink-0">
                          <Icon
                            size={18}
                            strokeWidth={1.8}
                            className={active ? "text-[#5AA700]" : "text-[#111827]"}
                          />
                          {itemUnreadCount > 0 && collapsed ? (
                            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                              {itemUnreadCount > 99 ? "99+" : itemUnreadCount}
                            </span>
                          ) : null}
                        </span>
                        {!collapsed && (
                          <>
                            <span className="truncate">{item.name}</span>
                            {itemUnreadCount > 0 ? (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                {itemUnreadCount > 99 ? "99+" : itemUnreadCount}
                              </span>
                            ) : null}
                            {item.badge ? (
                              <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
                                {item.badge}
                              </span>
                            ) : null}
                          </>
                        )}
                      </Link>
                    );
                  })
                : null}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-slate-200/80 bg-white px-2 py-3">
        <button
          type="button"
          title="Logout"
          className={[
            "flex h-10 w-full items-center rounded-[6px] text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900",
            collapsed ? "justify-center px-2" : "gap-3 px-3",
          ].join(" ")}
          onClick={() => {
            void (async () => {
              try {
                await fetch("/master-admin/logout", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "content-type": "application/json" },
                });
              } catch {
                // still navigate to login
              }
              hardNavigate("/master-admin/login", onNavigate);
            })();
          }}
        >
          <LogOut size={17} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

function MasterAdminShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<ComposeMailDefaults | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const { unreadCount, notifications, markRead } = useMasterAdminNotifications();
  const customerUnreadCount = notifications.filter(
    (item) => item.category === "customer" && !item.isRead,
  ).length;
  const markCustomerNotificationsRead = () => {
    const ids = notifications
      .filter((item) => item.category === "customer" && !item.isRead)
      .map((item) => item.id);
    if (ids.length) void markRead(ids);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAdmin() {
      try {
        const response = await fetch("/api/master-admin/me", {
          cache: "no-store",
          credentials: "include",
        });
        // Do not hard-redirect on 401 here — sidebar clicks were kicking users to login
        // when the /me API failed while the page session was still valid.
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as {
          admin: {
            name: string;
            email: string;
            roleCode: string;
            permissions: string[];
          };
        };

        setAdminSession({
          name: data.admin.name,
          email: data.admin.email,
          roleCode: data.admin.roleCode,
          permissions: data.admin.permissions,
        });
      } catch {
        // Keep the existing fallback values in the top bar.
      }
    }

    void loadAdmin();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  const quickActions = useMemo(
    () =>
      filterQuickActionsByPermissions(
        adminSession?.permissions ?? [],
        adminSession?.roleCode,
      ),
    [adminSession],
  );

  const sidebarWidth = collapsed ? "w-[84px]" : "w-[260px]";

  return (
    <div className="master-admin-shell dash-premium flex h-screen w-full overflow-hidden bg-[#F8F9FA] text-[#111827]">
      <aside
        className={`hidden h-full shrink-0 flex-col overflow-hidden border-r border-[#ECECEC] bg-white lg:flex ${sidebarWidth} transition-[width] duration-200`}
      >
        <div className="min-h-0 flex-1">
          <SidebarContent
            collapsed={collapsed}
            pathname={pathname}
            unreadCount={unreadCount}
            customerUnreadCount={customerUnreadCount}
            onCustomerNotificationsRead={markCustomerNotificationsRead}
          />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="mx-2 mb-3 flex shrink-0 items-center justify-center rounded-lg border border-slate-200 py-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {mobileOpen ? (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-[280px] max-w-[86vw] border-r border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
            <SidebarContent
              collapsed={false}
              pathname={pathname}
              unreadCount={unreadCount}
              customerUnreadCount={customerUnreadCount}
              onCustomerNotificationsRead={markCustomerNotificationsRead}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
        </ViewportPortal>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopBar
          onMenuClick={() => setMobileOpen(true)}
          adminName={adminSession?.name}
          adminRole={adminSession ? formatRoleLabel(adminSession.roleCode) : undefined}
          adminEmail={adminSession?.email}
          onQuickActionsOpen={() => setQuickActionsOpen(true)}
          onComposeMailOpen={() => {
            setComposeDefaults(null);
            setComposeOpen(true);
          }}
          unreadCount={unreadCount}
        />
        <main className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto overflow-x-hidden bg-[#F8F9FA] pb-24 lg:pb-0">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-1 py-1.5 pb-[calc(0.35rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] lg:hidden">
        {masterAdminNav
          .filter((item) => item.mobilePrimary)
          .map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={(event) => {
                  event.preventDefault();
                  hardNavigate(item.href);
                }}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 ${
                  active ? "text-[#5AA700]" : "text-slate-400"
                }`}
              >
                <Icon size={20} />
                <span className="truncate text-[10px] font-bold">{item.name.split(" ")[0]}</span>
              </Link>
            );
          })}
        <button
          type="button"
          onClick={() => setQuickActionsOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-slate-400"
        >
          <Zap size={20} />
          <span className="text-[10px] font-bold">Actions</span>
        </button>
      </nav>

      <AdminQuickActionsDrawer
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        actions={quickActions}
        onComposeMail={() => {
          setComposeDefaults(null);
          setComposeOpen(true);
        }}
      />
      <AdminComposeMailModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        defaults={composeDefaults}
      />
    </div>
  );
}

export default function MasterAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <MasterAdminNotificationsProvider>
      <MasterAdminToastProvider>
        <MasterAdminShellContent>{children}</MasterAdminShellContent>
      </MasterAdminToastProvider>
    </MasterAdminNotificationsProvider>
  );
}
