import type { ReactNode } from "react";

type Row = { label: string; value: number };

export default function AdminMiniBarChart({ rows }: { rows: Row[] }) {
  const safeRows = rows.length ? rows : [{ label: "—", value: 0 }];
  const max = Math.max(...safeRows.map((r) => r.value), 1);

  return (
    <div className="mt-4 flex h-36 items-end gap-1">
      {safeRows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-[#7AE02E] to-[#A6FF2E]"
            style={{ height: `${Math.max(8, (row.value / max) * 100)}%` }}
            title={`${row.label}: ${row.value}`}
          />
          <span className="max-w-full truncate text-[9px] font-semibold text-slate-400">
            {row.label.split(" ")[0]}
          </span>
        </div>
      ))}
    </div>
  );
}

type PlanRow = { plan: string; value: number };

export function AdminPlanBreakdownChart({ rows }: { rows: PlanRow[] }) {
  if (!rows.length) {
    return <p className="mt-4 text-sm font-medium text-slate-400">No subscription data yet.</p>;
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="mt-4 space-y-3">
      {rows.slice(0, 6).map((row) => (
        <div key={row.plan}>
          <div className="mb-1 flex items-center justify-between text-sm font-bold">
            <span className="capitalize text-slate-700">{row.plan}</span>
            <span className="text-slate-500">{row.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#A6FF2E]"
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminHealthBadge({ status }: { status: "healthy" | "warning" | "error" }) {
  const className =
    status === "healthy"
      ? "bg-emerald-100 text-emerald-700"
      : status === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${className}`}>
      {status}
    </span>
  );
}

export function AdminSnapshotRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="font-black text-slate-900">{value}</span>
    </div>
  );
}
