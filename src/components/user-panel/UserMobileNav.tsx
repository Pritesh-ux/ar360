"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { AppSidebar } from "@/components/user-panel/sidebar";
import { SIDEBAR_WIDTH } from "@/config/dashboard-navigation";

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
    <div className="fixed inset-0 z-[300] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 transition-opacity duration-200"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="absolute inset-y-0 left-0 shadow-2xl"
        style={{ width: SIDEBAR_WIDTH }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-2xl border border-[#ECECEC] bg-white text-[#737373]"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
          <AppSidebar session={session} onNavigate={onClose} embedded />
        </div>
      </div>
    </div>
  );
}
