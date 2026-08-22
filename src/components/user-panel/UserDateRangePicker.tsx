"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { createPortal } from "react-dom";
import { Calendar, Check, ChevronDown } from "lucide-react";

export type DateRangePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "month" | "all" | "custom";

export type DateRangeValue = {
  preset: DateRangePreset;
  from: string | null;
  to: string | null;
};

type Props = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  className?: string;
  /** Shorter trigger label for tight mobile toolbars. */
  compact?: boolean;
};

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range" },
];

function toInputDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatLabelDate(iso: string, compact = false) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  if (compact) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function defaultDateRange(preset: DateRangePreset = "30d"): DateRangeValue {
  const bounds = resolveDateBounds({ preset, from: null, to: null });
  return {
    preset,
    from: bounds.from ? toInputDate(bounds.from) : null,
    to: bounds.to ? toInputDate(bounds.to) : null,
  };
}

export function resolveDateBounds(value: DateRangeValue): { from: Date | null; to: Date | null } {
  const today = endOfDay(new Date());

  if (value.preset === "all") return { from: null, to: null };

  if (value.preset === "custom") {
    return {
      from: value.from ? startOfDay(new Date(`${value.from}T00:00:00`)) : null,
      to: value.to ? endOfDay(new Date(`${value.to}T00:00:00`)) : null,
    };
  }

  if (value.preset === "today") {
    return { from: startOfDay(new Date()), to: today };
  }

  if (value.preset === "yesterday") {
    const y = startOfDay(new Date());
    y.setDate(y.getDate() - 1);
    return { from: y, to: endOfDay(new Date(y)) };
  }

  if (value.preset === "month") {
    const start = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
    return { from: start, to: today };
  }

  const days = value.preset === "7d" ? 6 : value.preset === "90d" ? 89 : 29;
  const start = startOfDay(new Date(today));
  start.setDate(start.getDate() - days);
  return { from: start, to: today };
}

export function formatDateRangeLabel(value: DateRangeValue, compact = false) {
  if (value.preset === "all") return "All time";
  if (compact && value.preset !== "custom") {
    const short: Record<"today" | "yesterday" | "7d" | "30d" | "90d" | "month", string> = {
      today: "Today",
      yesterday: "Yesterday",
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
      month: "This month",
    };
    return short[value.preset as keyof typeof short] || "Select dates";
  }
  const bounds = resolveDateBounds(value);
  if (!bounds.from || !bounds.to) return "Select dates";
  return `${formatLabelDate(toInputDate(bounds.from), compact)} – ${formatLabelDate(toInputDate(bounds.to), compact)}`;
}

export function isDateInRange(iso: string | null | undefined, value: DateRangeValue) {
  if (!iso) return value.preset === "all";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  const { from, to } = resolveDateBounds(value);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export default function UserDateRangePicker({ value, onChange, className = "", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [draftFrom, setDraftFrom] = useState(value.from || "");
  const [draftTo, setDraftTo] = useState(value.to || "");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDeferredEffect(() => {
    setDraftFrom(value.from || "");
    setDraftTo(value.to || "");
  }, [value.from, value.to]);

  const label = useMemo(() => formatDateRangeLabel(value, compact), [value, compact]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 280;
    const height = menuRef.current?.offsetHeight || 360;
    const gap = 8;
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - 12;
    const top = fitsBelow ? rect.bottom + gap : Math.max(12, rect.top - height - gap);
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onViewport = () => updatePosition();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open, updatePosition]);

  function applyPreset(preset: DateRangePreset) {
    if (preset === "custom") {
      const next = defaultDateRange("30d");
      setDraftFrom(next.from || "");
      setDraftTo(next.to || "");
      onChange({ preset: "custom", from: next.from, to: next.to });
      return;
    }
    onChange(defaultDateRange(preset));
    setOpen(false);
  }

  function applyCustom() {
    if (!draftFrom || !draftTo) return;
    if (draftFrom > draftTo) return;
    onChange({ preset: "custom", from: draftFrom, to: draftTo });
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          updatePosition();
          setOpen(true);
        }}
        className={`mb-0 inline-flex h-9 w-full max-w-full shrink-0 items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-3 text-[12px] font-medium text-[#374151] transition-all duration-[250ms] hover:bg-[#FAFAFB] hover:shadow-sm sm:h-10 sm:w-auto sm:gap-2 sm:px-4 sm:text-[13px] ${className}`.trim()}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={14} className="shrink-0 text-[#737373] sm:size-[15px]" />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown size={14} className="ml-auto shrink-0 text-[#A3A3A3] sm:ml-0 sm:size-[15px]" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              aria-label="Date range"
              className="fixed z-[9999] w-[280px] overflow-hidden rounded-[16px] border border-[#E8EAED] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
              style={{ top: coords.top, left: coords.left }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-[#ECECEC] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  Date range
                </p>
              </div>

              <div className="p-1.5">
                {PRESETS.map((preset) => {
                  const active = value.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-[13px] font-semibold transition ${
                        active
                          ? "bg-[#F7FCE8] text-[#3D6600]"
                          : "text-[#525252] hover:bg-[#F5F5F5] hover:text-[#111111]"
                      }`}
                    >
                      {preset.label}
                      {active ? <Check size={15} className="text-[#84D400]" /> : null}
                    </button>
                  );
                })}
              </div>

              {value.preset === "custom" ? (
                <div className="space-y-3 border-t border-[#ECECEC] px-4 py-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                    From
                    <input
                      type="date"
                      value={draftFrom}
                      max={draftTo || undefined}
                      onChange={(event) => setDraftFrom(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111111] outline-none focus:border-[#84D400]"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                    To
                    <input
                      type="date"
                      value={draftTo}
                      min={draftFrom || undefined}
                      onChange={(event) => setDraftTo(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111111] outline-none focus:border-[#84D400]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyCustom}
                    disabled={!draftFrom || !draftTo || draftFrom > draftTo}
                    className="flex h-10 w-full items-center justify-center rounded-xl bg-[#84D400] text-[13px] font-semibold text-[#102000] transition hover:bg-[#78C400] disabled:opacity-50"
                  >
                    Apply range
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
