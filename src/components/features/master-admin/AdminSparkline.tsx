"use client";

import { useId } from "react";

type Props = {
  values?: number[];
  color?: string;
  className?: string;
  /** Show soft fill under the line. Default true. */
  fill?: boolean;
  heightClassName?: string;
};

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Compact metric sparkline — even stroke, padded peaks, optional area fill. */
export default function AdminSparkline({
  values = [],
  color = "#84D400",
  className = "",
  fill = true,
  heightClassName = "h-8",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const series = values.length > 0 ? values.map((v) => (Number.isFinite(v) ? Number(v) : 0)) : [0, 0];
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;

  const points = series.map((value, index) => ({
    x: padX + index * step,
    y: padY + innerH - ((value - min) / range) * innerH,
  }));

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`
      : "";

  const gradientId = `spark-fill-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`${heightClassName} w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && areaPath ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type ChartRow = { label: string; value: number };

/** Larger area chart for analytics panels (Viewer / Live). */
export function AdminAreaChart({
  rows,
  color = "#84D400",
  className = "mt-3 h-36 w-full",
}: {
  rows: ChartRow[];
  color?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  if (!rows.length) {
    return <p className="mt-6 text-center text-[12px] font-medium text-[#9CA3AF]">No trend data yet.</p>;
  }

  const values = rows.map((r) => r.value);
  const max = Math.max(...values, 1);
  const width = 320;
  const height = 140;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const step = rows.length > 1 ? innerW / (rows.length - 1) : 0;

  const points = rows.map((row, index) => ({
    x: padL + index * step,
    y: padT + innerH - (row.value / max) * innerH,
    label: row.label,
    value: row.value,
  }));

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`;
  const gradientId = `area-fill-${uid}`;
  const labelEvery = Math.max(1, Math.ceil(rows.length / 7));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <line
            key={t}
            x1={padL}
            x2={width - padR}
            y1={y}
            y2={y}
            stroke="#EEF0F3"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text
            key={`${p.label}-${i}`}
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-[#9CA3AF]"
            style={{ fontSize: 9, fontWeight: 600 }}
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Column bar chart for hourly / category panels. */
export function AdminBarChart({
  rows,
  color = "#84D400",
  className = "mt-3 h-36 w-full",
}: {
  rows: ChartRow[];
  color?: string;
  className?: string;
}) {
  if (!rows.length) {
    return <p className="mt-6 text-center text-[12px] font-medium text-[#9CA3AF]">No data yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={`flex items-end gap-1.5 ${className}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold tabular-nums text-[#6B7280]">
            {row.value > 0 ? row.value : ""}
          </span>
          <div className="flex h-full min-h-[72px] w-full items-end">
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(6, (row.value / max) * 100)}%`,
                background: `linear-gradient(180deg, ${color} 0%, #B6FF38 100%)`,
              }}
              title={`${row.label}: ${row.value}`}
            />
          </div>
          <span className="max-w-full truncate text-[9px] font-semibold text-[#9CA3AF]">{row.label}</span>
        </div>
      ))}
    </div>
  );
}
