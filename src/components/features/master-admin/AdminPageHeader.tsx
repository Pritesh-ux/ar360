import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  /** Primary back control shown above title */
  backHref?: string;
  backLabel?: string;
  /** When false, skip the highlighted card chrome. Default true. */
  highlighted?: boolean;
};

export default function AdminPageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  backHref,
  backLabel = "Back",
  highlighted = true,
}: Props) {
  const content = (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex h-9 items-center gap-2 rounded-[12px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151] transition hover:border-[#D4D4D4]"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
        ) : null}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF]" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden>/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="transition hover:text-[#6B7280]">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[#374151]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[1.65rem] font-black leading-tight tracking-[-0.03em] text-[#0F1412] md:text-[1.85rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-3xl text-[13px] font-medium leading-6 text-[#667085]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 lg:w-auto lg:max-w-[48%] lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );

  if (!highlighted) {
    return <header className="px-1 py-1">{content}</header>;
  }

  return (
    <header className="relative overflow-hidden rounded-[1.25rem] border border-[#E8EBE6] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.04)] md:px-6 md:py-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#B9FF2C] via-[#84D400] to-[#5AA700]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B9FF2C]/10 blur-2xl"
        aria-hidden
      />
      <div className="relative">{content}</div>
    </header>
  );
}
