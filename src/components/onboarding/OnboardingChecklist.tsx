"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, X } from "lucide-react";

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

export default function OnboardingChecklist() {
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

  if (loading || !checklist || checklist.dismissed) return null;
  if (checklist.completedCount >= checklist.totalCount) return null;

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

  return (
    <section className="rounded-2xl border border-[#018abe]/20 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#018abe]">Getting started</p>
          <h3 className="mt-1 text-lg font-black text-slate-900">Your setup checklist</h3>
          <p className="mt-1 text-sm text-slate-600">
            {checklist.completedCount} of {checklist.totalCount} complete
          </p>
        </div>
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={busy}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          aria-label="Dismiss checklist"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {checklist.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {item.completed ? (
                <CheckCircle2 size={18} className="text-[#018abe]" />
              ) : (
                <Circle size={18} className="text-slate-300" />
              )}
              <span className={item.completed ? "text-slate-500 line-through" : ""}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
