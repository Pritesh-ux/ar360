"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AdminNotification } from "@/lib/master-admin/notifications";

type Feed = { notifications: AdminNotification[]; unreadCount: number };

type ContextValue = Feed & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (ids: string[], markAll?: boolean) => Promise<boolean>;
  remove: (ids: string[], clearAll?: boolean) => Promise<boolean>;
};

const Context = createContext<ContextValue | null>(null);

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || "Notification request failed. Please try again.";
}

export function MasterAdminNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyFeed = useCallback((feed: Feed) => {
    setNotifications(feed.notifications);
    setUnreadCount(feed.unreadCount);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/master-admin/notifications", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseError(response));
      applyFeed((await response.json()) as Feed);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [applyFeed]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (ids: string[], markAll = false) => {
      const idSet = new Set(ids);
      setNotifications((current) =>
        current.map((item) =>
          markAll || idSet.has(item.id) ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((current) =>
        markAll
          ? 0
          : Math.max(
              0,
              current -
                notifications.filter((item) => idSet.has(item.id) && !item.isRead).length,
            ),
      );
      try {
        const response = await fetch("/api/master-admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(markAll ? { markAll: true } : { ids }),
          credentials: "include",
          keepalive: true,
        });
        if (!response.ok) throw new Error(await responseError(response));
        applyFeed((await response.json()) as Feed);
        setError(null);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to mark notification read.");
        return false;
      }
    },
    [applyFeed, notifications],
  );

  const remove = useCallback(
    async (ids: string[], clearAll = false) => {
      const idSet = new Set(ids);
      const removedUnread = notifications.filter(
        (item) => (clearAll || idSet.has(item.id)) && !item.isRead,
      ).length;
      setNotifications((current) =>
        clearAll ? [] : current.filter((item) => !idSet.has(item.id)),
      );
      setUnreadCount((current) => (clearAll ? 0 : Math.max(0, current - removedUnread)));
      try {
        const response = await fetch("/api/master-admin/notifications", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clearAll ? { clearAll: true } : { ids }),
          credentials: "include",
        });
        if (!response.ok) throw new Error(await responseError(response));
        applyFeed((await response.json()) as Feed);
        setError(null);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to delete notification.");
        void refresh();
        return false;
      }
    },
    [applyFeed, notifications, refresh],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refresh,
      markRead,
      remove,
    }),
    [notifications, unreadCount, loading, error, refresh, markRead, remove],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMasterAdminNotifications() {
  const value = useContext(Context);
  if (!value) {
    throw new Error("useMasterAdminNotifications must be used inside its provider.");
  }
  return value;
}
