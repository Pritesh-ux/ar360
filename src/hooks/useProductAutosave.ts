"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeOrigin } from "@/lib/url";

export type AutoSaveState = "idle" | "pending" | "saving" | "saved" | "error" | "conflict";

export type ProductAutosavePayload = {
  customerUid: string;
  productUid: string;
  productPatch: Record<string, unknown>;
  status?: string;
  expectedVersion?: number;
  posterDataUrl?: string;
};

type UseProductAutosaveOptions = {
  debounceMs?: number;
  maxRetries?: number;
  enabled?: boolean;
  onConflict?: () => void;
  onSaved?: (version: number) => void;
  /** Always read the freshest optimistic-lock version right before POST. */
  getExpectedVersion?: () => number | undefined;
  /**
   * Serialises the autosave POST against the editor's other writers (poster
   * capture, publish). Without this the two paths race and 409 each other.
   */
  runExclusive?: <T>(task: () => Promise<T>) => Promise<T>;
};

function payloadSignature(payload: ProductAutosavePayload) {
  try {
    const patch = { ...(payload.productPatch || {}) };
    delete patch.updatedAt;
    delete patch.version;
    // Include whether a poster is attached — otherwise a camera-change poster
    // with an unchanged patch is treated as a no-op and never saved.
    const posterFingerprint = payload.posterDataUrl
      ? `poster:${payload.posterDataUrl.length}:${payload.posterDataUrl.slice(0, 48)}:${payload.posterDataUrl.slice(-24)}`
      : "";
    return JSON.stringify({
      customerUid: payload.customerUid,
      productUid: payload.productUid,
      status: payload.status || "published",
      productPatch: patch,
      posterFingerprint,
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
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const lastSavedSignatureRef = useRef("");
  const onConflictRef = useRef(options.onConflict);
  const onSavedRef = useRef(options.onSaved);
  const getExpectedVersionRef = useRef(options.getExpectedVersion);
  const runExclusiveRef = useRef(options.runExclusive);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onConflictRef.current = options.onConflict;
    onSavedRef.current = options.onSaved;
    getExpectedVersionRef.current = options.getExpectedVersion;
    runExclusiveRef.current = options.runExclusive;
  }, [options.onConflict, options.onSaved, options.getExpectedVersion, options.runExclusive]);

  const flushSaveRef = useRef<((force?: boolean) => Promise<any>) | null>(null);

  const postSave = useCallback(
    async (payload: ProductAutosavePayload, signature: string) => {
      setState("saving");

      const destination =
        typeof window !== "undefined"
          ? `${sanitizeOrigin(window.location.origin)}/viewer/${payload.productUid}`
          : "";

      const expectedVersion = getExpectedVersionRef.current?.() ?? payload.expectedVersion;

      const res = await fetch("/api/products/save-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerUid: payload.customerUid,
          productUid: payload.productUid,
          destination,
          status: payload.status || "published",
          posterDataUrl: payload.posterDataUrl || undefined,
          productPatch: {
            ...(payload.productPatch || {}),
            ...(typeof expectedVersion === "number" ? { version: expectedVersion } : {}),
          },
          expectedVersion,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Never retry the same stale patch at a newer server version — that
        // stomps external restores / other writers and was wiping jewelry materials.
        const serverVersion = Number(data?.currentVersion);
        if (Number.isFinite(serverVersion) && serverVersion > 0) {
          onSavedRef.current?.(serverVersion);
        }
        pendingRef.current = null;
        retryRef.current = 0;
        setState("conflict");
        setHasUnsavedChanges(false);
        onConflictRef.current?.();
        return null;
      }

      if (!res.ok) throw new Error(data?.error || "Save failed");

      pendingRef.current = null;
      retryRef.current = 0;
      lastSavedSignatureRef.current = signature;
      setHasUnsavedChanges(false);
      setState("saved");

      const savedVersion = Number(data.version || expectedVersion || 0);
      if (Number.isFinite(savedVersion) && savedVersion > 0) {
        onSavedRef.current?.(savedVersion);
      }
      window.setTimeout(() => setState((current) => (current === "saved" ? "idle" : current)), 1800);
      return data;
    },
    [maxRetries],
  );

  /**
   * `force` bypasses the enabled gate so poster capture and publish can drain
   * queued edits before they take over the write path.
   */
  const flushSave = useCallback(
    async (force = false) => {
      // Never overlap with our own in-flight request — wait it out instead of
      // bailing, otherwise callers think the queue is drained when it isn't.
      while (inFlightRef.current) {
        await inFlightRef.current.catch(() => undefined);
      }

      const payload = pendingRef.current;
      if (!payload) return null;
      if (!force && !enabledRef.current) return null;

      const signature = payloadSignature(payload);
      if (signature && signature === lastSavedSignatureRef.current) {
        pendingRef.current = null;
        setHasUnsavedChanges(false);
        setState("saved");
        window.setTimeout(() => setState((current) => (current === "saved" ? "idle" : current)), 1600);
        return null;
      }

      const runExclusive = runExclusiveRef.current;
      const task = () => postSave(payload, signature);
      const run = runExclusive ? runExclusive(task) : task();
      inFlightRef.current = run;

      try {
        return await run;
      } catch {
        if (retryRef.current < maxRetries) {
          retryRef.current += 1;
          window.setTimeout(() => {
            void flushSaveRef.current?.(force);
          }, 1000 * retryRef.current);
          return null;
        }
        setState("error");
        setHasUnsavedChanges(true);
        return null;
      } finally {
        if (inFlightRef.current === run) inFlightRef.current = null;
      }
    },
    [maxRetries, postSave],
  );

  useEffect(() => {
    flushSaveRef.current = flushSave;
  }, [flushSave]);

  const queueSave = useCallback(
    (payload: ProductAutosavePayload) => {
      const signature = payloadSignature(payload);
      if (signature && signature === lastSavedSignatureRef.current) return;

      // A fresh edit deserves a fresh retry budget; a stale counter would
      // otherwise leave the editor permanently stuck in "conflict".
      retryRef.current = 0;
      pendingRef.current = payload;
      setHasUnsavedChanges(true);
      setState((current) => (current === "saving" ? current : "pending"));

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void flushSave();
      }, debounceMs);
    },
    [debounceMs, flushSave],
  );

  // Edits made while saving was paused (poster capture / publish) must still
  // land once the editor hands the write path back.
  useEffect(() => {
    const wasEnabled = enabledRef.current;
    enabledRef.current = enabled;
    if (enabled && !wasEnabled && pendingRef.current) {
      const timer = window.setTimeout(() => void flushSaveRef.current?.(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [enabled]);

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
