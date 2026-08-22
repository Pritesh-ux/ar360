import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "./tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: adminPrimaryButtonClass,
  secondary: adminSecondaryButtonClass,
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2.5 text-[13px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3 py-2 text-[12px]",
  md: "",
};

export default function AdminButton({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
