import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function AdminEmptyState({
  title = "No results found",
  description,
  action,
  className = "",
}: Props) {
  return (
    <div
      className={`flex min-h-[220px] w-full flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="status"
    >
      <p className="text-[14px] font-bold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-[13px] font-medium leading-relaxed text-slate-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
