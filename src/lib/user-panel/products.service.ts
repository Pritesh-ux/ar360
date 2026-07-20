import fs from "fs/promises";
import path from "path";
import { ACTIVE_PRODUCT_SQL } from "@/lib/customerIsolation";
import { ensureProductSchema, query, type QueryValue } from "@/lib/db";
import { getProductFolder, updateProductJson } from "@/lib/localCustomerStorage";
import { locateProductJsonPath } from "@/lib/storage/locate-asset";
import { scanCustomerProductsFromDisk } from "@/lib/products/disk-sync";
import { recalculateCustomerStorage } from "@/lib/storage";
import { randomBytes } from "crypto";
import {
  checkEnterpriseModelLimit,
  checkProductLimit,
  checkStorageLimit,
} from "@/lib/billing/limit-enforcement";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";

export type ProductSortKey =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "views"
  | "updated";

export type ProductListFilters = {
  customerUid: string;
  userId: number;
  q?: string;
  folder?: string;
  status?: string;
  category?: string;
  sort?: ProductSortKey;
  page?: number;
  pageSize?: number;
  /** Hide products assigned to any client workspace (main Products library). */
  excludeClientLinked?: boolean;
};

export type ProductListItem = {
  id: string;
  productUid: string;
  customerUid: string;
  title: string;
  category: string;
  folder: string;
  productFolder: string;
  modelUrl: string;
  fileName: string;
  poster: string;
  thumbnailUrl: string;
  qrUrl: string;
  status: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type ProductListResult = {
  products: ProductListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  };
  facets: {
    folders: string[];
    categories: string[];
    statuses: string[];
  };
};

