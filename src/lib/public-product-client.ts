export type PublicProductResponse<T> = {
  product: T | null;
  error?: string;
  status?: number;
  source?: string;
};

export function findLocalProduct<T extends { id?: string; productUid?: string; publicId?: string; viewerSlug?: string }>(
  id: string,
  products: T[],
) {
  return (
    products.find((product) => {
      return (
        product.id === id ||
        product.productUid === id ||
        product.publicId === id ||
        product.viewerSlug === id
      );
    }) || null
  );
}

export async function fetchPublicProduct<T>(
  id: string,
  options?: { clientUid?: string | null },
): Promise<PublicProductResponse<T>> {
  try {
    const client = String(options?.clientUid || "").trim();
    const qs = client ? `?client=${encodeURIComponent(client)}` : "";
    const response = await fetch(`/api/public-products/${encodeURIComponent(id)}${qs}`, {
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        product: null,
        error: data.error || data.message || "Failed to load product.",
        status: response.status,
        source: data.source,
      };
    }

    return {
      product: (data.product || null) as T | null,
      status: response.status,
      source: data.source,
    };
  } catch {
    return { product: null, error: "Network error.", status: 0 };
  }
}
