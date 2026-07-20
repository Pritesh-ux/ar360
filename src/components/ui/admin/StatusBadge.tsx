import type { StatusDomain, StatusTone } from "./status-resolver";
import { resolveStatusTone, statusToneClass } from "./status-resolver";

type Props = {
  label: string;
  tone?: StatusTone;
  domain?: StatusDomain;
  value?: string;
  size?: "sm" | "md";
  uppercase?: boolean;
  className?: string;
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
};

export default function StatusBadge({
  label,
  tone,
  domain,
  value,
  size = "md",
  uppercase = false,
  className = "",
}: Props) {
  const resolvedTone = tone ?? (domain && value != null ? resolveStatusTone(domain, value) : "neutral");

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ring-1 ring-inset ${SIZE_CLASSES[size]} ${
        uppercase ? "uppercase tracking-wide" : ""
      } ${statusToneClass(resolvedTone)} ${className}`}
    >
      {label}
    </span>
  );
}
