"use client";

import AdminButton from "./AdminButton";

export type BulkActionOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: BulkActionOption[];
  onApply: () => void;
  disabled?: boolean;
  selectedCount?: number;
  requireSelection?: boolean;
  className?: string;
};

export default function AdminBulkActions({
  value,
  onChange,
  options,
  onApply,
  disabled = false,
  selectedCount = 0,
  requireSelection = true,
  className = "",
}: Props) {
  const applyDisabled = disabled || (requireSelection && selectedCount === 0);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-[148px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-[#A6FF2E]"
      >
        <option value="">Bulk Actions</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {value ? (
        <AdminButton size="sm" onClick={onApply} disabled={applyDisabled}>
          Apply{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </AdminButton>
      ) : null}
    </div>
  );
}
