"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, Sparkles, X } from "lucide-react";

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  href: string;
};

type ChecklistData = {
  dismissed: boolean;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
};

export default function OnboardingChecklist({
  variant = "full",
  onVisibilityChange,
}: {
  variant?: "full" | "sidebar" | "banner";
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/checklist", { cache: "no-store" });
        const json = await res.json();
        if (active && res.ok) setChecklist(json.checklist);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const visible =
    !loading && !!checklist && !checklist.dismissed && checklist.completedCount < checklist.totalCount;

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  if (loading || !checklist || checklist.dismissed) return null;
  if (checklist.completedCount >= checklist.totalCount) return null;

  const progress = Math.round((checklist.completedCount / checklist.totalCount) * 100);
  const nextItem = checklist.items.find((item) => !item.completed);

  const dismiss = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismiss: true }),
      });
      const json = await res.json();
      if (res.ok) setChecklist(json.checklist);
    } finally {
      setBusy(false);
    }
  };

  if (variant === "banner") {
    return (
      <section className="dash-checklist-banner relative overflow-hidden rounded-[20px] border border-[#C8F06A] bg-gradient-to-r from-[#F4FFE0] via-[#FAFFF5] to-white p-3.5 shadow-[0_4px_24px_rgba(182,255,56,0.12)] md:p-4">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#B6FF38] to-[#84D400]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#B6FF38]/10 blur-2xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-[#B6FF38] to-[#84D400] shadow-[0_4px_14px_rgba(132,212,0,0.28)]">
                <Sparkles size={18} className="text-[#102000]" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4D7A00]">
                    Getting started
                  </p>
                  <span className="inline-flex items-center rounded-full bg-[#B6FF38]/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3D6B00]">
                    New
                  </span>
                </div>
                <p className="mt-0.5 text-[14px] font-bold text-[#111827]">
                  Complete your setup — {checklist.completedCount} of {checklist.totalCount} done
                </p>
                {nextItem ? (
                  <p className="mt-0.5 text-[12px] font-medium text-[#6B7280]">
                    Up next:{" "}
                    <Link href={nextItem.href} className="font-semibold text-[#4D7A00] hover:underline">
                      {nextItem.label}
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden min-w-[120px] sm:block">
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-[#6B7280]">
                  <span>Progress</span>
                  <span className="text-[#4D7A00]">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-[#DCEFC0]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#B6FF38] to-[#84D400] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void dismiss()}
                disabled={busy}
                className="shrink-0 rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-white/70 hover:text-[#6B7280]"
                aria-label="Dismiss checklist"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              </button>
            </div>
          </div>

          <ul className="flex flex-wrap items-center gap-2">
            {checklist.items.map((item) => {
              const isNext = nextItem?.id === item.id;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                      item.completed
                        ? "border-[#BBF7D0] bg-white/70 text-[#6B7280] line-through"
                        : isNext
                          ? "dash-checklist-next border-[#84D400] bg-white text-[#102000] shadow-[0_2px_12px_rgba(182,255,56,0.25)] ring-2 ring-[#B6FF38]/40"
                          : "border-[#ECECEC] bg-white/80 text-[#374151] hover:border-[#B6FF38]/60 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    {item.completed ? (
                      <CheckCircle2 size={14} className="shrink-0 text-[#22C55E]" />
                    ) : (
                      <Circle size={14} className={`shrink-0 ${isNext ? "text-[#84D400]" : "text-[#D1D5DB]"}`} />
                    )}
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="dash-premium-card flex flex-col overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
            Your setup checklist
          </p>
          <h3 className="mt-1 text-sm font-bold text-[#111827]">
            {checklist.completedCount} of {checklist.totalCount} complete
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={busy}
          className="rounded-[12px] p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F9FAFB] hover:text-[#6B7280]"
          aria-label="Dismiss checklist"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
        </button>
      </div>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#F3F4F6]">
        <div
          className="dash-progress-bar h-full rounded-full bg-gradient-to-r from-[#B6FF38] to-[#84D400] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-2.5 space-y-0">
        {checklist.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`flex items-center gap-2 rounded-[12px] px-1.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#FAFAFB] ${
                item.completed ? "text-[#9CA3AF]" : "text-[#374151]"
              }`}
            >
              {item.completed ? (
                <CheckCircle2 size={17} className="shrink-0 text-[#22C55E]" strokeWidth={2.2} />
              ) : (
                <Circle size={17} className="shrink-0 text-[#D1D5DB]" strokeWidth={2} />
              )}
              <span className={item.completed ? "line-through" : ""}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
