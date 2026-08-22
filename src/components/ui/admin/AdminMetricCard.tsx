import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import AdminSparkline from "@/components/features/master-admin/AdminSparkline";
import { adminCardClass, adminCardCompactClass } from "./tokens";

type ChangeTone = "positive" | "negative" | "neutral";

type Props = {
  title: string;
  value: string | number;
  note?: string;
  change?: string;
  changeTone?: ChangeTone;
  /** Default layout: arbitrary icon node. Compact layout: ignored when iconComponent is set. */
  icon?: ReactNode;
  /** Compact layout: Lucide icon in a colored circle. */
  iconComponent?: LucideIcon;
  iconClassName?: string;
  sparkline?: number[];
  layout?: "default" | "compact";
  className?: string;
  isChangePositive?: boolean;
};

const CHANGE_TONE_CLASS: Record<ChangeTone, string> = {
  positive: "text-emerald-600",
  negative: "text-red-500",
  neutral: "text-slate-400",
};

export default function AdminMetricCard({
  title,
  value,
  note,
  change,
  changeTone,
  icon,
  iconComponent,
  iconClassName = "bg-slate-100 text-slate-600",
  sparkline,
  layout = "default",
  className = "",
  isChangePositive = true,
}: Props) {
  const resolvedChangeTone = changeTone ?? (isChangePositive ? "positive" : "negative");
  const displayValue = typeof value === "number" ? value.toLocaleString("en-IN") : value;

  if (layout === "compact") {
    const Icon = iconComponent;
    return (
      <div className={`dash-premium-card--lift flex items-start gap-3 p-3.5 ${adminCardClass} ${className}`}>
        {Icon && (
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconClassName}`}>
            <Icon size={16} strokeWidth={2.2} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{title}</p>
          <p className="mt-1 text-[22px] font-semibold leading-none tracking-tight text-[#111111]">{displayValue}</p>
          {(note || change) && (
            <p className={`mt-1 text-[11px] font-medium ${CHANGE_TONE_CLASS[resolvedChangeTone]}`}>
              {change || note}
            </p>
          )}
          {sparkline && sparkline.length > 0 && (
            <div className="mt-2">
              <AdminSparkline values={sparkline} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`dash-premium-card--lift flex flex-col justify-between p-4 ${adminCardCompactClass} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{title}</p>
        {icon && <div className="text-[#374151]">{icon}</div>}
      </div>
      <div className="mt-2">
        <div className="text-[26px] font-semibold tracking-tight text-[#111111]">{displayValue}</div>
        {(change || note) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {change && (
              <span className={`font-semibold ${CHANGE_TONE_CLASS[resolvedChangeTone]}`}>{change}</span>
            )}
            {note && <span className="font-medium text-[#9CA3AF]">{note}</span>}
          </div>
        )}
        {sparkline && sparkline.length > 0 && (
          <div className="mt-3">
            <AdminSparkline values={sparkline} />
          </div>
        )}
      </div>
    </div>
  );
}
