"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { paginationRange, type PaginationMeta } from "@/lib/master-admin/pagination";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  meta?: PaginationMeta;
  maxVisible?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
};

function visiblePages(page: number, totalPages: number, maxVisible: number) {
  const safeTotal = Math.max(1, totalPages);
  const windowSize = Math.min(safeTotal, maxVisible);
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;
  if (end > safeTotal) {
    end = safeTotal;
    start = Math.max(1, end - windowSize + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function AdminPagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
  meta,
  maxVisible = 7,
  pageSizeOptions,
  onPageSizeChange,
  className = "",
}: Props) {
  const safeTotalPages = Math.max(1, totalPages);
  const pages = visiblePages(page, safeTotalPages, maxVisible);
  const range = meta
    ? paginationRange(meta)
    : total != null && pageSize
      ? paginationRange({
          page,
          pageSize,
          total,
          totalPages: safeTotalPages,
        })
      : null;

  const summary =
    range && (meta?.total ?? total) != null
      ? (meta?.total ?? total) === 0
        ? "No results"
        : `Showing ${range.from} to ${range.to} of ${(meta?.total ?? total ?? 0).toLocaleString("en-IN")}`
      : null;

  return (
    <div
      className={`flex flex-col gap-3 border-t border-[#ECECEC] px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      {summary ? (
        <p className="text-[12px] font-semibold text-[#6B7280]">{summary}</p>
      ) : (
        <span />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {pageSizeOptions && onPageSizeChange && pageSize ? (
          <UserFilterDropdown
            hideLabel
            compact
            className="min-w-[110px]"
            menuWidth={140}
            label="Rows per page"
            menuTitle="Rows per page"
            value={String(pageSize)}
            options={pageSizeOptions.map(String)}
            onChange={(value) => onPageSizeChange(Number(value))}
            renderOption={(value) => `${value} / page`}
            renderValue={(value) => `${value} / page`}
          />
        ) : null}

        {safeTotalPages > 1 ? (
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#ECECEC] text-[#6B7280] transition hover:bg-[#FAFAFB] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="First page"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="flex h-9 items-center gap-1 rounded-[12px] border border-[#ECECEC] px-2.5 text-[12px] font-bold text-[#4B5563] transition hover:bg-[#FAFAFB] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {pages.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border text-[12px] font-bold transition ${
                page === n
                  ? "border-[#B6FF38] bg-[#B6FF38] text-[#102000]"
                  : "border-[#ECECEC] text-[#4B5563] hover:bg-[#FAFAFB]"
              }`}
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
            disabled={page >= safeTotalPages}
            className="flex h-9 items-center gap-1 rounded-[12px] border border-[#ECECEC] px-2.5 text-[12px] font-bold text-[#4B5563] transition hover:bg-[#FAFAFB] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={page >= safeTotalPages}
            className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#ECECEC] text-[#6B7280] transition hover:bg-[#FAFAFB] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Last page"
          >
            <ChevronsRight size={16} />
          </button>
          </div>
        ) : null}

        <span className="whitespace-nowrap rounded-[12px] bg-[#FAFAFB] px-2.5 py-2 text-[11px] font-semibold text-[#6B7280]">
          Page {page} of {safeTotalPages}
        </span>
      </div>
    </div>
  );
}
