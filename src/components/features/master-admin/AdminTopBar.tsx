"use client";

import { Bell, Mail, Menu, Moon, Search, Sun, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AdminGlobalSearch from "./AdminGlobalSearch";
import AdminNotificationsPanel from "./AdminNotificationsPanel";

type Props = {
  onMenuClick?: () => void;
  adminName?: string;
  adminRole?: string;
  adminEmail?: string;
  onQuickActionsOpen?: () => void;
  onComposeMailOpen?: () => void;
  unreadCount: number;
};

function adminInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "MA";
}

export default function AdminTopBar({
  onMenuClick,
  adminName = "Signing in…",
  adminRole = "…",
  adminEmail,
  onQuickActionsOpen,
  onComposeMailOpen,
  unreadCount,
}: Props) {
  const [dark, setDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationsOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-[64px] shrink-0 items-center gap-3 border-b border-[#ECECEC] bg-white px-4 md:gap-4 md:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[#ECECEC] text-[#4B5563] transition hover:bg-[#FAFAFB] lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchOpen(true);
            setNotificationsOpen(false);
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[#ECECEC] text-[#4B5563] transition hover:bg-[#FAFAFB] md:hidden"
          aria-label="Open search"
        >
          <Search size={18} />
        </button>

        <div className="relative mx-auto hidden min-w-0 w-full max-w-xl flex-1 md:block lg:max-w-2xl">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setNotificationsOpen(false);
            }}
            className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] pl-11 pr-14 text-left text-sm font-medium text-[#9CA3AF] transition hover:border-[#84D400] hover:bg-white"
          >
            Search users, products, invoices, tickets...
          </button>
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center rounded-[8px] border border-[#ECECEC] bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#9CA3AF] sm:inline-flex">
            ⌘ K
          </kbd>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
          {onComposeMailOpen && (
            <button
              type="button"
              onClick={onComposeMailOpen}
              className="hidden h-9 items-center gap-1.5 rounded-[12px] border border-[#ECECEC] px-2.5 text-[12px] font-semibold text-[#374151] transition hover:bg-[#FAFAFB] lg:inline-flex"
            >
              <Mail size={15} className="text-[#5AA700]" />
              Compose
            </button>
          )}
          {onQuickActionsOpen && (
            <button
              type="button"
              onClick={onQuickActionsOpen}
              className="hidden h-9 items-center gap-1.5 rounded-[12px] border border-[#ECECEC] px-2.5 text-[12px] font-semibold text-[#374151] transition hover:bg-[#FAFAFB] lg:inline-flex"
            >
              <Zap size={15} className="text-[#5AA700]" />
              Quick Actions
            </button>
          )}

          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            className="hidden h-9 w-9 items-center justify-center rounded-[12px] border border-[#ECECEC] text-[#6B7280] transition hover:bg-[#FAFAFB] sm:flex"
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div ref={bellRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setSearchOpen(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#ECECEC] text-[#6B7280] transition hover:bg-[#FAFAFB]"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <AdminNotificationsPanel
              open={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              anchorRef={bellRef}
            />
          </div>

          <div
            className="flex max-w-[200px] items-center gap-2 border-l border-[#ECECEC] pl-2.5 md:max-w-[240px]"
            title={adminEmail || undefined}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#B6FF38] to-[#84D400] text-[11px] font-black text-[#102000]">
              {adminInitials(adminName)}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="truncate text-[13px] font-bold leading-tight text-[#111827]">{adminName}</p>
              <p className="truncate text-[11px] font-medium leading-tight text-[#6B7280]">{adminRole}</p>
            </div>
          </div>
        </div>
      </header>

      <AdminGlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
