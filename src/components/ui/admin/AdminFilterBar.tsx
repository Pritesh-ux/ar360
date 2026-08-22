import type { ReactNode } from "react";
import AdminButton from "./AdminButton";

type Props = {
  children: ReactNode;
  onClear?: () => void;
  className?: string;
};

export default function AdminFilterBar({ children, onClear, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col gap-2 border-b border-[#ECECEC] p-4 lg:flex-row lg:flex-wrap lg:items-center ${className}`}
    >
      {children}
      {onClear && (
        <AdminButton variant="ghost" size="sm" onClick={onClear}>
          Clear
        </AdminButton>
      )}
    </div>
  );
}
