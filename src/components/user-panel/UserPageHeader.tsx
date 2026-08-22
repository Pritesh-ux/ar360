import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  leading?: ReactNode;
  highlighted?: boolean;
  badge?: ReactNode;
};

export default function UserPageHeader({
  title,
  subtitle,
  actions,
  leading,
  highlighted = true,
  badge,
}: Props) {
  const content = (
    <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-3 xl:max-w-[44%] xl:items-center">
        {leading ? <div className="shrink-0 pt-0.5 xl:pt-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.45rem] font-black leading-snug tracking-[-0.03em] text-[#0F1412] md:text-[1.65rem]">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-1.5 text-[13px] font-medium leading-6 text-[#667085]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex min-w-0 w-full flex-wrap items-center gap-2 xl:w-auto xl:max-w-[56%] xl:flex-none xl:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );

  if (!highlighted) return <header className="px-1 py-1">{content}</header>;

  return (
    <header className="overflow-hidden rounded-[1.25rem] border border-[#E8EBE6] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.04)]">
      <div
        className="h-1 w-full bg-gradient-to-r from-[#B9FF2C] via-[#84D400] to-[#5AA700]"
        aria-hidden
      />
      <div className="px-5 py-5 md:px-6 md:py-5">{content}</div>
    </header>
  );
}
