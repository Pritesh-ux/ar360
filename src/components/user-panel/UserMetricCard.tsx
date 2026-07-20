import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  value: string;
  note?: string;
  icon: LucideIcon;
  trend?: ReactNode;
};

export default function UserMetricCard({ title, value, note, icon: Icon, trend }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-surface)] p-4 shadow-[var(--ar-shadow-sm)] md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ar-text-muted)]">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-[var(--ar-text)] md:text-3xl">{value}</p>
          {note ? <p className="mt-1 text-sm font-semibold text-[var(--ar-text-muted)]">{note}</p> : null}
          {trend ? <div className="mt-2">{trend}</div> : null}
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ar-primary-soft)] text-[var(--ar-text)]">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
