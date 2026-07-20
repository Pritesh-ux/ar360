export function normalizePublicStoragePath(value?: string | null) {
  if (!value) return "";

  let path = String(value).trim().replaceAll("\\\\", "/");

  if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      return path;
    }
  }

  const storageIndex = path.toLowerCase().indexOf("/storage/");
  if (storageIndex >= 0) path = path.slice(storageIndex);

  const windowsStorageIndex = path.toLowerCase().indexOf("storage/");
  if (!path.startsWith("/") && windowsStorageIndex >= 0) path = `/${path.slice(windowsStorageIndex)}`;

  if (path.startsWith("public/")) path = path.slice("public".length);
  if (!path.startsWith("/") && path.includes("Storage/")) path = `/${path}`;

  return collapsePathSegments(path);
}

function collapsePathSegments(pathStr: string) {
  const parts = pathStr.split("/").filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.length ? `/${stack.join("/")}` : "";
}

export function getProductPublicFolder(customerUid: string, productUid: string) {
  return `/Storage/Customers/${customerUid}/Products/${productUid}`;
}

export function normalizeProductAssetPaths<T extends Record<string, any>>(product: T): T {
  const productUid = product.productUid || product.id;
  const customerUid = product.customerUid;
  const publicFolder = product.publicFolder
    ? normalizePublicStoragePath(product.publicFolder)
    : customerUid && productUid
      ? getProductPublicFolder(customerUid, productUid)
      : "";

  const normalized: Record<string, any> = {
    ...product,
    id: product.id || productUid,
    productUid,
    publicFolder,
  };

  if (publicFolder) {
    normalized.modelUrl = normalizePublicStoragePath(product.modelUrl) || `${publicFolder}/model.glb`;
    normalized.poster = normalizePublicStoragePath(product.poster) || `${publicFolder}/poster.png`;
    normalized.thumbnailUrl = normalizePublicStoragePath(product.thumbnailUrl) || `${publicFolder}/thumbnail.png`;
    normalized.qrUrl = normalizePublicStoragePath(product.qrUrl) || `${publicFolder}/qr.png`;
  } else {
    normalized.modelUrl = normalizePublicStoragePath(product.modelUrl);
    normalized.poster = normalizePublicStoragePath(product.poster);
    normalized.thumbnailUrl = normalizePublicStoragePath(product.thumbnailUrl);
    normalized.qrUrl = normalizePublicStoragePath(product.qrUrl);
  }

  if (Array.isArray(product.variants)) {
    normalized.variants = product.variants.map((variant: Record<string, any>) => ({
      ...variant,
      poster: normalizePublicStoragePath(variant.poster) || normalized.poster,
    }));
  }

  return normalized as T;
}
