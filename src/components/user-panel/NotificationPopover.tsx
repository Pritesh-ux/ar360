"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Loader2, Trash2, X } from "lucide-react";
import type { CustomerNotification } from "@/lib/user-panel/notifications.service";

type Props = {
  initialUnread?: number;
  buttonClassName?: string;
  badgeClassName?: string;
  iconSize?: number;
};

export default function NotificationPopover({
  initialUnread = 0,
  buttonClassName,
  badgeClassName,
  iconSize = 18,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ bottom: 0, left: 0 });
  const hasPolled = useRef(false);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 32, 360);
    setCoords({
      bottom: Math.max(16, window.innerHeight - rect.top + 8),
      left: Math.min(Math.max(16, rect.right - width), window.innerWidth - width - 16),
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/notifications");
      if (res.ok) {
        const data = (await res.json()) as {
          notifications: CustomerNotification[];
          unreadCount: number;
        };
        setItems(data.notifications);
        setUnreadCount(data.unreadCount);
        setError(null);
      } else {
        setError("Unable to load notifications.");
      }
    } catch {
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasPolled.current) return;
    hasPolled.current = true;
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const initial = window.setTimeout(() => {
      void load();
      updatePosition();
    }, 0);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, load, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function markAllRead() {
    if (marking) return;
    setMarking(true);
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      const res = await fetch("/api/customer/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as { notifications: CustomerNotification[]; unreadCount: number };
        setItems(data.notifications);
        setUnreadCount(data.unreadCount);
        setError(null);
      } else {
        setError("Unable to mark notifications read.");
      }
    } catch {
      setError("Unable to mark notifications read.");
      void load();
    } finally {
      setMarking(false);
    }
  }

  async function clearAll() {
    if (clearing || items.length === 0) return;
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/customer/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      if (res.ok) {
        setItems([]);
        setUnreadCount(0);
        setError(null);
      } else {
        setError("Unable to clear notifications.");
      }
    } catch {
      setError("Unable to clear notifications.");
    } finally {
      setClearing(false);
    }
  }

  async function markOneRead(id: string) {
    const unread = items.some((item) => item.id === id && !item.isRead);
    setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
    if (unread) setUnreadCount((current) => Math.max(0, current - 1));
    try {
      const res = await fetch("/api/customer/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
        keepalive: true,
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { notifications: CustomerNotification[]; unreadCount: number };
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch {
      setError("Unable to mark notification read.");
    }
  }

  async function deleteOne(id: string) {
    const removed = items.find((item) => item.id === id);
    setItems((current) => current.filter((item) => item.id !== id));
    if (removed && !removed.isRead) setUnreadCount((current) => Math.max(0, current - 1));
    try {
      const res = await fetch("/api/customer/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { notifications: CustomerNotification[]; unreadCount: number };
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch {
      setError("Unable to delete notification.");
      void load();
    }
  }

  const panel =
    open && typeof document !== "undefined" ? (
      <div
        ref={panelRef}
        className="up-notification-panel fixed z-[200] w-[min(100vw-2rem,360px)] overflow-hidden rounded-[16px] border border-[var(--ar-border)] bg-white shadow-xl"
        style={{ bottom: coords.bottom, left: coords.left }}
      >
        <div className="flex items-center justify-between border-b border-[var(--ar-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell size={16} />
            <p className="text-sm font-black">Notifications</p>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={marking}
                onClick={() => void markAllRead()}
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-[var(--ar-text-muted)] hover:bg-[var(--ar-surface-soft)] disabled:opacity-50"
              >
                <CheckCheck size={14} />
                Mark all
              </button>
            )}
            {items.length > 0 && (
              <button
                type="button"
                disabled={clearing}
                onClick={() => void clearAll()}
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-[var(--ar-text-muted)] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title="Clear all notifications"
              >
                <Trash2 size={13} />
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ar-text-muted)] hover:bg-[var(--ar-surface-soft)]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="max-h-[min(50vh,360px)] overflow-y-auto">
          {error ? (
            <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</p>
          ) : null}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--ar-text-muted)]">
              <Loader2 size={16} className="animate-spin" />
              Loading...
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="px-4 py-10 text-center text-sm font-medium text-[var(--ar-text-muted)]">
              You&apos;re all caught up.
            </p>
          )}
          {!loading &&
            items.map((item) => {
              return (
                <div
                  key={item.id}
                  role={item.href ? "link" : "button"}
                  tabIndex={0}
                  onClick={() => {
                    if (!item.isRead) void markOneRead(item.id);
                    if (item.href) {
                      setOpen(false);
                      router.push(item.href);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.click();
                    }
                  }}
                  className={`relative border-b border-[var(--ar-border)]/60 px-4 py-3 pr-12 hover:bg-[var(--ar-surface-soft)] ${
                    !item.isRead ? "bg-[var(--ar-primary-soft)]/40" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md bg-[var(--ar-surface-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--ar-text-muted)]">{item.category}</span>
                    <span className="text-[10px] font-semibold text-[var(--ar-text-muted)]">
                      {new Date(item.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[var(--ar-text)]">{item.title}</p>
                  {item.body ? (
                    <p className="mt-0.5 text-xs font-medium text-[var(--ar-text-muted)]">{item.body}</p>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteOne(item.id);
                    }}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--ar-text-muted)] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          buttonClassName ||
          "relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ar-border)] bg-white text-[var(--ar-text-muted)] transition hover:bg-[var(--ar-surface-soft)]"
        }
        aria-label="Notifications"
      >
        <Bell size={iconSize} />
        {unreadCount > 0 && (
          <span
            className={
              badgeClassName ||
              "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ar-primary)] px-1 text-[10px] font-black text-[var(--ar-text)]"
            }
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
