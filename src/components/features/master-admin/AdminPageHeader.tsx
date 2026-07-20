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
};

export default function AdminPageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  backHref,
  backLabel = "Back",
}: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:border-[#A6FF2E] hover:bg-[#A6FF2E]/10"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
        ) : null}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span>/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="transition hover:text-slate-600">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-600">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
