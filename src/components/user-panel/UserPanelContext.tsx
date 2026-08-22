"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";

type UserPanelContextValue = {
  session: UserPanelSessionSummary | null;
  setSession: (session: UserPanelSessionSummary | null) => void;
  refreshSession: () => Promise<UserPanelSessionSummary | null>;
};

const UserPanelContext = createContext<UserPanelContextValue | null>(null);

export function UserPanelProvider({
  session,
  children,
}: {
  session: UserPanelSessionSummary | null;
  children: ReactNode;
}) {
  const [sessionState, setSessionState] = useState<UserPanelSessionSummary | null>(session);

  const refreshSession = useCallback(async () => {
    const res = await fetch("/api/customer/bootstrap", { cache: "no-store" });
    if (!res.ok) return sessionState;
    const body = await res.json().catch(() => null);
    const next = (body?.session || null) as UserPanelSessionSummary | null;
    setSessionState(next);
    return next;
  }, [sessionState]);

  const value = useMemo(
    () => ({
      session: sessionState,
      setSession: setSessionState,
      refreshSession,
    }),
    [sessionState, refreshSession],
  );

  return <UserPanelContext.Provider value={value}>{children}</UserPanelContext.Provider>;
}

export function useUserPanelSession() {
  return useContext(UserPanelContext)?.session ?? null;
}

export function useUserPanelSessionActions() {
  const context = useContext(UserPanelContext);
  return {
    setSession: context?.setSession ?? (() => undefined),
    refreshSession: context?.refreshSession ?? (async () => null),
  };
}

export function useObjectCaptureEnabled() {
  const session = useUserPanelSession();
  return session?.platformFlags?.objectCaptureEnabled ?? true;
}
