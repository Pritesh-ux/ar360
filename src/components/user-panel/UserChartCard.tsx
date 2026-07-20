"use client";

import { useMemo, useState } from "react";

type Point = { date: string; value: number };

type Props = {
  title: string;
  points: Point[];
  tabs?: Array<{ id: string; label: string; values: Point[] }>;
  emptyLabel?: string;
};

function formatAxisLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatTooltipValue(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export default function UserChartCard({ title, points, tabs, emptyLabel = "No data for this period" }: Props) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id || "default");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = useMemo(() => {
    if (tabs?.length) {
      return tabs.find((tab) => tab.id === activeTab)?.values || points;
    }
    return points;
  }, [activeTab, points, tabs]);

  const max = Math.max(...series.map((p) => p.value), 1);
  const hasData = series.some((p) => p.value > 0);

  const coords = series.map((point, index) => {
    const x = series.length <= 1 ? 50 : (index / (series.length - 1)) * 100;
    const y = 100 - (point.value / max) * 82 - 8;
    return { ...point, x, y, index };
  });

  const linePath =
    coords.length >= 2
      ? coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")
      : "";
  const areaPath =
    coords.length >= 2
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} 100 L ${coords[0].x.toFixed(2)} 100 Z`
      : "";

  const hover = hoverIndex != null ? coords[hoverIndex] : null;

  return (
    <div className="rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-surface)] p-4 shadow-[var(--ar-shadow-sm)] md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-black text-[var(--ar-text)] md:text-lg">{title}</h2>
        {tabs?.length ? (
          <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--ar-surface-soft)] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? "bg-[var(--ar-surface)] text-[var(--ar-text)] shadow-sm"
                    : "text-[var(--ar-text-muted)] hover:text-[var(--ar-text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!hasData ? (
        <div className="grid h-56 place-items-center rounded-xl border border-dashed border-[var(--ar-border)] text-sm font-semibold text-[var(--ar-text-muted)]">
          {emptyLabel}
        </div>
      ) : (
        <div className="relative h-56">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="arChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ar-primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--ar-primary)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[20, 40, 60, 80].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="var(--ar-border)"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {areaPath ? <path d={areaPath} fill="url(#arChartFill)" /> : null}
            {linePath ? (
              <path
                d={linePath}
                fill="none"
                stroke="var(--ar-primary-hover)"
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {coords.map((point) => (
              <rect
                key={point.date}
                x={Math.max(0, point.x - (series.length > 1 ? 50 / series.length : 50))}
                y="0"
                width={series.length > 1 ? 100 / series.length : 100}
                height="100"
                fill="transparent"
                onMouseEnter={() => setHoverIndex(point.index)}
              />
            ))}
            {hover ? (
              <>
                <line
                  x1={hover.x}
                  y1="8"
                  x2={hover.x}
                  y2="100"
                  stroke="var(--ar-primary-border)"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={hover.x}
                  cy={hover.y}
                  r="2.2"
                  fill="var(--ar-primary-hover)"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </svg>

          {hover ? (
            <div
              className="pointer-events-none absolute z-10 rounded-xl border border-[var(--ar-border)] bg-white px-3 py-2 text-xs shadow-[var(--ar-shadow-md)]"
              style={{
                left: `${Math.min(Math.max(hover.x, 8), 92)}%`,
                top: "8%",
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-bold text-[var(--ar-text-muted)]">{formatAxisLabel(hover.date)}</p>
              <p className="mt-0.5 text-sm font-black text-[var(--ar-text)]">
                {formatTooltipValue(hover.value)}
              </p>
            </div>
          ) : null}

          <div className="mt-2 flex justify-between text-[11px] font-semibold text-[var(--ar-text-muted)]">
            <span>{series[0] ? formatAxisLabel(series[0].date) : ""}</span>
            <span>{series[series.length - 1] ? formatAxisLabel(series[series.length - 1].date) : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}
