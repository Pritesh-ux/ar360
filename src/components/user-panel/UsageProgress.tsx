export default function UsageProgress({
  label,
  usedLabel,
  limitLabel,
  percent,
}: {
  label: string;
  usedLabel: string;
  limitLabel: string;
  percent: number;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="font-bold text-[var(--ar-text)]">{label}</span>
        <span className="font-semibold text-[var(--ar-text-muted)]">
          <span className="text-[var(--ar-primary-hover)]">{usedLabel}</span>
          {" / "}
          {limitLabel}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--ar-border)]">
        <div
          className="h-full rounded-full bg-[var(--ar-primary)] transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
