"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Loader2, Trash2, X } from "lucide-react";
import { useMasterAdminNotifications } from "./MasterAdminNotificationsContext";

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
};

const CATEGORY_CLASS: Record<string, string> = {
  billing: "bg-violet-50 text-violet-700",
  support: "bg-sky-50 text-sky-700",
  customer: "bg-emerald-50 text-emerald-700",
  product: "bg-amber-50 text-amber-700",
  system: "bg-slate-100 text-slate-600",
  security: "bg-red-50 text-red-700",
};

const PANEL_WIDTH = 380;

function fmtWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function panelPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(window.innerWidth - 32, PANEL_WIDTH);
  const left = Math.min(Math.max(16, rect.right - width), window.innerWidth - width - 16);
  return { top: rect.bottom + 8, left, width };
}

export default function AdminNotificationsPanel({
  open,
  onClose,
  anchorRef,
}: Props) {
  const router = useRouter();
  const {
    notifications: items,
    unreadCount,
    loading,
    error,
    markRead,
    remove,
  } = useMasterAdminNotifications();
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: PANEL_WIDTH });

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    setCoords(panelPosition(anchorRef.current));
  }, [anchorRef]);

  useEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose, anchorRef]);

  function clearAll() {
    if (items.length === 0) return;
    if (!window.confirm("Clear all Master Admin notifications? This cannot be undone.")) return;
    void remove([], true);
  }

  if (!open || typeof document === "undefined") return null;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[90] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-slate-500" />
          <p className="text-sm font-black text-slate-900">Notifications</p>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markRead([], true)}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
            >
              <CheckCheck size={14} />
              Mark all
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="max-h-[min(60vh,420px)] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Loading...
          </div>
        )}
        {!loading && error && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        {!loading && items.length === 0 && (
          <p className="px-4 py-12 text-center text-sm font-medium text-slate-400">You&apos;re all caught up.</p>
        )}

        {!loading &&
          items.map((item) => {
            return (
              <div
                key={item.id}
                role={item.href ? "link" : "button"}
                tabIndex={0}
                onClick={() => {
                  if (!item.isRead) void markRead([item.id]);
                  if (item.href) {
                    onClose();
                    router.push(item.href);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.currentTarget.click();
                  }
                }}
                className={`relative border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50/80 ${
                  !item.isRead ? "bg-[var(--color-primary-soft)]/40" : ""
                }`}
              >
                <div className="mb-1 flex items-center gap-2 pr-7">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORY_CLASS[item.category] || CATEGORY_CLASS.system}`}
                  >
                    {item.category}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">{fmtWhen(item.createdAt)}</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                {item.body && <p className="mt-0.5 text-xs font-medium text-slate-500">{item.body}</p>}
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  title="Delete notification"
                  onClick={(event) => {
                    event.stopPropagation();
                    void remove([item.id]);
                  }}
                  className="absolute right-3 mt-[-30px] flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
