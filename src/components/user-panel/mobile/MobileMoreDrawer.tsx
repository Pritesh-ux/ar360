"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut, X } from "lucide-react";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import {
  DASHBOARD_NAV_ITEMS,
  filterDashboardNavItems,
  isDashboardNavActive,
} from "@/config/dashboard-navigation";
import ViewportPortal from "@/components/shared/ViewportPortal";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { logoutAction } from "@/app/auth/actions";

const BOTTOM_HREFS = new Set([
  "/dashboard",
  "/dashboard/products",
  "/dashboard/qr-center",
  "/dashboard/settings",
  "/dashboard/products?upload=1",
]);

/** Keep mobile menu light — Analytics stays desktop-only. */
const MOBILE_HIDDEN_HREFS = new Set(["/dashboard/analytics"]);

type Props = {
  open: boolean;
  onClose: () => void;
  session: UserPanelSessionSummary | null;
};

export default function MobileMoreDrawer({ open, onClose, session }: Props) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    // Close drawer on route change only — do not depend on onClose identity
    // (inline callbacks would instantly re-close after open).
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname is the intentional trigger
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const items = useMemo(() => {
    const access = {
      objectCaptureEnabled: session?.platformFlags.objectCaptureEnabled,
      clientManagement: session?.addons.clientManagement,
      teamManagement: session?.addons.teamManagement,
      allowQr: session?.features.allowQr,
      allowShare: session?.features.allowShare,
      allowEmbed: session?.features.allowEmbed,
      allowAnalytics: session?.features.allowAnalytics,
      allowCustomBranding: session?.features.allowCustomBranding,
      allowObjectCapture: session?.features.allowObjectCapture,
      allowProductContact: session?.features.allowProductContact,
      accountSuspended: session?.accountSuspended === true,
    };
    const base = [...DASHBOARD_NAV_ITEMS];
    return filterDashboardNavItems(base, access).filter(
      (item) => !BOTTOM_HREFS.has(item.href) && !MOBILE_HIDDEN_HREFS.has(item.href),
    );
  }, [session]);

  function handleLogout() {
    setLoggingOut(true);
    startTransition(async () => {
      try {
        await logoutAction();
      } catch {
        setLoggingOut(false);
      }
    });
  }

  return (
    <ViewportPortal lockScroll={false}>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[99999] md:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              className="absolute inset-y-0 right-0 flex h-full w-[min(100vw-40px,340px)] flex-col bg-[#141517] pt-[env(safe-area-inset-top)] text-white shadow-[-12px_0_40px_rgba(0,0,0,0.35)]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <BrandLogo tone="dark" variant="wordmark" href="/dashboard" size={34} />
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-12 w-12 place-items-center rounded-[14px] text-[#9CA3AF] transition hover:bg-white/10 hover:text-white"
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="border-b border-white/10 px-4 py-3">
                <p className="truncate text-[15px] font-semibold text-white">
                  {session?.user.name || "Account"}
                </p>
                <p className="truncate text-[12px] font-medium text-[#9CA3AF]">
                  {session?.user.email || session?.plan.name || "AR360 Studio"}
                </p>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
                  More
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isDashboardNavActive(pathname, item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={[
                            "flex min-h-12 items-center gap-3 rounded-[14px] px-3 text-[14px] font-semibold transition",
                            active
                              ? "bg-[#C8FF46] text-[#141517]"
                              : "text-[#E5E7EB] hover:bg-white/[0.08]",
                          ].join(" ")}
                        >
                          <Icon size={18} strokeWidth={2} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="border-t border-white/10 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut || pending}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-white/[0.08] text-[14px] font-semibold text-[#FCA5A5] transition hover:bg-white/[0.12] disabled:opacity-60"
                >
                  {loggingOut || pending ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  Logout
                </button>
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </ViewportPortal>
  );
}
