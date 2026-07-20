export type PaginationParams = {
  page: number;
  pageSize: number;
  offset: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export function parsePagination(
  searchParams: URLSearchParams,
  defaults?: { page?: number; pageSize?: number },
): PaginationParams {
  const page = Math.max(1, Number(searchParams.get("page") || defaults?.page || DEFAULT_PAGE) || DEFAULT_PAGE);
  const rawSize = Number(searchParams.get("pageSize") || defaults?.pageSize || DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize || DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

export function paginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  return {
    page,
    pageSize,
    total: safeTotal,
    totalPages,
  };
}

export function paginationRange(meta: PaginationMeta) {
  if (meta.total === 0) {
    return { from: 0, to: 0 };
  }
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return { from, to };
}
