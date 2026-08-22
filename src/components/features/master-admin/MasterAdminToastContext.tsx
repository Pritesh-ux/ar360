"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export type MasterAdminToastTone = "ok" | "err" | "info";

type ToastItem = {
  id: number;
  text: string;
  tone: MasterAdminToastTone;
};

type ContextValue = {
  showToast: (text: string, tone?: MasterAdminToastTone) => void;
};

const Context = createContext<ContextValue | null>(null);

export function useMasterAdminToast() {
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

export function MasterAdminToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((text: string, tone: MasterAdminToastTone = "ok") => {
    const id = ++idRef.current;
    setToast({ id, text, tone });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <Context.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          className={`fixed right-4 top-4 z-[100060] flex max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:right-6 sm:top-5 ${
            toast.tone === "err"
              ? "border border-[#FCA5A5] bg-[#7F1D1D] text-[#FEE2E2]"
              : toast.tone === "info"
                ? "border border-[#93C5FD] bg-[#1E3A8A] text-[#DBEAFE]"
                : "border border-[#84D400]/50 bg-[#0F1412] text-white"
          }`}
        >
          {toast.tone === "err" ? (
            <XCircle size={18} className="mt-0.5 shrink-0 text-[#FECACA]" />
          ) : (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#B6FF38]" />
          )}
          <p className="min-w-0 flex-1 leading-snug">{toast.text}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-white/10"
            aria-label="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </Context.Provider>
  );
}
