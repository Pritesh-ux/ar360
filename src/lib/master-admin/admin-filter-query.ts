"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Debounce a string value (search boxes). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

type FilterMap = Record<string, string | null | undefined>;

/**
 * Sync a small set of filter keys with the URL query string (History API).
 * Avoids Next.js useSearchParams Suspense requirement.
 */
export function useAdminFilterQuery(
  keys: string[],
  values: FilterMap,
  onHydrate: (fromUrl: Record<string, string>) => void,
) {
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || typeof window === "undefined") return;
    hydrated.current = true;
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, string> = {};
    let any = false;
    for (const key of keys) {
      const raw = params.get(key);
      if (raw != null && raw !== "") {
        fromUrl[key] = raw;
        any = true;
      }
    }
    if (any) onHydrate(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const writeUrl = useCallback(
    (next: FilterMap) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      for (const key of keys) {
        const v = next[key];
        if (v == null || v === "" || v === "all") params.delete(key);
        else params.set(key, String(v));
      }
      const qs = params.toString();
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    },
    [keys],
  );

  const serialized = useMemo(() => {
    const slim: Record<string, string> = {};
    for (const key of keys) {
      const v = values[key];
      if (v != null && v !== "" && v !== "all") slim[key] = String(v);
    }
    return JSON.stringify(slim);
  }, [keys, values]);

  useEffect(() => {
    if (!hydrated.current) return;
    const next = JSON.parse(serialized) as FilterMap;
    writeUrl(next);
  }, [serialized, writeUrl]);
}

export type AdminFilterChip = {
  id: string;
  label: string;
};

export function buildFilterChips(
  entries: Array<{ id: string; active: boolean; label: string }>,
): AdminFilterChip[] {
  return entries.filter((e) => e.active).map((e) => ({ id: e.id, label: e.label }));
}
