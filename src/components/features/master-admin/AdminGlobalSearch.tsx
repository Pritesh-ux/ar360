"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CreditCard,
  Loader2,
  Package,
  Search,
  Ticket,
  Users,
  X,
} from "lucide-react";
import type { GlobalSearchResponse, GlobalSearchResult, SearchResultGroup } from "@/lib/master-admin/global-search";

type Props = {
  open: boolean;
  onClose: () => void;
};

const GROUP_LABELS: Record<SearchResultGroup, string> = {
  customers: "Customers",
  products: "Products",
  invoices: "Payments & Invoices",
  tickets: "Support Tickets",
};

const GROUP_ICONS: Record<SearchResultGroup, typeof Users> = {
  customers: Users,
  products: Package,
  invoices: CreditCard,
  tickets: Ticket,
};

function ResultRow({ item, active, onSelect }: { item: GlobalSearchResult; active: boolean; onSelect: () => void }) {
  const Icon = GROUP_ICONS[item.group];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-[#CFE6A5] bg-[#F4FBE8] text-slate-900"
          : "border-transparent hover:border-slate-100 hover:bg-slate-50"
      }`}
    >
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active ? "bg-[#DFF5B5] text-[#4D8500]" : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{item.label}</p>
        <p className="truncate text-xs font-medium text-slate-500">{item.subtitle}</p>
      </div>
      {item.meta && (
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
          {item.meta}
        </span>
      )}
    </button>
  );
}

export default function AdminGlobalSearch({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalSearchResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const flatResults = useMemo(() => data?.results ?? [], [data]);

  const runSearch = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/master-admin/search?q=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const json = (await res.json()) as GlobalSearchResponse;
        setData(json);
        setActiveIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!open) {
        setQuery("");
        setData(null);
        setActiveIndex(0);
        return;
      }
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => runSearch(query), 250);
    return () => window.clearTimeout(timer);
  }, [open, query, runSearch]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (event.key === "Enter" && flatResults[activeIndex]) {
        event.preventDefault();
        router.push(flatResults[activeIndex].href);
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatResults, activeIndex, router, onClose]);

  if (!open) return null;

  function navigate(item: GlobalSearchResult) {
    router.push(item.href);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/45 p-4 pt-[10vh] backdrop-blur-[6px]">
      <button type="button" className="absolute inset-0" aria-label="Close search" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div>
            <p className="text-[15px] font-black tracking-tight text-slate-900">Search AR360</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              Find customers, products, payments and support tickets
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mx-5 flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 transition focus-within:border-[#9ED64E] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#A6FF2E]/10">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing to search..."
            className="h-auto min-w-0 flex-1 bg-transparent !border-0 !p-0 text-sm font-semibold text-slate-800 !shadow-none !outline-none !ring-0 placeholder:font-medium placeholder:text-slate-400"
          />
          {loading ? <Loader2 size={17} className="shrink-0 animate-spin text-[#69A900]" /> : null}
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              Clear
            </button>
          ) : (
            <kbd className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-400 shadow-sm">
              ESC
            </kbd>
          )}
        </div>

        <div className="mt-3 min-h-[170px] max-h-[min(58vh,430px)] overflow-y-auto px-3 pb-3">
          {query.trim().length < 2 && (
            <div className="flex min-h-[165px] flex-col items-center justify-center px-4 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F1F8E5] text-[#69A900]">
                <Search size={21} />
              </span>
              <p className="mt-3 text-sm font-bold text-slate-700">Search the entire platform</p>
              <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-slate-400">
                Enter at least 2 characters. You can search by name, email, ID, invoice or ticket.
              </p>
            </div>
          )}

          {query.trim().length >= 2 && !loading && flatResults.length === 0 && (
            <div className="flex min-h-[165px] flex-col items-center justify-center px-4 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <Search size={21} />
              </span>
              <p className="mt-3 text-sm font-bold text-slate-700">
                No results for &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                Check the spelling or try a different keyword.
              </p>
            </div>
          )}

          {(Object.keys(GROUP_LABELS) as SearchResultGroup[]).map((group) => {
            const items = data?.groups[group] ?? [];
            if (!items.length) return null;
            let offset = 0;
            for (const g of Object.keys(GROUP_LABELS) as SearchResultGroup[]) {
              if (g === group) break;
              offset += data?.groups[g]?.length ?? 0;
            }
            return (
              <div key={group} className="mb-3">
                <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {GROUP_LABELS[group]}
                </p>
                <div className="space-y-1">
                  {items.map((item, index) => (
                    <ResultRow
                      key={`${item.group}-${item.id}`}
                      item={item}
                      active={activeIndex === offset + index}
                      onSelect={() => navigate(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] font-semibold text-slate-400">
          <span className="flex items-center gap-3">
            <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5">↑↓</kbd> Navigate</span>
            <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5">Enter</kbd> Open</span>
            <span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5">Esc</kbd> Close</span>
          </span>
          <Link
            href="/master-admin/customers"
            onClick={onClose}
            className="rounded-lg px-2 py-1 font-bold text-[#4D8500] transition hover:bg-[#EAF5D8]"
          >
            Advanced filters
          </Link>
        </div>
      </div>
    </div>
  );
}
