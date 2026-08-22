"use client";

const PAGE_SIZE_OPTIONS = [8, 12] as const;

type Props = {
  currentPage: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  embedded?: boolean;
};

export default function ProductsPagination({
  currentPage,
  totalPages,
  from,
  to,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  embedded = false,
}: Props) {
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const activePageSize = PAGE_SIZE_OPTIONS.includes(pageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? pageSize
    : PAGE_SIZE_OPTIONS[0];

  return (
    <div
      className={
        embedded
          ? "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
          : "flex flex-col gap-3 rounded-[16px] bg-[#FAFAFA] px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
      }
    >
      <p className="text-[13px] font-medium text-[#737373]">
        Showing {from}-{to} of {total} products
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="mr-1 flex items-center gap-2 text-[13px] font-medium text-[#525252]">
          <span className="hidden sm:inline">Per page</span>
          <select
            value={activePageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg bg-white px-2 text-[13px] font-semibold text-[#111111] outline-none ring-1 ring-[#ECECEC] transition focus:ring-[#84D400]"
            aria-label="Products per page"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[#525252] transition hover:bg-white disabled:opacity-40"
          aria-label="Previous page"
        >
          ‹
        </button>

        {visiblePages.map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="px-1 text-[#737373]">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={[
                "flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-[13px] font-semibold transition",
                currentPage === page
                  ? "bg-[#B6FF38] text-[#102000]"
                  : "text-[#525252] hover:bg-white",
              ].join(" ")}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[#525252] transition hover:bg-white disabled:opacity-40"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "..."> = [1];

  if (currentPage > 3) pages.push("...");

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (currentPage < totalPages - 2) pages.push("...");

  pages.push(totalPages);
  return pages;
}
