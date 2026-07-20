import Link from "next/link";
import type { ReactNode } from "react";
import { AUTH_ACCENT, AUTH_BRAND, AUTH_BRAND_INK } from "@/components/auth/constants";

export function authInputClassName(hasError?: boolean) {
  return [
    "h-12 w-full rounded-xl bg-white px-4 text-[15px] text-[#111] outline-none transition shadow-none",
    "border border-[#E5E7EB]",
    "placeholder:text-[#A3A3A3]",
    "focus:border-[#E5E7EB] focus:outline-none focus:ring-0 focus:shadow-none",
    hasError ? "border-red-300 focus:border-red-300" : "",
  ].join(" ");
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-10">
      <h1 className="font-[family-name:var(--font-auth-display)] text-[2.35rem] font-medium leading-[1.1] tracking-[-0.035em] text-[#111] sm:text-[2.75rem]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-4 max-w-[38ch] text-[15px] leading-7 text-[#737373]">{subtitle}</p>
      ) : null}
    </header>
  );
}

export function AuthField({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-[#525252]">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && !error ? <p className="mt-1.5 text-[12px] text-[#A3A3A3]">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-[12px] font-medium text-red-600">{error}</p> : null}
    </label>
  );
}

export function AuthPrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: AUTH_BRAND, color: AUTH_BRAND_INK }}
    >
      {children}
    </button>
  );
}

export function AuthSecondaryButton({
  children,
  disabled,
  onClick,
  href,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "inline-flex h-12 items-center justify-center rounded-xl border-0 bg-[#F4F6F0] px-5 text-[15px] font-semibold text-[#171717] transition hover:bg-[#EBEEE6] disabled:opacity-50";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700"
    >
      {message}
    </div>
  );
}

export function authLinkClassName() {
  return `font-semibold hover:underline`;
}

export function AuthLinkStyle({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link href={href} className="font-semibold hover:underline" style={{ color: AUTH_ACCENT }}>
      {children}
    </Link>
  );
}
