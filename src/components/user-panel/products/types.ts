export type ProductListItem = {
  id: string;
  productUid?: string;
  title: string;
  category?: string;
  folder?: string;
  productFolder?: string;
  poster?: string;
  thumbnailUrl?: string;
  views?: number;
  status?: string;
  arOpens?: number;
  qrScans?: number;
};

export function normalizeProductStatus(value?: string | null) {
  const raw = String(value || "Draft").trim().toLowerCase();
  if (raw === "published" || raw === "publish" || raw === "active") return "Published";
  if (raw === "archived" || raw === "archive") return "Archived";
  if (raw === "processing") return "Processing";
  return "Draft";
}

export function getProductCategory(product: ProductListItem) {
  const cleaned = String(product.category || "").trim();
  return cleaned || "Uncategorized";
}
