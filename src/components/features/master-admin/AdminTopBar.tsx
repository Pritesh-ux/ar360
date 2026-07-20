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
      <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl md:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
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
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 md:hidden"
          aria-label="Open search"
        >
          <Search size={18} />
        </button>

        <div className="relative mx-auto hidden w-full max-w-2xl md:block">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setNotificationsOpen(false);
            }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-11 pr-14 text-left text-sm font-medium text-slate-400 transition hover:border-[#7AE02E] hover:bg-white"
          >
            Search users, products, invoices, tickets...
          </button>
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 sm:inline-flex">
            ⌘ K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {onComposeMailOpen && (
            <button
              type="button"
              onClick={onComposeMailOpen}
              className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
            >
              <Mail size={16} className="text-[#4D9A00]" />
              Compose
            </button>
          )}
          {onQuickActionsOpen && (
            <button
              type="button"
              onClick={onQuickActionsOpen}
              className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
            >
              <Zap size={16} className="text-[#4D9A00]" />
              Quick Actions
            </button>
          )}

          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 sm:flex"
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div ref={bellRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setSearchOpen(false);
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
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

          <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#A6FF2E] to-[#7AE02E] text-xs font-black text-slate-900">
              {adminInitials(adminName)}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-bold leading-none text-slate-900">{adminName}</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">{adminRole}</p>
              {adminEmail && (
                <p className="mt-0.5 hidden text-[10px] font-medium text-slate-400 lg:block">{adminEmail}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <AdminGlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
