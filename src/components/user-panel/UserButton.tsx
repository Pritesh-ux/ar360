import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-[var(--ar-primary)] text-[var(--ar-text)] hover:bg-[var(--ar-primary-hover)] border border-transparent shadow-sm",
  secondary:
    "bg-[var(--ar-primary-soft)] text-[var(--ar-text)] hover:bg-[var(--ar-primary-soft)]/80 border border-transparent",
  outline:
    "bg-white text-[var(--ar-text)] border border-[var(--ar-border)] hover:bg-[var(--ar-surface-soft)]",
  ghost: "bg-transparent text-[var(--ar-text-muted)] hover:bg-[var(--ar-surface-soft)] border border-transparent",
  destructive:
    "bg-[var(--ar-danger)] text-white hover:opacity-90 border border-transparent",
};

export default function UserButton({
  variant = "primary",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