type ProductRow = {
  id: string;
  customer_uid: string | null;
  title: string;
  category: string | null;
  model_url: string | null;
  file_name: string | null;
  poster: string | null;
  thumbnail_url: string | null;
  qr_url: string | null;
  product_folder: string | null;
  status: string;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeStatus(value?: string | null) {
  const raw = String(value || "Draft").trim().toLowerCase();
  if (raw === "published" || raw === "publish" || raw === "active") return "Published";
  if (raw === "archived" || raw === "archive" || raw === "disabled") return "Archived";
  if (raw === "processing") return "Processing";
  return "Draft";
}

function normalizeFolder(value?: string | null) {
  const folder = String(value || "All").trim();
  return folder || "All";
}

function rowToListItem(row: ProductRow, customerUid: string): ProductListItem {
  const folder = normalizeFolder(row.product_folder);
  return {
    id: row.id,
    productUid: row.id,
    customerUid: row.customer_uid ?? customerUid,
    title: row.title,
    category: row.category ?? "Uncategorized",
    folder,
    productFolder: folder,
    modelUrl: row.model_url ?? "",
    fileName: row.file_name ?? "",
    poster: row.poster ?? "",
    thumbnailUrl: row.thumbnail_url ?? "",
    qrUrl: row.qr_url ?? "",
    status: normalizeStatus(row.status),
    views: Number(row.views || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

function sortClause(sort: ProductSortKey) {
  switch (sort) {
    case "oldest":
      return "p.created_at ASC";
    case "name_asc":
      return "p.title ASC";
    case "name_desc":
      return "p.title DESC";
    case "views":
      return "p.views DESC, p.updated_at DESC";
    case "updated":
      return "p.updated_at DESC";
    default:
      return "p.created_at DESC";
  }
}

async function ensureCustomerProductsSynced(customerUid: string, userId: number) {
  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND ${ACTIVE_PRODUCT_SQL}`,
    [customerUid],
  ).catch(() => [{ total: 0 }]);

  if (Number(countRows[0]?.total || 0) > 0) return;

  const diskProducts = await scanCustomerProductsFromDisk(customerUid);
  for (const json of diskProducts) {
    const productUid = String(json.productUid || json.id || "");
    if (!productUid) continue;
    try {
      await query(
        `INSERT INTO products
           (id, customer_uid, user_id, title, category, model_url, file_name,
            poster, thumbnail_url, qr_url, product_folder, status, views)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           category = VALUES(category),
           model_url = COALESCE(VALUES(model_url), model_url),
           product_folder = COALESCE(VALUES(product_folder), product_folder),
           status = COALESCE(VALUES(status), status),
           updated_at = NOW()`,
        [
          productUid,
          customerUid,
          userId,
          String(json.title || "Untitled"),
          String(json.category || "Uncategorized"),
          String(json.modelUrl || ""),
          String(json.fileName || ""),
          String(json.poster || ""),
          String(json.thumbnailUrl || ""),
          String(json.qrUrl || ""),
          normalizeFolder(String(json.folder || json.productFolder || json.publicFolder || "All")),
          normalizeStatus(String(json.status || "Draft")),
          Number(json.views || 0),
        ],
      );
    } catch {
      // skip invalid rows
    }
  }
}

async function readProductJson(customerUid: string, productUid: string) {
  try {
    const located = await locateProductJsonPath(customerUid, productUid);
    if (located) {
      const raw = await fs.readFile(located, "utf8");
      return JSON.parse(raw) as Record<string, unknown>;
    }
    const file = path.join(getProductFolder(customerUid, productUid), "product.json");
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function listCustomerProducts(input: ProductListFilters): Promise<ProductListResult> {
  await ensureProductSchema();
  await ensureCustomerProductsSynced(input.customerUid, input.userId);

  const pageSize = Math.min(Math.max(input.pageSize ?? 8, 1), 50);
  const page = Math.max(input.page ?? 1, 1);
  const sort = input.sort ?? "newest";

  const conditions: string[] = [
    "p.customer_uid = ?",
    "(p.user_id = ? OR p.user_id IS NULL)",
    `p.${ACTIVE_PRODUCT_SQL}`,
  ];
  const values: QueryValue[] = [input.customerUid, input.userId];

  const q = input.q?.trim();
  if (q) {
    conditions.push("(p.title LIKE ? OR p.id LIKE ? OR p.category LIKE ? OR p.file_name LIKE ?)");
    const like = `%${q}%`;
    values.push(like, like, like, like);
  }

  const folder = input.folder?.trim();
  if (folder && folder !== "All") {
    conditions.push("COALESCE(NULLIF(p.product_folder, ''), 'All') = ?");
    values.push(folder);
  }

  const status = input.status?.trim();
  if (status && status !== "All") {
    if (status === "Published") {
      conditions.push("LOWER(p.status) IN ('published', 'active')");
    } else if (status === "Archived") {
      conditions.push("LOWER(p.status) IN ('archived', 'disabled')");
    } else if (status === "Processing") {
      conditions.push("LOWER(p.status) = 'processing'");
    } else {
      conditions.push("LOWER(p.status) IN ('draft')");
    }
  }

  const category = input.category?.trim();
  if (category && category !== "All") {
    conditions.push("COALESCE(NULLIF(p.category, ''), 'Uncategorized') = ?");
    values.push(category);
  }

  if (input.excludeClientLinked) {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM client_resources cr
      INNER JOIN clients cl ON cl.client_uid = cr.client_uid
      WHERE cl.customer_uid = p.customer_uid
        AND cr.resource_type = 'product'
        AND cr.resource_id = p.id
    )`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [countRows, facetRows, rows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) AS total FROM products p ${where}`, values),
    query<{ product_folder: string | null; category: string | null; status: string | null }>(
      `SELECT DISTINCT product_folder, category, status
         FROM products
        WHERE customer_uid = ? AND (user_id = ? OR user_id IS NULL) AND ${ACTIVE_PRODUCT_SQL}`,
      [input.customerUid, input.userId],
    ),
    query<ProductRow>(
      `SELECT p.id, p.customer_uid, p.title, p.category, p.model_url, p.file_name,
              p.poster, p.thumbnail_url, p.qr_url, p.product_folder, p.status, p.views,
              p.published_at, p.created_at, p.updated_at
         FROM products p
         ${where}
         ORDER BY ${sortClause(sort)}
         LIMIT ? OFFSET ?`,
      [...values, pageSize, (page - 1) * pageSize],
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const products = await Promise.all(
    rows.map(async (row) => {
      const base = rowToListItem(row, input.customerUid);
      const json = await readProductJson(input.customerUid, row.id);
      if (!json) return base;
      const jsonFolder = normalizeFolder(
        String(json.folder || json.productFolder || json.publicFolder || base.folder),
      );
      return {
        ...base,
        poster: String(json.poster || base.poster || ""),
        thumbnailUrl: String(json.thumbnailUrl || base.thumbnailUrl || ""),
        modelUrl: String(json.modelUrl || base.modelUrl || ""),
        folder: jsonFolder,
        productFolder: jsonFolder,
        status: normalizeStatus(String(json.status || base.status)),
      };
    }),
  );

  const folders = new Set<string>(["All"]);
  const categories = new Set<string>(["All"]);
  const statuses = new Set<string>(["All", "Draft", "Published", "Archived"]);

  for (const row of facetRows) {
    folders.add(normalizeFolder(row.product_folder));
    categories.add(String(row.category || "Uncategorized"));
    statuses.add(normalizeStatus(row.status));
  }

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return {
    products,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      from,
      to,
    },
    facets: {
      folders: Array.from(folders).sort((a, b) => (a === "All" ? -1 : a.localeCompare(b))),
      categories: Array.from(categories).sort((a, b) => (a === "All" ? -1 : a.localeCompare(b))),
      statuses: Array.from(statuses),
    },
  };
}

function newProductUid(prefix = "prd") {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export async function duplicateCustomerProduct(input: {
  customerUid: string;
  userId: number;
  sourceProductUid: string;
  title?: string;
}) {
  await ensureProductSchema();

  const rows = await query<ProductRow>(
    `SELECT id, customer_uid, title, category, model_url, file_name, poster, thumbnail_url,
            qr_url, product_folder, status, views, published_at, created_at, updated_at
       FROM products
      WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL) AND ${ACTIVE_PRODUCT_SQL}
      LIMIT 1`,
    [input.sourceProductUid, input.customerUid, input.userId],
  );

  const sourceRow = rows[0];
  const sourceJson = await readProductJson(input.customerUid, input.sourceProductUid);
  if (!sourceRow && !sourceJson) {
    throw new Error("Product not found.");
  }

  const copyUid = newProductUid();
  const sourceFolder = getProductFolder(input.customerUid, input.sourceProductUid);
  const targetFolder = getProductFolder(input.customerUid, copyUid);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(sourceFolder);
  } catch {
    entries = [];
  }

  const plan = await resolveCustomerPlanLimits(input.customerUid);
  const [productLimit, modelLimit] = await Promise.all([
    checkProductLimit(input.customerUid, String(plan.planId)),
    checkEnterpriseModelLimit(input.customerUid, plan),
  ]);
  if (productLimit.ok === false) throw new Error(productLimit.message);
  if (modelLimit.ok === false) throw new Error(modelLimit.message);

  let incomingBytes = 0;
  for (const entry of entries) {
    if (entry === "product.json") continue;
    const stat = await fs.stat(path.join(sourceFolder, entry)).catch(() => null);
    if (stat?.isFile()) incomingBytes += stat.size;
  }
  const storageLimit = await checkStorageLimit(
    input.customerUid,
    incomingBytes,
    0,
    String(plan.planId),
  );
  if (storageLimit.ok === false) throw new Error(storageLimit.message);

  await fs.mkdir(targetFolder, { recursive: true });

  for (const entry of entries) {
    if (entry === "product.json") continue;
    await fs.copyFile(path.join(sourceFolder, entry), path.join(targetFolder, entry));
  }

  const baseJson = sourceJson || {};
  const nextJson: Record<string, unknown> = {
    ...baseJson,
    id: copyUid,
    productUid: copyUid,
    customerUid: input.customerUid,
    title: input.title || `${String(baseJson.title || sourceRow?.title || "Untitled")} Copy`,
    status: "Draft",
    views: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await updateProductJson({
    customerUid: input.customerUid,
    productUid: copyUid,
    patch: nextJson,
  });

  await query(
    `INSERT INTO products
       (id, customer_uid, user_id, title, category, model_url, file_name,
        poster, thumbnail_url, qr_url, product_folder, status, views)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', 0)`,
    [
      copyUid,
      input.customerUid,
      input.userId,
      String(nextJson.title),
      String(nextJson.category || sourceRow?.category || "Uncategorized"),
      String(nextJson.modelUrl || sourceRow?.model_url || ""),
      String(nextJson.fileName || sourceRow?.file_name || ""),
      String(nextJson.poster || sourceRow?.poster || ""),
      String(nextJson.thumbnailUrl || sourceRow?.thumbnail_url || ""),
      String(nextJson.qrUrl || sourceRow?.qr_url || ""),
      normalizeFolder(String(nextJson.folder || nextJson.productFolder || sourceRow?.product_folder || "All")),
    ],
  );

  await recalculateCustomerStorage(input.customerUid).catch(() => {});

  return { productUid: copyUid };
}

export async function patchCustomerProduct(input: {
  customerUid: string;
  userId: number;
  productUid: string;
  title?: string;
  folder?: string;
  status?: string;
  category?: string;
}) {
  const rows = await query<{ id: string }>(
    `SELECT id FROM products
      WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL) AND ${ACTIVE_PRODUCT_SQL}
      LIMIT 1`,
    [input.productUid, input.customerUid, input.userId],
  );
  if (!rows[0]) throw new Error("Product not found.");

  const json = (await readProductJson(input.customerUid, input.productUid)) || {};
  const patch: Record<string, unknown> = { ...json };

  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.folder !== undefined) {
    patch.folder = input.folder;
    patch.productFolder = input.folder;
    patch.publicFolder = input.folder;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.category !== undefined) patch.category = input.category;
  patch.updatedAt = new Date().toISOString();

  await updateProductJson({
    customerUid: input.customerUid,
    productUid: input.productUid,
    patch,
  });

  await query(
    `UPDATE products SET
       title = COALESCE(?, title),
       product_folder = COALESCE(?, product_folder),
       status = COALESCE(?, status),
       category = COALESCE(?, category),
       updated_at = NOW()
     WHERE id = ? AND customer_uid = ?`,
    [
      input.title?.trim() ?? null,
      input.folder ?? null,
      input.status ?? null,
      input.category ?? null,
      input.productUid,
      input.customerUid,
    ],
  );

  return { success: true };
}

export async function deleteProductsInFolder(input: {
  customerUid: string;
  userId: number;
  folder: string;
}) {
  if (!input.folder || input.folder === "All") {
    throw new Error("Cannot delete the All folder.");
  }

  const rows = await query<{ id: string }>(
    `SELECT id FROM products
      WHERE customer_uid = ? AND (user_id = ? OR user_id IS NULL)
        AND COALESCE(NULLIF(product_folder, ''), 'All') = ?
        AND ${ACTIVE_PRODUCT_SQL}`,
    [input.customerUid, input.userId, input.folder],
  );

  return rows.map((row) => row.id);
}
