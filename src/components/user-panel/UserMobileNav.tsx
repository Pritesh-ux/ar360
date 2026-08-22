"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { AppSidebar } from "@/components/user-panel/sidebar";
import { SIDEBAR_WIDTH } from "@/config/dashboard-navigation";
import ViewportPortal from "@/components/shared/ViewportPortal";

type Props = {
  open: boolean;
  onClose: () => void;
  session: UserPanelSessionSummary | null;
};

export default function UserMobileNav({ open, onClose, session }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <ViewportPortal lockScroll={false}>
    <div className="fixed inset-0 z-[99999] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="absolute inset-y-0 left-0 shadow-[8px_0_30px_rgba(0,0,0,0.15)]"
        style={{ width: SIDEBAR_WIDTH }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--ar-border)] bg-white/90 text-[var(--ar-text-muted)] backdrop-blur-sm transition-colors hover:bg-white hover:text-[var(--ar-text)]"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
          <AppSidebar session={session} onNavigate={onClose} embedded />
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
}
