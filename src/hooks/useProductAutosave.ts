"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export type ProductAutosavePayload = {
  customerUid: string;
  productUid: string;
  productPatch: Record<string, unknown>;
  status?: string;
  expectedVersion?: number;
};

type UseProductAutosaveOptions = {
  debounceMs?: number;
  maxRetries?: number;
  enabled?: boolean;
  onConflict?: () => void;
  onSaved?: (version: number) => void;
};

function payloadSignature(payload: ProductAutosavePayload) {
  try {
    const patch = { ...(payload.productPatch || {}) };
    delete patch.updatedAt;
    delete patch.version;
    return JSON.stringify({
      customerUid: payload.customerUid,
      productUid: payload.productUid,
      status: payload.status || "draft",
      productPatch: patch,
    });
  } catch {
    return String(Date.now());
  }
}

export function useProductAutosave(options: UseProductAutosaveOptions = {}) {
  const debounceMs = options.debounceMs ?? 8000;
  const maxRetries = options.maxRetries ?? 2;
  const enabled = options.enabled !== false;

  const [state, setState] = useState<AutoSaveState>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const pendingRef = useRef<ProductAutosavePayload | null>(null);
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const onConflictRef = useRef(options.onConflict);
  const onSavedRef = useRef(options.onSaved);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onConflictRef.current = options.onConflict;
    onSavedRef.current = options.onSaved;
    enabledRef.current = enabled;
  }, [options.onConflict, options.onSaved, enabled]);

  const flushSaveRef = useRef<any>(null);

  const flushSave = useCallback(async () => {
    const payload = pendingRef.current;
    if (!payload || inFlightRef.current || !enabledRef.current) return;

    const signature = payloadSignature(payload);
    if (signature && signature === lastSavedSignatureRef.current) {
      pendingRef.current = null;
      setHasUnsavedChanges(false);
      setState("saved");
      window.setTimeout(() => setState((current) => (current === "saved" ? "idle" : current)), 1600);
      return null;
    }

    inFlightRef.current = true;
    setState("saving");

    try {
      const destination =
        typeof window !== "undefined"
          ? `${window.location.origin}/viewer/${payload.productUid}`
          : "";

      const res = await fetch("/api/products/save-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerUid: payload.customerUid,
          productUid: payload.productUid,
          destination,
          status: payload.status || "draft",
          productPatch: payload.productPatch,
          expectedVersion: payload.expectedVersion,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setState("conflict");
        setHasUnsavedChanges(true);
        onConflictRef.current?.();
        return null;
      }
      if (!res.ok) throw new Error(data?.error || "Save failed");

      pendingRef.current = null;
      retryRef.current = 0;
      lastSavedSignatureRef.current = signature;
      setHasUnsavedChanges(false);
      setState("saved");
      onSavedRef.current?.(Number(data.version || payload.expectedVersion || 0));
      window.setTimeout(() => setState((current) => (current === "saved" ? "idle" : current)), 1800);
      return data;
    } catch {
      if (retryRef.current < maxRetries) {
        retryRef.current += 1;
        window.setTimeout(() => {
          inFlightRef.current = false;
          void flushSaveRef.current?.();
        }, 1000 * retryRef.current);
        return null;
      }
      setState("error");
      setHasUnsavedChanges(true);
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [maxRetries]);

  flushSaveRef.current = flushSave;

  const queueSave = useCallback(
    (payload: ProductAutosavePayload) => {
      if (!enabledRef.current) return;

      const signature = payloadSignature(payload);
      if (signature && signature === lastSavedSignatureRef.current) {
        return;
      }

      pendingRef.current = payload;
      setHasUnsavedChanges(true);
      // Keep UI calm while waiting — only show "Saving..." when flush starts.
      setState((current) => (current === "saving" ? current : "idle"));

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void flushSave();
      }, debounceMs);
    },
    [debounceMs, flushSave],
  );

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges && state !== "saving") return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, state]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { state, hasUnsavedChanges, queueSave, flushSave, setHasUnsavedChanges };
}
