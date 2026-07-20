type Tone = "success" | "warning" | "info" | "neutral" | "danger" | "processing";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
  neutral: "bg-slate-100 text-slate-600",
  danger: "bg-red-50 text-red-700",
  processing: "bg-sky-50 text-sky-700",
};

export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
