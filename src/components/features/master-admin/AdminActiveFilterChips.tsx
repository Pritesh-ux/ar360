"use client";

import { X } from "lucide-react";
import type { AdminFilterChip } from "@/lib/master-admin/admin-filter-query";

type Props = {
  chips: AdminFilterChip[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
};

/** Compact active-filter chips + optional Clear all. */
export default function AdminActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
  className = "",
}: Props) {
  if (chips.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="text-[11px] font-semibold text-[#9CA3AF]">Active:</span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemove(chip.id)}
          className="inline-flex items-center gap-1 rounded-full border border-[#D9F99D] bg-[#F7FCE8] px-2 py-0.5 text-[11px] font-semibold text-[#3D6600] hover:bg-[#EEF9D2]"
        >
          {chip.label}
          <X size={12} />
        </button>
      ))}
      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] font-bold text-[#6B7280] underline-offset-2 hover:underline"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
