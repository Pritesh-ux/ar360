"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { Box, Code2, Globe, Palette, Plus, Smartphone, Unlink } from "lucide-react";
import {
  ProductCard,
  ProductGrid,
} from "@/components/user-panel/products";
import type { ProductListItem } from "@/components/user-panel/products/types";
import { normalizeProductStatus } from "@/components/user-panel/products/types";
import {
  UserActionMenuPanel,
  renderUserActionMenuItems,
} from "@/components/user-panel/UserActionMenu";
import { productHubLinks } from "@/lib/user-panel/product-hub-links";

export type ClientLinkedProductRow = {
  product_uid: string;
  name: string;
  category?: string | null;
  status?: string | null;
  created_at?: string;
  poster?: string | null;
  thumbnail_url?: string | null;
  file_name?: string | null;
  views?: number | null;
  product_folder?: string | null;
};

function toListItem(row: ClientLinkedProductRow): ProductListItem {
  return {
    id: row.product_uid,
    title: row.name || "Untitled",
    category: row.category || undefined,
    poster: row.poster || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    status: normalizeProductStatus(row.status),
    views: Number(row.views || 0),
    folder: row.product_folder || undefined,
    productFolder: row.product_folder || undefined,
  };
}

export default function ClientLinkedProductsGrid({
  products,
  qrRecordByProductId = {},
  onLinkProduct,
  onUnlink,
  className = "",
}: {
  products: ClientLinkedProductRow[];
  qrRecordByProductId?: Record<string, number>;
  onLinkProduct: () => void;
  onUnlink: (productId: string) => void | Promise<void>;
  className?: string;
}) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const listItems = useMemo(() => products.map(toListItem), [products]);

  function openEditor(id: string) {
    router.push(`/dashboard/products/${encodeURIComponent(id)}`);
  }

  function toggleMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === id ? null : id));
  }

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm ${className}`}
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] xl:min-h-[min(720px,calc(100dvh-320px))]">
        <aside className="hidden min-h-0 flex-col border-[#ECECEC] xl:flex xl:border-r">
          <div className="flex h-14 shrink-0 items-center border-b border-[#ECECEC] px-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#525252]">
              Workspace
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="rounded-[16px] border border-[#DDE1E6] bg-[#F4F4F5] p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#EEF9E0] text-[#5FA800]">
                  <Box size={16} />
                </span>
                Client library
              </div>
              <dl className="mt-3 space-y-2 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-[#737373]">Assigned</dt>
                  <dd className="font-bold text-[#111111]">{listItems.length}</dd>
                </div>
                <p className="pt-1 text-[11px] leading-relaxed font-medium text-[#737373]">
                  Cards match the main Products page. Assigned items are hidden from your global
                  library. QR, Share, Embed, AR, branding &amp; domains — all from the card actions.
                </p>
              </dl>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#ECECEC] px-4 py-3">
            <span
              aria-hidden
              className="up-select-check grid shrink-0 place-items-center rounded-full border border-[#C8CDD4] bg-white opacity-40"
            />
            <p className="text-[13px] font-semibold text-[#525252]">
              {listItems.length} product{listItems.length === 1 ? "" : "s"}
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLinkProduct}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-[#84D400] px-4 text-xs font-black text-[#102000] hover:bg-[#78C400]"
              >
                <Plus size={14} /> Assign product
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
            {listItems.length === 0 ? (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#ECECEC] bg-[#FAFAFA] px-6 py-14 text-center">
                <p className="text-sm font-semibold text-[#111111]">No products assigned yet</p>
                <p className="mt-2 max-w-md text-xs font-medium text-[#737373]">
                  Assign from Products → Assign to Client, or use the button above. Assigned products
                  are hidden from the main Products page.
                </p>
                <button
                  type="button"
                  onClick={onLinkProduct}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-xs font-black text-[#102000]"
                >
                  <Plus size={14} /> Assign product
                </button>
              </div>
            ) : (
              <ProductGrid viewMode="grid">
            {listItems.map((product) => {
              const hub = productHubLinks({
                productId: product.id,
                productTitle: product.title,
                qrRecordId: qrRecordByProductId[product.id],
              });
              return (
              <div key={product.id} className="min-w-0 max-w-full">
                    <ProductCard
                      product={product}
                      selected={false}
                      qrRecordId={qrRecordByProductId[product.id]}
                      menuOpen={openMenuId === product.id}
                      menu={
                        openMenuId === product.id ? (
                          <UserActionMenuPanel className="up-product-menu z-[30]">
                            {renderUserActionMenuItems([
                              {
                                label: "Embed",
                                icon: <Code2 />,
                                onClick: () => router.push(hub.embed),
                              },
                              {
                                label: "AR preview",
                                icon: <Smartphone />,
                                onClick: () => window.open(hub.ar, "_blank", "noopener,noreferrer"),
                              },
                              {
                                label: "Branding",
                                icon: <Palette />,
                                onClick: () => router.push(hub.branding),
                              },
                              {
                                label: "Custom domains",
                                icon: <Globe />,
                                onClick: () => router.push(hub.domains),
                              },
                              {
                                label: "Remove from client",
                                icon: <Unlink />,
                                danger: true,
                                onClick: () => {
                                  setOpenMenuId(null);
                                  void onUnlink(product.id);
                                },
                              },
                            ])}
                          </UserActionMenuPanel>
                        ) : null
                      }
                      onSelect={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onOpen={openEditor}
                      onMore={toggleMenu}
                    />
              </div>
            );
            })}
              </ProductGrid>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
