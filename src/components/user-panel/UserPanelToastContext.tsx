"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

export type UserPanelToastTone = "ok" | "err" | "info";

type ToastItem = {
  id: number;
  text: string;
  tone: UserPanelToastTone;
};

type ContextValue = {
  showToast: (text: string, tone?: UserPanelToastTone) => void;
};

const Context = createContext<ContextValue | null>(null);

export function useUserPanelToast() {
  const ctx = useContext(Context);
  if (!ctx) {
    return {
      showToast: (text: string) => {
        if (typeof window !== "undefined") window.alert(text);
      },
    };
  }
  return ctx;
}

export function UserPanelToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback((text: string, tone: UserPanelToastTone = "ok") => {
    const id = ++idRef.current;
    setToast({ id, text, tone });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const toastNode =
    toast && mounted
      ? createPortal(
          <div
            role="status"
            className="fixed right-4 top-4 z-[100060] flex max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:right-6 sm:top-5 border"
            style={
              toast.tone === "err"
                ? { backgroundColor: "#7F1D1D", color: "#FEE2E2", borderColor: "#FCA5A5" }
                : { backgroundColor: "#0F1412", color: "#ffffff", borderColor: "#B6FF38" }
            }
          >
            {toast.tone === "err" ? (
              <XCircle size={18} className="mt-0.5 shrink-0" style={{ color: "#FECACA" }} />
            ) : toast.tone === "info" ? (
              <Info size={18} className="mt-0.5 shrink-0" style={{ color: "#B6FF38" }} />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "#B6FF38" }} />
            )}
            <p className="min-w-0 flex-1 leading-snug" style={{ color: toast.tone === "err" ? "#FEE2E2" : "#ffffff" }}>
              {toast.text}
            </p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-white/10"
              style={{ color: toast.tone === "err" ? "#FECACA" : "#ffffff" }}
              aria-label="Dismiss toast"
            >
              <X size={14} />
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <Context.Provider value={value}>
      {children}
      {toastNode}
    </Context.Provider>
  );
}
