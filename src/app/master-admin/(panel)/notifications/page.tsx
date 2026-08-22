"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, RefreshCw, Trash2 } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { useMasterAdminNotifications } from "@/components/features/master-admin/MasterAdminNotificationsContext";
import "@/components/dashboard/dashboard-premium.css";

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
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Notifications"
        subtitle={
          unreadCount
            ? `${unreadCount} unread platform alert${unreadCount === 1 ? "" : "s"}`
            : "All caught up"
        }
        actions={
          <>
            <button type="button" onClick={() => void refresh()} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <RefreshCw size={15} />
              Refresh
            </button>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => void markRead([], true)} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
                <CheckCheck size={15} />
                Mark all read
              </button>
            ) : null}
            {notifications.length > 0 ? (
              <button type="button" onClick={clearAll} className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 text-[12px] font-bold text-[#991B1B] transition hover:bg-[#FEE2E2]">
                <Trash2 size={15} />
                Clear all
              </button>
            ) : null}
          </>
        }
      />

      {error ? (
        <div className="dash-premium-card flex items-center justify-between gap-3 border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#991B1B]">{error}</p>
        </div>
      ) : null}

      {loading && notifications.length === 0 ? (
        <div className="dash-premium-card flex items-center justify-center gap-2 py-20 text-[13px] font-semibold text-[#9CA3AF]">
          <Loader2 size={18} className="animate-spin" />
          Loading notifications...
        </div>
      ) : null}

      {!loading && notifications.length === 0 ? (
        <div className="dash-premium-card py-20 text-center">
          <Bell size={30} className="mx-auto mb-3 text-[#D1D5DB]" />
          <p className="font-bold text-[#374151]">No notifications</p>
          <p className="mt-1 text-[13px] text-[#9CA3AF]">New platform alerts will appear here.</p>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <div className="dash-premium-card overflow-hidden">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`flex gap-3 border-b border-[#F3F4F6] p-4 last:border-0 ${item.isRead ? "" : "bg-[#F4FBEA]"}`}
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
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORY_CLASS[item.category] || CATEGORY_CLASS.system}`}>
                    {item.category}
                  </span>
                  <span className="text-[11px] font-semibold text-[#9CA3AF]">{timestamp(item.createdAt)}</span>
                  {!item.isRead ? <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Unread" /> : null}
                </div>
                <p className="text-[13px] font-bold text-[#111827]">{item.title}</p>
                {item.body ? <p className="mt-1 text-[13px] text-[#6B7280]">{item.body}</p> : null}
              </button>
              <button
                type="button"
                onClick={() => void remove([item.id])}
                aria-label={`Delete ${item.title}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[#9CA3AF] transition hover:bg-red-50 hover:text-red-600"
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
