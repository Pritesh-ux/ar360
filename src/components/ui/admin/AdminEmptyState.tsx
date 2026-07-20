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
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      <p className="text-[14px] font-bold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] font-medium text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
