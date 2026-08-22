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
        <span className="font-semibold text-[#111827]">{label}</span>
        <span className="font-medium text-[#6B7280]">
          <span className="text-[#22C55E]">{usedLabel}</span>
          {" / "}
          {limitLabel}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
        <div
          className="dash-progress-bar h-full rounded-full bg-gradient-to-r from-[#B6FF38] to-[#84D400] transition-all duration-700 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
