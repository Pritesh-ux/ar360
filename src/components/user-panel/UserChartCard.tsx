"use client";

import { useId, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";

type Point = { date: string; value: number };

type Props = {
  title: string;
  subtitle?: string;
  points: Point[];
  tabs?: Array<{ id: string; label: string; values: Point[] }>;
  emptyLabel?: string;
  emptyDescription?: string;
  dateRangeLabel?: string;
  valueSuffix?: string;
};

function formatAxisLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replace(/^\d{4}-/, "");
  return parsed.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatTooltipValue(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function niceMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  const norm = value / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

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

export default function UserChartCard({
  title,
  subtitle,
  points,
  tabs,
  emptyLabel = "No analytics available yet.",
  emptyDescription = "Publish your first product to begin tracking data.",
  dateRangeLabel,
  valueSuffix,
}: Props) {
  const gradientId = `chart-fill-${useId().replace(/:/g, "")}`;
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id || "default");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = useMemo(() => {
    if (tabs?.length) {
      return tabs.find((tab) => tab.id === activeTab)?.values || points;
    }
    return points;
  }, [activeTab, points, tabs]);

  const maxValue = Math.max(...series.map((p) => p.value), 0);
  const yMax = niceMax(maxValue);
  const yTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t)))];
  const hasData = series.some((p) => p.value > 0);

  const w = 320;
  const h = 140;
  const padL = 4;
  const padR = 4;
  const padT = 10;
  const padB = 8;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const coords = series.map((point, index) => {
    const x = series.length <= 1 ? padL + innerW / 2 : padL + (index / (series.length - 1)) * innerW;
    const y = padT + innerH - (point.value / yMax) * innerH;
    return { ...point, x, y, index };
  });

  const linePath = coords.length >= 2 ? buildSmoothPath(coords) : "";
  const areaPath =
    coords.length >= 2
      ? `${linePath} L ${coords[coords.length - 1].x} ${padT + innerH} L ${coords[0].x} ${padT + innerH} Z`
      : "";

  const xLabelCount = series.length <= 7 ? series.length : 5;
  const xLabelIndexes = [...new Set(
    Array.from({ length: Math.max(xLabelCount, 2) }, (_, i) =>
      Math.round((i * (series.length - 1)) / Math.max(xLabelCount - 1, 1)),
    ),
  )];

  const hover = hoverIndex != null ? coords[hoverIndex] : null;

  return (
    <div className="dash-premium-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-black text-[#111827]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] font-semibold text-[#9CA3AF]">{subtitle}</p> : null}
        </div>
        {tabs?.length ? (
          <div className="flex flex-wrap gap-1 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setHoverIndex(null);
                }}
                className={`rounded-[12px] px-3 py-1.5 text-xs font-semibold transition-all duration-[250ms] ${
                  activeTab === tab.id
                    ? "bg-[#B6FF38] text-[#102000] shadow-[0_2px_8px_rgba(182,255,56,0.25)]"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!hasData ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-[16px] border border-dashed border-[#ECECEC] bg-[#FAFAFB]/50 px-4 text-center">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-[14px] bg-white shadow-sm">
            <BarChart3 size={20} className="text-[#9CA3AF]" strokeWidth={1.8} />
          </div>
          <p className="text-sm font-bold text-[#111827]">{emptyLabel}</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-[#6B7280]">{emptyDescription}</p>
          {dateRangeLabel ? (
            <p className="mt-3 text-[11px] font-medium text-[#9CA3AF]">{dateRangeLabel}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex h-36 w-9 shrink-0 flex-col justify-between py-0.5 text-right">
            {[...yTicks].reverse().map((tick, i) => (
              <span key={`${tick}-${i}`} className="text-[10px] font-semibold tabular-nums text-[#9CA3AF]">
                {formatTooltipValue(tick)}
              </span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              className="h-36 w-full"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B6FF38" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#B6FF38" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {yTicks.map((tick) => {
                const y = padT + innerH - (tick / yMax) * innerH;
                return (
                  <line
                    key={tick}
                    x1={padL}
                    x2={w - padR}
                    y1={y}
                    y2={y}
                    stroke="#EEF0F3"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#84D400"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {coords.map((point) => (
                <rect
                  key={`${point.date}-${point.index}`}
                  x={Math.max(0, point.x - (series.length > 1 ? innerW / series.length / 2 : innerW / 2))}
                  y="0"
                  width={series.length > 1 ? innerW / series.length : innerW}
                  height={h}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(point.index)}
                />
              ))}
              {hover ? (
                <>
                  <line
                    x1={hover.x}
                    y1={padT}
                    x2={hover.x}
                    y2={padT + innerH}
                    stroke="#B6FF38"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={hover.x}
                    cy={hover.y}
                    r="3.5"
                    fill="#84D400"
                    stroke="#fff"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              ) : null}
            </svg>

            {hover ? (
              <div
                className="pointer-events-none absolute z-10 rounded-[14px] border border-[#ECECEC] bg-white px-3 py-2 text-xs shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                style={{
                  left: `${Math.min(Math.max((hover.x / w) * 100, 10), 90)}%`,
                  top: 8,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="font-medium text-[#6B7280]">{formatAxisLabel(hover.date)}</p>
                <p className="mt-0.5 text-sm font-bold text-[#111827]">
                  {formatTooltipValue(hover.value)}
                  {valueSuffix ? ` ${valueSuffix}` : ""}
                </p>
              </div>
            ) : null}

            <div className="mt-1.5 flex justify-between">
              {xLabelIndexes.map((index) => (
                <span key={`${series[index]?.date}-${index}`} className="text-[10px] font-semibold text-[#9CA3AF]">
                  {series[index] ? formatAxisLabel(series[index].date) : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
