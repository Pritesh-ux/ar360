import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import StorageRing from "@/components/dashboard/StorageRing";
import MetricSparkline from "@/components/dashboard/MetricSparkline";
import { getMetricAccentStyles, type MetricAccent } from "./metric-accent";

type Accent = MetricAccent;

type Props = {
  title: string;
  value: string;
  note?: string;
  icon: LucideIcon;
  trend?: ReactNode;
  accent?: Accent;
  sparkline?: number[];
  storagePercent?: number;
  compact?: boolean;
};

export default function UserMetricCard({
  title,
  value,
  note,
  icon: Icon,
  trend,
  accent = "lime",
  sparkline,
  storagePercent,
  compact = false,
}: Props) {
  const styles = getMetricAccentStyles(accent);
  const showRing = storagePercent != null;
  const sparkData = sparkline?.length ? sparkline : [0, 0, 0, 0, 0, 0, 0, 0];

  return (
    <div className="dash-premium-card dash-premium-card--lift group relative overflow-hidden rounded-[20px] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">
            {title}
          </p>
          <p
            className={`mt-1 font-semibold leading-none tracking-tight text-[#111111] ${
              compact ? "text-[22px]" : "text-[26px]"
            }`}
          >
            {value}
          </p>
          {note ? (
            <p className="mt-1 text-[11px] font-medium text-[#9CA3AF]">{note}</p>
          ) : null}
          {trend ? <div className="mt-0.5">{trend}</div> : null}
        </div>
        {showRing ? (
          <StorageRing percent={storagePercent} size={40} color="#34D399" />
        ) : (
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${styles.iconGradient}`}
          >
            <Icon size={16} strokeWidth={2.2} className={styles.icon} />
          </div>
        )}
      </div>
      {!showRing ? (
        <div className="mt-2">
          <MetricSparkline values={sparkData} color={styles.spark} height={28} />
        </div>
      ) : null}
    </div>
  );
}
