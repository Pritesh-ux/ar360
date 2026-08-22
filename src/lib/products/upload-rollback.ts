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
  // Match /api/assets multi-root locate — single-root getSecureProductPath
  // missed GLBs that lived on legacy public/Storage while writes used storage/.
  const { locateProductAssetDiskPath } = await import("@/lib/storage/locate-asset");
  const located = await locateProductAssetDiskPath(customerUid, productUid, "model.glb");
  return Boolean(located);
}
