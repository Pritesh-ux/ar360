type Props = {
  values: number[];
  color?: string;
  height?: number;
};

export default function MetricSparkline({ values, color = "#84D400", height = 44 }: Props) {
  const raw = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  const isFlat = raw.every((value) => value === 0);
  const series = isFlat
    ? raw.map((_, index) => {
        const t = index / Math.max(raw.length - 1, 1);
        return 0.22 + Math.sin(t * Math.PI * 2.4) * 0.14 + Math.sin(t * Math.PI * 5.5) * 0.06;
      })
    : raw;
  const max = Math.max(...series, 1);
  const width = 100;
  const points = series.map((value, index) => {
    const x = series.length <= 1 ? width / 2 : (index / (series.length - 1)) * width;
    const y = height - (value / max) * (height - 8) - 4;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = points.join(" ");
  const area = `${points[0]} ${points.slice(1).join(" ")} ${width},${height} 0,${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${color.replace("#", "")})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}
