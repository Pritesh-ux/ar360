"use client";

import AdminButton from "./AdminButton";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";

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
  const optionValues = ["", ...options.map((option) => option.value)];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <UserFilterDropdown
        hideLabel
        compact
        className="min-w-[148px]"
        menuWidth={200}
        label="Bulk actions"
        menuTitle="Bulk actions"
        value={value || ""}
        options={optionValues}
        onChange={onChange}
        disabled={disabled}
        renderOption={(optionValue) =>
          optionValue === ""
            ? "Bulk Actions"
            : options.find((option) => option.value === optionValue)?.label || optionValue
        }
        renderValue={(optionValue) =>
          optionValue === ""
            ? "Bulk Actions"
            : options.find((option) => option.value === optionValue)?.label || optionValue
        }
      />
      {value ? (
        <AdminButton size="sm" onClick={onApply} disabled={applyDisabled}>
          Apply{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </AdminButton>
      ) : null}
    </div>
  );
}
