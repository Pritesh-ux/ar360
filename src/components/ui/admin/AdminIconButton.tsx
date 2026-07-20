import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "default" | "danger" | "info";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: Tone;
  label: string;
};

const TONE_CLASSES: Record<Tone, string> = {
  default: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  danger: "text-slate-500 hover:bg-red-50 hover:text-red-600",
  info: "text-slate-500 hover:bg-sky-50 hover:text-sky-600",
};

export default function AdminIconButton({
  children,
  tone = "default",
  label,
  className = "",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
