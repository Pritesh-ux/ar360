import fs from "fs/promises";
import { query } from "@/lib/db";
import { deleteProductFolder } from "@/lib/storage";

export async function rollbackProductUpload(customerUid: string, productUid: string) {
  await deleteProductFolder(customerUid, productUid).catch(() => undefined);
  await query("DELETE FROM products WHERE id = ? AND customer_uid = ?", [productUid, customerUid]).catch(
    () => undefined,
  );
  await query(
    "DELETE FROM product_assets WHERE product_uid = ? AND customer_uid = ?",
    [productUid, customerUid],
  ).catch(() => undefined);
}

export async function productFolderHasGlb(customerUid: string, productUid: string) {
  const { getSecureProductPath } = await import("@/lib/storage");
  try {
    const diskPath = getSecureProductPath(customerUid, productUid, "model.glb");
    await fs.access(diskPath);
    return true;
  } catch {
    return false;
  }
}
