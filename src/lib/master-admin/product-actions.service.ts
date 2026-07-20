import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { deleteProductFolder, getSecureProductFolder, recalculateCustomerStorage } from "@/lib/storage";

export async function transferProductOwner(productId: string, newCustomerUid: string) {
  const rows = await query<{ id: string; customer_uid: string | null }>(
    "SELECT id, customer_uid FROM products WHERE id = ? LIMIT 1",
    [productId],
  );
  const product = rows[0];
  if (!product) throw new Error("Product not found.");

  const oldCustomerUid = product.customer_uid || "";
  if (oldCustomerUid === newCustomerUid) {
    throw new Error("Product already belongs to this customer.");
  }

  const targetRows = await query<{ customer_uid: string; status: string }>(
    "SELECT customer_uid, status FROM customers WHERE customer_uid = ? LIMIT 1",
    [newCustomerUid],
  );
  const target = targetRows[0];
  if (!target || target.status === "Deleted") {
    throw new Error("Target customer not found.");
  }

  if (oldCustomerUid) {
    const oldFolder = getSecureProductFolder(oldCustomerUid, productId);
    const newFolder = getSecureProductFolder(newCustomerUid, productId);
    try {
      await fs.access(oldFolder);
      await fs.mkdir(path.dirname(newFolder), { recursive: true });
      try {
        await fs.rename(oldFolder, newFolder);
      } catch {
        // Destination may already exist — leave files if move fails.
      }
    } catch {
      // Source folder missing — DB transfer still proceeds.
    }
  }

  await query("UPDATE products SET customer_uid = ?, updated_at = NOW() WHERE id = ?", [
    newCustomerUid,
    productId,
  ]);

  if (oldCustomerUid) {
    await recalculateCustomerStorage(oldCustomerUid).catch(() => {});
  }
  await recalculateCustomerStorage(newCustomerUid).catch(() => {});

  return { productId, fromCustomerUid: oldCustomerUid, toCustomerUid: newCustomerUid };
}

export async function adminDeleteProduct(productId: string) {
  const rows = await query<{ id: string; customer_uid: string | null }>(
    "SELECT id, customer_uid FROM products WHERE id = ? LIMIT 1",
    [productId],
  );
  const product = rows[0];
  if (!product) throw new Error("Product not found.");

  const customerUid = product.customer_uid || "";
  await query("DELETE FROM products WHERE id = ?", [productId]);

  if (customerUid) {
    await deleteProductFolder(customerUid, productId).catch(() => {});
    await recalculateCustomerStorage(customerUid).catch(() => {});
  }

  return { productId, customerUid };
}
