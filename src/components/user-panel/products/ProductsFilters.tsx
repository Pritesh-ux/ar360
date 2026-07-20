"use client";

import type { ReactNode } from "react";

type FilterSelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  renderOption?: (value: string) => ReactNode;
};

function FilterSelect({ label, value, options, onChange, renderOption }: FilterSelectProps) {
  return (
    <label className="flex min-w-[150px] flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#525252]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[14px] border border-[#C8CDD4] bg-white px-3 text-[13px] font-medium text-[#111111] outline-none transition focus:border-[#84D400] focus:ring-2 focus:ring-[#84D400]/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {renderOption ? renderOption(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

type Props = {
  folder: string;
  status: string;
  category: string;
  sortBy: string;
  folders: string[];
  categories: string[];
  sortOptions: string[];
  onFolderChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: string) => void;
  embedded?: boolean;
};

export default function ProductsFilters({
  folder,
  status,
  category,
  sortBy,
  folders,
  categories,
  sortOptions,
  onFolderChange,
  onStatusChange,
  onCategoryChange,
  onSortChange,
  embedded = false,
}: Props) {
  return (
    <div
      className={
        embedded
          ? "flex flex-wrap items-end gap-3 p-3 md:p-4"
          : "flex flex-wrap items-end gap-3 rounded-[20px] border border-[#ECECEC] bg-white p-3 shadow-sm md:p-4"
      }
    >
      <FilterSelect label="Folder" value={folder} options={folders} onChange={onFolderChange} />
      <FilterSelect
        label="Status"
        value={status}
        options={["All", "Draft", "Published", "Processing", "Archived"]}
        onChange={onStatusChange}
      />
      <FilterSelect label="Category" value={category} options={categories} onChange={onCategoryChange} />
      <div className="ml-auto min-w-[180px]">
        <FilterSelect label="Sort by" value={sortBy} options={sortOptions} onChange={onSortChange} />
      </div>
    </div>
  );
}
