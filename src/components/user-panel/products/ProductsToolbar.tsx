"use client";

import { Search, UploadCloud, Grid3X3, List, SlidersHorizontal } from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";

type Props = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onUpload: () => void;
  uploading?: boolean;
  onFilterClick?: () => void;
  /** Render inside a shared page card (no outer border) */
  embedded?: boolean;
};

export default function ProductsToolbar({
  searchInput,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onUpload,
  uploading = false,
  embedded = false,
}: Props) {
  const header = (
    <UserPageHeader
      highlighted={!embedded}
      title="Products"
      subtitle="Manage all your 3D products, models and assets."
      actions={
        <>
          <div className="relative min-w-[220px] flex-1 lg:w-[320px] lg:flex-none">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products..."
              className="h-11 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-11 pr-4 text-[14px] font-medium outline-none transition focus:border-[#84D400]"
            />
          </div>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#ECECEC] bg-white text-[#525252] hover:bg-[#FAFAFA]"
            aria-label="Filters"
          >
            <SlidersHorizontal size={18} />
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`flex h-11 w-11 items-center justify-center rounded-[14px] border ${
              viewMode === "grid"
                ? "border-[#84D400] bg-[#EEF9E0] text-[#5FA800]"
                : "border-[#ECECEC] bg-white text-[#525252]"
            }`}
            aria-label="Grid view"
          >
            <Grid3X3 size={18} />
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`flex h-11 w-11 items-center justify-center rounded-[14px] border ${
              viewMode === "list"
                ? "border-[#84D400] bg-[#EEF9E0] text-[#5FA800]"
                : "border-[#ECECEC] bg-white text-[#525252]"
            }`}
            aria-label="List view"
          >
            <List size={18} />
          </button>

          <button
            type="button"
            onClick={onUpload}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-[14px] font-semibold text-[#102000] shadow-sm transition hover:bg-[#78C400] active:scale-[0.99]"
          >
            <UploadCloud size={18} />
            {uploading ? "Checking..." : "Upload 3D Model"}
          </button>
        </>
      }
    />
  );

  if (!embedded) return header;

  return <div className="border-b border-[#ECECEC] p-4 md:p-5">{header}</div>;
}
