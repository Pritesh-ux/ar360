export type LocalProduct = {
  id: string;
  productUid?: string;
  customerUid?: string;
  title: string;
  category?: string;
  folder?: string;
  modelUrl?: string;
  fileName?: string;
  usdzUrl?: string;
  usdzFileName?: string;
  poster?: string;
  thumbnailUrl?: string;
  qrUrl?: string;
  productFolder?: string;
  publicFolder?: string;
  views?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  variants?: { id: string; name: string }[];
  materialSettings?: Record<number, unknown>;
  hotspots?: { id: string; title: string; description: string; position: string }[];
};

export const LOCAL_PRODUCTS_KEY = "ar_products";
export const LOCAL_FOLDERS_KEY = "ar_folders";
export const LOCAL_CUSTOMER_UID_KEY = "ar360_customer_uid";

/** localStorage product cache is dev-only unless explicitly enabled. */
export function isLocalProductCacheEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_LOCAL_PRODUCT_CACHE === "true") return true;
  return process.env.NODE_ENV === "development";
}

export function getCustomerProductsKey(customerUid?: string | null) {
  const uid = customerUid || getCurrentCustomerUid();
  return uid ? `${LOCAL_PRODUCTS_KEY}_${uid}` : LOCAL_PRODUCTS_KEY;
}

export function getCustomerFoldersKey(customerUid?: string | null) {
  const uid = customerUid || getCurrentCustomerUid();
  return uid ? `${LOCAL_FOLDERS_KEY}_${uid}` : LOCAL_FOLDERS_KEY;
}

export function getCurrentCustomerUid() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LOCAL_CUSTOMER_UID_KEY) || "";
}

export function setCurrentCustomerUid(customerUid: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_CUSTOMER_UID_KEY, customerUid);
}

export function safeParseProducts(value: string | null): LocalProduct[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLocalProducts({ customerUid }: { customerUid?: string | null } = {}): LocalProduct[] {
  if (typeof window === "undefined" || !isLocalProductCacheEnabled()) return [];
  const uid = customerUid || getCurrentCustomerUid();

  if (uid) {
    const scoped = safeParseProducts(localStorage.getItem(getCustomerProductsKey(uid)));
    const scopedForCustomer = scoped.filter(
      (product) => !product.customerUid || product.customerUid === uid,
    );
    if (scopedForCustomer.length > 0) {
      return scopedForCustomer;
    }
  }

  const seen = new Map<string, LocalProduct>();

  function absorb(raw: string | null) {
    for (const p of safeParseProducts(raw)) {
      const key = p.id || p.productUid || "";
      if (key && !seen.has(key)) seen.set(key, p);
    }
  }

  absorb(localStorage.getItem(LOCAL_PRODUCTS_KEY));

  const all = Array.from(seen.values());

  const result = uid
    ? all.filter((p) => !p.customerUid || p.customerUid === uid)
    : all;

  if (process.env.NODE_ENV === "development") {
    console.log("[getLocalProducts] uid:", uid, "total:", result.length);
  }

  return result;
}

export function saveLocalProducts(products: LocalProduct[], { customerUid }: { customerUid?: string | null } = {}) {
  if (typeof window === "undefined" || !isLocalProductCacheEnabled()) return;
  const uid = customerUid || getCurrentCustomerUid();
  const next = uid
    ? products.map((product) => ({ ...product, customerUid: product.customerUid || uid }))
    : products;

  localStorage.setItem(getCustomerProductsKey(uid), JSON.stringify(next));

  if (uid) {
    const global = safeParseProducts(localStorage.getItem(LOCAL_PRODUCTS_KEY));
    const rest = global.filter((product) => product.customerUid !== uid);
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify([...rest, ...next]));
  } else {
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(next));
  }
}

export function getProductById(id: string, { customerUid }: { customerUid?: string | null } = {}) {
  if (typeof window === "undefined" || !isLocalProductCacheEnabled()) return null;
  const uid = customerUid || getCurrentCustomerUid();
  const products = safeParseProducts(localStorage.getItem(getCustomerProductsKey(uid)));
  const found = products.find((p) => p.id === id || p.productUid === id) || null;

  if (found) return found as LocalProduct;

  // fallback to global key
  const global = safeParseProducts(localStorage.getItem(LOCAL_PRODUCTS_KEY));
  return (global.find((p) => p.id === id || p.productUid === id) as LocalProduct) || null;
}

export function upsertLocalProduct(product: LocalProduct) {
  if (typeof window === "undefined" || !isLocalProductCacheEnabled()) return;
  const customerUid = product.customerUid || getCurrentCustomerUid();
  const key = getCustomerProductsKey(customerUid || undefined);

  const current = safeParseProducts(localStorage.getItem(key));
  const now = new Date().toISOString();
  const nextProduct: LocalProduct = { ...(product as LocalProduct), updatedAt: product.updatedAt || now, customerUid: product.customerUid || customerUid };

  const idx = current.findIndex((p) => p.id === nextProduct.id || p.productUid === nextProduct.productUid);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...nextProduct };
  } else {
    current.unshift(nextProduct);
  }

  localStorage.setItem(key, JSON.stringify(current));
  console.log("[upsertLocalProduct] Saved to key:", key, "product id:", nextProduct.id, "customerUid:", customerUid, "total in key:", current.length);

  const global = safeParseProducts(localStorage.getItem(LOCAL_PRODUCTS_KEY));
  const rest = customerUid
    ? global.filter((item) => item.customerUid !== customerUid)
    : global.filter((item) => item.id !== nextProduct.id && item.productUid !== nextProduct.productUid);
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify([...rest, ...current]));
  console.log("[upsertLocalProduct] Synced global key, total in global:", rest.length + current.length);
  
  // Notify same-window listeners that products changed
  try {
    if (typeof window !== "undefined") {
      const ev = new CustomEvent("ar_products_updated", { detail: { id: nextProduct.id } });
      window.dispatchEvent(ev);
      console.log("[upsertLocalProduct] Dispatched custom event ar_products_updated for product:", nextProduct.id);
    }
  } catch (e) {
    // no-op
  }
}

export function updateLocalProduct(id: string, patch: Partial<LocalProduct>) {
  const existing = getProductById(id);
  if (!existing) return;
  const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() } as LocalProduct;
  upsertLocalProduct(merged);
}

export function clearLegacyProductCacheForFreshCustomer(customerUid: string) {
  if (typeof window === "undefined" || !customerUid) return;
  const marker = `ar360_cache_ready_${customerUid}`;
  if (localStorage.getItem(marker) === "1") return;

  // Keep legacy cache for safety, but never read it for a scoped customer again.
  localStorage.setItem(marker, "1");
}
