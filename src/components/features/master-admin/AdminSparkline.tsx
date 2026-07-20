type Props = {
  values?: number[];
  color?: string;
  className?: string;
};

export default function AdminSparkline({
  values = [4, 7, 5, 9, 6, 11, 8, 13, 10, 15],
  color = "#7AE02E",
  className = "",
}: Props) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 32;
  const step = width / Math.max(values.length - 1, 1);

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-8 w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
