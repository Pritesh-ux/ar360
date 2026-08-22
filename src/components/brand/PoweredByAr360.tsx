import { BrandLogo } from "@/components/brand/BrandLogo";

type Props = {
  className?: string;
  tone?: "light" | "dark";
  /** Replaces "AR360" in "Powered by …". */
  label?: string | null;
};

export function poweredByDisplayName(label?: string | null) {
  const name = String(label || "").trim();
  return name || "AR360";
}

/** Compact attribution mark used on public AR / embed viewers. */
export default function PoweredByAr360({ className = "", tone = "light", label }: Props) {
  const name = poweredByDisplayName(label);
  const isDefault = name.toLowerCase() === "ar360";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide ${className}`.trim()}
    >
      {isDefault ? <BrandLogo tone={tone} variant="mark" href={null} size={12} /> : null}
      <span>Powered by {name}</span>
    </span>
  );
}
