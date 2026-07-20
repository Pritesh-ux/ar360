"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Paintbrush, Box, Search, RotateCw } from "lucide-react";
import { UserPageHeader, UserButton, UserInput } from "@/components/user-panel";
import { motion } from "framer-motion";

type Product = {
  id: string;
  title: string;
  category: string;
  folder: string;
  thumbnailUrl: string;
  poster: string;
  modelUrl: string;
  status: string;
  views: number;
  updatedAt: string;
};

type ProductsResponse = {
  success: boolean;
  products: Product[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function MaterialsPageClient() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const fetchProducts = useCallback(async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ pageSize: "24", sort: "newest" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      const data: ProductsResponse = await res.json();
      if (!res.ok || !data.success) throw new Error("Failed to load products");
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search);
    fetchProducts(search);
  }

  function openMaterials(productId: string) {
    router.push(`/dashboard/products/${productId}?tab=materials`);
  }

  const thumbnail = (p: Product) => p.poster || p.thumbnailUrl || "";

  return (
    <div className="flex flex-col gap-3">
      <UserPageHeader
        title="Materials Editor"
        subtitle="Select a product to configure its materials, textures, and surface finishes."
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-[10px] border border-[#ECECEC] bg-white py-2 pl-8 pr-3 text-sm font-medium text-[#111111] outline-none placeholder:text-[#A3A3A3] focus:border-[#84D400] focus:ring-2 focus:ring-[#84D400]/20 transition"
          />
        </div>
        <UserButton type="submit" variant="secondary" className="h-8 px-3 text-xs">Search</UserButton>
        {query && (
          <UserButton
            type="button"
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => { setSearch(""); setQuery(""); fetchProducts(""); }}
          >
            Clear
          </UserButton>
        )}
      </form>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[16px] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="h-[100px] w-full animate-pulse rounded-[10px] bg-[#F0F0F0]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-[#F0F0F0]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#F0F0F0]" />
              <div className="h-8 w-full animate-pulse rounded-[8px] bg-[#F0F0F0]" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-red-100 bg-red-50 py-12 text-center">
          <p className="text-sm font-semibold text-red-600">{error}</p>
          <UserButton variant="secondary" className="h-8 px-3 text-xs" onClick={() => fetchProducts(query)}>
            <RotateCw size={14} className="mr-1.5" /> Retry
          </UserButton>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-[#ECECEC] bg-white py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F7FEE7]">
            <Paintbrush size={22} className="text-[#84D400]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111111]">No products found</p>
            <p className="mt-1 text-xs font-medium text-[#737373]">
              {query ? "Try a different search term." : "Upload a product first to configure its materials."}
            </p>
          </div>
          {!query && (
            <UserButton onClick={() => router.push("/dashboard/products/new")}>
              Upload Product
            </UserButton>
          )}
        </div>
      )}

      {/* Product grid */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((product, i) => (
            <motion.article
              key={product.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.03 }}
              whileHover={{ y: -2 }}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
              onClick={() => openMaterials(product.id)}
            >
              {/* Thumbnail */}
              <div className="relative h-[100px] shrink-0 bg-[#FAFAFA]">
                {thumbnail(product) ? (
                  <img
                    src={thumbnail(product)}
                    alt={product.title}
                    className="h-full w-full object-contain p-2"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <Box size={28} className="text-[#D4D4D4]" />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 grid place-items-center rounded-t-[16px] bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center gap-1.5 rounded-[8px] bg-[#84D400] px-3 py-1.5 text-[11px] font-bold text-[#102000]">
                    <Paintbrush size={12} />
                    Edit Materials
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-2 p-2.5">
                <div>
                  <h3 className="truncate text-[12px] font-semibold text-[#111111]">{product.title}</h3>
                  <p className="truncate text-[10px] font-medium text-[#737373]">{product.category || "Uncategorized"}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openMaterials(product.id); }}
                  className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#ECECEC] bg-white py-1.5 text-[11px] font-semibold text-[#111111] transition hover:border-[#84D400] hover:bg-[#F7FEE7] hover:text-[#84D400]"
                >
                  <Paintbrush size={11} />
                  Configure
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
