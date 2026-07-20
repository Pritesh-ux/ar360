import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { resolveStorageRoot } from "@/lib/storage/paths";
import { auditProductJsonFile } from "@/lib/storage/product-json-repair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectProductJsonFiles() {
  const root = resolveStorageRoot();
  const files: string[] = [];
  if (!(await exists(root))) return files;

  const customers = await fs.readdir(root, { withFileTypes: true });
  for (const customer of customers) {
    if (!customer.isDirectory()) continue;
    const productsDir = path.join(root, customer.name, "Products");
    if (!(await exists(productsDir))) continue;

    const products = await fs.readdir(productsDir, { withFileTypes: true });
    for (const product of products) {
      if (!product.isDirectory()) continue;
      const productJsonPath = path.join(productsDir, product.name, "product.json");
      if (await exists(productJsonPath)) files.push(productJsonPath);
    }
  }
  return files;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const write = searchParams.get("write") === "1";
  const auth = await guardAdminPermission(write ? "storage.cleanup" : "storage.read");
  if (auth instanceof NextResponse) return auth;
  const files = await collectProductJsonFiles();
  const items = [];

  for (const file of files) {
    try {
      items.push(await auditProductJsonFile(file, write));
    } catch (error) {
      items.push({
        productJsonPath: file,
        customerUid: "unknown",
        productUid: "unknown",
        issues: [{ severity: "critical", field: "product.json", message: error instanceof Error ? error.message : "Invalid product.json" }],
      });
    }
  }

  const critical = items.reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity === "critical").length, 0);
  const warnings = items.reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity === "warning").length, 0);

  return NextResponse.json({ scanned: items.length, critical, warnings, write, items });
}
