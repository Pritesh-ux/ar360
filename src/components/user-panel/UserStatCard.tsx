import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { getMetricAccentStyles, type MetricAccent } from "./metric-accent";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: MetricAccent;
  sub?: string;
  trend?: ReactNode;
  extra?: ReactNode;
  /** Billing cards use a slightly smaller value line. */
  compactValue?: boolean;
  /** Tighter padding/icons for mobile 2x2 grids. */
  dense?: boolean;
};

/** Stat summary card — gradient icon box matching dashboard UserMetricCard. */
export default function UserStatCard({
  label,
  value,
  icon: Icon,
  accent = "lime",
  sub,
  trend,
  extra,
  compactValue = false,
  dense = false,
}: Props) {
  const styles = getMetricAccentStyles(accent);

  return (
    <div className={`dash-premium-card ${dense ? "p-3" : "p-4"}`}>
      <div className={`flex items-start ${dense ? "gap-2.5" : "gap-3"}`}>
        <div
          className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br ${styles.iconGradient} ${
            dense ? "h-9 w-9" : "h-11 w-11"
          }`}
        >
          <Icon size={dense ? 16 : 20} strokeWidth={2.2} className={styles.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold uppercase tracking-wide text-[#737373] ${dense ? "text-[10px] leading-tight" : "text-[11px]"}`}>
            {label}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p
              className={`font-semibold leading-none tracking-tight text-[#111111] ${
                compactValue || dense ? "text-[18px]" : "text-[26px]"
              }`}
            >
              {value}
            </p>
            {extra}
          </div>
          {sub ? (
            <p className={`mt-1 font-medium text-[#737373] ${dense ? "text-[11px]" : "mt-1.5 text-xs"}`}>{sub}</p>
          ) : null}
          {trend ? <div className="mt-1.5">{trend}</div> : null}
        </div>
      </div>
    </div>
  );
}
