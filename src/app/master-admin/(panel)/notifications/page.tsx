"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useMasterAdminNotifications } from "@/components/features/master-admin/MasterAdminNotificationsContext";

const CATEGORY_CLASS: Record<string, string> = {
  billing: "bg-violet-50 text-violet-700",
  support: "bg-sky-50 text-sky-700",
  customer: "bg-emerald-50 text-emerald-700",
  product: "bg-amber-50 text-amber-700",
  system: "bg-slate-100 text-slate-600",
  security: "bg-red-50 text-red-700",
};

function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, loading, error, refresh, markRead, remove } =
    useMasterAdminNotifications();

  function clearAll() {
    if (!notifications.length) return;
    if (!window.confirm("Clear all Master Admin notifications? This cannot be undone.")) return;
    void remove([], true);
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {unreadCount ? `${unreadCount} unread platform alert${unreadCount === 1 ? "" : "s"}` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void refresh()} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={15} /> Refresh
          </button>
          {unreadCount > 0 ? (
            <button type="button" onClick={() => void markRead([], true)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <CheckCheck size={15} /> Mark all read
            </button>
          ) : null}
          {notifications.length > 0 ? (
            <button type="button" onClick={clearAll} className="flex h-10 items-center gap-2 rounded-xl bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100">
              <Trash2 size={15} /> Clear all
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-20 text-sm font-semibold text-slate-400">
          <Loader2 size={18} className="animate-spin" /> Loading notifications...
        </div>
      ) : null}
      {!loading && notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <Bell size={30} className="mx-auto mb-3 text-slate-300" />
          <p className="font-bold text-slate-700">No notifications</p>
          <p className="mt-1 text-sm text-slate-400">New platform alerts will appear here.</p>
        </div>
      ) : null}
      {notifications.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`flex gap-3 border-b border-slate-100 p-4 last:border-0 ${item.isRead ? "" : "bg-[#F4FBEA]"}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  if (!item.isRead) void markRead([item.id]);
                  if (item.href) router.push(item.href);
                }}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORY_CLASS[item.category] || CATEGORY_CLASS.system}`}>{item.category}</span>
                  <span className="text-[11px] font-semibold text-slate-400">{timestamp(item.createdAt)}</span>
                  {!item.isRead ? <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Unread" /> : null}
                </div>
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                {item.body ? <p className="mt-1 text-sm text-slate-500">{item.body}</p> : null}
              </button>
              <button
                type="button"
                onClick={() => void remove([item.id])}
                aria-label={`Delete ${item.title}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
