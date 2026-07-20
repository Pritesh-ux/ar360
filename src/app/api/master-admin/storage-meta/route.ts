/**
 * GET /api/master-admin/storage-meta?customerUid=CUS_xxx&productUid=PRD_xxx
 *
 * SECURITY: Master Admin read-only file metadata endpoint.
 *
 * - Requires a valid master admin session with `storage.read` permission.
 * - Returns only file names, sizes and modification times.
 * - Never returns file contents or absolute disk paths.
 * - Admin cannot write, rename or delete customer files through this API.
 * - customerUid and productUid are validated through getSecureProductFolder()
 *   before any filesystem access — path traversal is impossible.
 */

import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import {
  getProductFileMeta,
  getCustomerStorageSummary,
  StorageSecurityError,
} from "@/lib/storage";

type ProductRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  // SECURITY: Only master admins may access file metadata
  const auth = await guardAdminPermission("storage.read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const customerUid = searchParams.get("customerUid") ?? "";
  const productUid = searchParams.get("productUid") ?? "";

  if (!customerUid) {
    return NextResponse.json({ error: "customerUid is required" }, { status: 400 });
  }

  try {
    await ensureAppSchema();

    if (productUid) {
      // ── Single product file metadata ──────────────────────────────────────
      // SECURITY: getProductFileMeta validates both UIDs through
      // getSecureProductFolder() before touching the filesystem.
      const files = await getProductFileMeta(customerUid, productUid);

      // Fetch product title from DB for context
      const rows = await query<ProductRow>(
        "SELECT id, title, status, created_at FROM products WHERE id = ? AND customer_uid = ? LIMIT 1",
        [productUid, customerUid],
      ).catch(() => [] as ProductRow[]);

      return NextResponse.json({
        customerUid,
        productUid,
        product: rows[0] ?? null,
        // SECURITY: Only metadata returned — no file contents, no disk paths
        files,
      });
    }

    // ── Customer-level storage summary ────────────────────────────────────────
    // SECURITY: getCustomerStorageSummary validates customerUid and returns
    // aggregate numbers only — no file contents, no absolute paths.
    const summary = await getCustomerStorageSummary(customerUid);

    // Enrich with product titles from DB
    const productUids = summary.products.map((p) => p.productUid);
    let productTitles: Record<string, string> = {};

    if (productUids.length > 0) {
      const placeholders = productUids.map(() => "?").join(",");
      const rows = await query<{ id: string; title: string }>(
        `SELECT id, title FROM products WHERE id IN (${placeholders}) AND customer_uid = ?`,
        [...productUids, customerUid],
      ).catch(() => [] as { id: string; title: string }[]);
      productTitles = Object.fromEntries(rows.map((r) => [r.id, r.title]));
    }

    return NextResponse.json({
      customerUid,
      totalFiles: summary.totalFiles,
      totalMB: summary.totalMB,
      products: summary.products.map((p) => ({
        productUid: p.productUid,
        title: productTitles[p.productUid] ?? p.productUid,
        files: p.files,
        sizeMB: Number((p.bytes / (1024 * 1024)).toFixed(2)),
      })),
    });
  } catch (error) {
    if (error instanceof StorageSecurityError) {
      // SECURITY: Log the real error server-side, return generic message to client
      console.error("[storage-meta] SECURITY:", error.message);
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    console.error("[storage-meta]", error);
    return NextResponse.json({ error: "Failed to read storage metadata." }, { status: 500 });
  }
}
