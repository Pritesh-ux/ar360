"use client";

import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";

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
  /** Optional counts for mobile status tabs */
  statusCounts?: { all?: number; published?: number; drafts?: number };
};

function folderLabel(value: string) {
  return value === "All" ? "All Folders" : value;
}

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
  statusCounts,
}: Props) {
  const tabs = [
    { key: "All", label: `All${statusCounts?.all != null ? ` (${statusCounts.all})` : ""}` },
    {
      key: "Saved",
      label: "Saved",
    },
    {
      key: "Archived",
      label: "Archived",
    },
  ] as const;

  return (
    <>
      {/* Mobile status tabs — mockup style */}
      <div className="flex gap-5 overflow-x-auto border-b border-[#E8EBE8] md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = status === tab.key || (tab.key === "All" && status === "All");
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatusChange(tab.key)}
              className={[
                "shrink-0 border-b-2 pb-2 text-[14px] font-semibold transition",
                active
                  ? "border-[#84D400] text-[#111111]"
                  : "border-transparent text-[#737373]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Desktop filters */}
      <div className="dash-premium-card hidden flex-wrap items-end gap-2 p-3 md:flex md:gap-3 md:p-4">
        <div className="hidden xl:block">
          <UserFilterDropdown
            label="Folder"
            menuTitle="Folder"
            value={folder}
            options={folders}
            onChange={onFolderChange}
            renderOption={folderLabel}
            renderValue={folderLabel}
            menuWidth={240}
          />
        </div>

        <UserFilterDropdown
          label="Status"
          menuTitle="Status"
          value={status}
          options={["All", "Saved", "Processing", "Archived"]}
          onChange={onStatusChange}
        />

        <UserFilterDropdown
          label="Category"
          menuTitle="Category"
          value={category}
          options={categories}
          onChange={onCategoryChange}
          menuWidth={240}
        />

        <div className="w-full min-w-0 sm:ml-auto sm:w-auto sm:min-w-[180px]">
          <UserFilterDropdown
            label="Sort by"
            menuTitle="Sort by"
            value={sortBy}
            options={sortOptions}
            onChange={onSortChange}
            menuWidth={240}
          />
        </div>
      </div>
    </>
  );
}
