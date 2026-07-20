import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Optional control on the left of the title (e.g. back button). */
  leading?: ReactNode;
  highlighted?: boolean;
};

export default function UserPageHeader({
  title,
  subtitle,
  actions,
  leading,
  highlighted = true,
}: Props) {
  const content = (
    <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        {leading ? <div className="shrink-0 pt-0.5 sm:pt-0">{leading}</div> : null}
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.035em] text-[#111315] md:text-[30px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-3xl text-[14px] font-medium leading-6 text-[#72777B]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );

  if (!highlighted) return <header className="px-1 py-1">{content}</header>;

  return (
    <header className="rounded-[20px] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(17,20,22,0.045)] md:px-6 md:py-6">
      {content}
    </header>
  );
}
