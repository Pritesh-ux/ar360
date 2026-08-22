"use client";

import { Search, UploadCloud, Grid3X3, List } from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";

type Props = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onUpload: () => void;
  uploading?: boolean;
};

export default function ProductsToolbar({
  searchInput,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onUpload,
  uploading = false,
}: Props) {
  return (
    <>
      {/* Mobile: compact My Products header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3 pb-0.5">
          <h1 className="text-[26px] font-black tracking-tight text-[#111111]">My Products</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full text-[#525252]"
              aria-label="Search"
              onClick={() => {
                const el = document.getElementById("mobile-products-search");
                el?.focus();
              }}
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange(viewMode === "grid" ? "list" : "grid")}
              className="grid h-10 w-10 place-items-center rounded-full text-[#525252]"
              aria-label="Toggle view"
            >
              {viewMode === "grid" ? <List size={20} /> : <Grid3X3 size={20} />}
            </button>
          </div>
        </div>
        <div className="dash-products-search mt-1.5 w-full min-w-0">
          <Search size={16} className="dash-products-search__icon" />
          <input
            id="mobile-products-search"
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search products..."
            className="dash-products-input dash-products-input--icon"
          />
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <UserPageHeader
          title="Products"
          subtitle="Manage all your 3D products, models and assets."
          actions={
            <div className="flex w-full min-w-0 flex-row flex-wrap items-center justify-start gap-2 lg:flex-nowrap lg:justify-end">
              <div className="dash-products-search w-full max-w-[280px] shrink-0 sm:w-[240px] xl:w-[280px]">
                <Search size={16} className="dash-products-search__icon" aria-hidden />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="dash-products-input dash-products-input--icon placeholder:text-[#9CA3AF]"
                />
              </div>

              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                className={`dash-products-view-toggle shrink-0 ${
                  viewMode === "grid" ? "dash-products-view-toggle--active" : ""
                }`}
                aria-label="Grid view"
              >
                <Grid3X3 size={18} />
              </button>

              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                className={`dash-products-view-toggle shrink-0 ${
                  viewMode === "list" ? "dash-products-view-toggle--active" : ""
                }`}
                aria-label="List view"
              >
                <List size={18} />
              </button>

              <button
                type="button"
                onClick={onUpload}
                disabled={uploading}
                className="dash-premium-btn-primary flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#84D400] px-4 font-semibold text-[#102000] shadow-sm hover:bg-[#78C400] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UploadCloud size={18} className="shrink-0" />
                <span>{uploading ? "Checking..." : "Upload 3D Model"}</span>
              </button>
            </div>
          }
        />
      </div>
    </>
  );
}
