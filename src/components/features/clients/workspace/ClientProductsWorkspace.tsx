"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, FilePenLine, Plus, Smartphone, Unlink, X } from "lucide-react";
import ProductCard from "@/components/user-panel/products/ProductCard";
import ProductGrid from "@/components/user-panel/products/ProductGrid";
import ProductsFilters from "@/components/user-panel/products/ProductsFilters";
import ProductsPagination from "@/components/user-panel/products/ProductsPagination";
import type { ProductListItem } from "@/components/user-panel/products/types";
import { normalizeProductStatus } from "@/components/user-panel/products/types";
import {
  UserActionMenuPanel,
  renderUserActionMenuItems,
} from "@/components/user-panel/UserActionMenu";
import { productHubLinks } from "@/lib/user-panel/product-hub-links";
import type {
  ClientWorkspaceClient,
  ClientWorkspaceProduct,
  ClientWorkspaceQr,
} from "@/lib/user-panel/client-workspace";
import { CLIENT_ACCENT } from "@/lib/user-panel/client-workspace";

type Props = {
  client: ClientWorkspaceClient;
  products: ClientWorkspaceProduct[];
  qrCodes: ClientWorkspaceQr[];
  onAssign: () => void;
  onUnlinkProduct: (productId: string) => void;
};

const SORT_OPTIONS = ["Newest", "Oldest", "Name A-Z", "Name Z-A"] as const;

function toProductListItem(product: ClientWorkspaceProduct): ProductListItem {
  return {
    id: product.product_uid,
    title: product.name,
    category: product.category ?? undefined,
    poster: product.poster ?? undefined,
    thumbnailUrl: product.thumbnail_url ?? undefined,
    status: product.status,
    views: product.views ?? undefined,
    productFolder: product.product_folder ?? undefined,
  };
}

export default function ClientProductsWorkspace({
  client,
  products,
  qrCodes,
  onAssign,
  onUnlinkProduct,
}: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("Newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameProduct, setRenameProduct] = useState<ClientWorkspaceProduct | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState("");

  const qrByProduct = useMemo(() => {
    const map = new Map<string, ClientWorkspaceQr>();
    for (const qr of qrCodes) {
      const pid = String(qr.product_id || "").trim();
      if (pid && !map.has(pid)) map.set(pid, qr);
    }
    return map;
  }, [qrCodes]);

  useEffect(() => {
    if (!menuId) return;

    function handleDocumentClick(event: MouseEvent | globalThis.MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-client-product-menu]")) return;
      setMenuId(null);
    }

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [menuId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const c = String(p.category || "").trim();
      if (c) set.add(c);
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filtered = useMemo(() => {
    let rows = [...products];

    if (statusFilter !== "All") {
      rows = rows.filter((p) => normalizeProductStatus(p.status) === statusFilter);
    }
    if (categoryFilter !== "All") {
      rows = rows.filter(
        (p) => String(p.category || "").trim().toLowerCase() === categoryFilter.toLowerCase(),
      );
    }

    rows.sort((a, b) => {
      if (sortBy === "Name A-Z") return a.name.localeCompare(b.name);
      if (sortBy === "Name Z-A") return b.name.localeCompare(a.name);
      if (sortBy === "Oldest") return +new Date(a.created_at) - +new Date(b.created_at);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });

    return rows;
  }, [products, statusFilter, categoryFilter, sortBy]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, total);
  const pageRows = filtered.slice(pageStart, pageEnd);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((p) => selectedIds.includes(p.product_uid));

  function openMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setMenuId((cur) => (cur === id ? null : id));
  }

  function toggleSelect(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleSelectAll() {
    const ids = pageRows.map((p) => p.product_uid);
    setSelectedIds((cur) => {
      const allSelected = ids.every((id) => cur.includes(id));
      if (allSelected) return cur.filter((id) => !ids.includes(id));
      return Array.from(new Set([...cur, ...ids]));
    });
  }

  async function unlinkSelected() {
    const ids = [...selectedIds];
    for (const id of ids) {
      await Promise.resolve(onUnlinkProduct(id));
    }
    setSelectedIds([]);
    setMenuId(null);
  }

  function openRename(product: ClientWorkspaceProduct) {
    setRenameProduct(product);
    setRenameValue(product.name);
    setRenameError("");
    setRenameBusy(false);
    setMenuId(null);
  }

  async function saveRename() {
    if (!renameProduct || renameBusy) return;
    const title = renameValue.trim();
    if (!title) {
      setRenameError("Product name required");
      return;
    }

    setRenameBusy(true);
    setRenameError("");
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(renameProduct.product_uid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Rename failed");
      setRenameProduct(null);
      setRenameValue("");
      router.refresh();
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Rename failed");
    } finally {
      setRenameBusy(false);
    }
  }

  return (
    <div className="dash-premium dash-products-shell flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[#737373]">
          {total} product{total === 1 ? "" : "s"} assigned to this client
        </p>
        <button
          type="button"
          onClick={onAssign}
          className="inline-flex h-10 items-center gap-1.5 rounded-2xl px-4 text-xs font-black text-[#102000]"
          style={{ backgroundColor: CLIENT_ACCENT }}
        >
          <Plus size={14} /> Assign product
        </button>
      </div>

      <ProductsFilters
        folder="All"
        status={statusFilter}
        category={categoryFilter}
        sortBy={sortBy}
        folders={["All"]}
        categories={categories}
        sortOptions={[...SORT_OPTIONS]}
        onFolderChange={() => undefined}
        onStatusChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onCategoryChange={(value) => {
          setCategoryFilter(value);
          setPage(1);
        }}
        onSortChange={(value) => {
          setSortBy(value as (typeof SORT_OPTIONS)[number]);
          setPage(1);
        }}
        statusCounts={{ all: products.length }}
      />

      <section
        className="up-fill-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-[#E2E4DC] bg-white"
        style={{ minHeight: "48dvh" }}
      >
        <div className="dash-products-panel-header dash-products-selection-bar flex items-center gap-3 border-b border-[#F0F0F0] px-4 py-2.5">
          <button
            type="button"
            onClick={toggleSelectAll}
            aria-label="Select all visible products"
            className={`up-select-check grid shrink-0 place-items-center rounded-full border bg-white ${
              allPageSelected ? "border-[#84D400] bg-[#EEF9E0]" : "border-[#C8CDD4]"
            }`}
          >
            {allPageSelected ? <Check size={11} strokeWidth={3} className="text-[#5FA800]" /> : null}
          </button>

          <p className="text-[13px] font-semibold text-[#525252]">{selectedIds.length} selected</p>

          <div className="ml-auto flex h-9 items-center gap-2">
            <ActionButton disabled={selectedIds.length === 0} onClick={() => void unlinkSelected()} danger>
              Remove
            </ActionButton>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2 pt-3 md:px-4 md:pt-4">
          {pageRows.length === 0 ? (
            <div className="grid min-h-[220px] flex-1 place-items-center rounded-[16px] border border-dashed border-[#E2E4DC] bg-[#FAFAFB] text-center">
              <div className="px-6 py-8">
                <p className="text-sm font-semibold text-[#111111]">No products found</p>
                <p className="mt-1 text-xs text-[#737373]">
                  {products.length === 0
                    ? "Assign products so this client can deliver Viewer, AR and QR."
                    : "Try a different status, category, or sort."}
                </p>
                {products.length === 0 ? (
                  <button
                    type="button"
                    onClick={onAssign}
                    className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-2xl px-4 text-xs font-black text-[#102000]"
                    style={{ backgroundColor: CLIENT_ACCENT }}
                  >
                    <Plus size={14} /> Assign product
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <ProductGrid viewMode="grid">
              {pageRows.map((product) => {
                const productId = product.product_uid;
                const qrRecordId = qrByProduct.get(productId)?.id ?? null;
                const hub = productHubLinks({
                  productId,
                  productTitle: product.name,
                  qrRecordId,
                  clientUid: client.client_uid,
                });
                const menuOpen = menuId === productId;

                return (
                  <ProductCard
                    key={productId}
                    product={toProductListItem(product)}
                    selected={selectedIds.includes(productId)}
                    menuOpen={menuOpen}
                    showSelect
                    clientUid={client.client_uid}
                    qrRecordId={qrRecordId}
                    onSelect={toggleSelect}
                    onOpen={() => router.push(hub.editor)}
                    onMore={(e) => openMenu(e, productId)}
                    menu={
                      menuOpen ? (
                        <div data-client-product-menu>
                          <Menu
                            product={product}
                            hub={hub}
                            onClose={() => setMenuId(null)}
                            onRename={() => openRename(product)}
                            onUnlink={() => {
                              setMenuId(null);
                              setSelectedIds((cur) => cur.filter((id) => id !== productId));
                              onUnlinkProduct(productId);
                            }}
                          />
                        </div>
                      ) : null
                    }
                  />
                );
              })}
            </ProductGrid>
          )}
        </div>

        {pageRows.length > 0 ? (
          <div className="border-t border-[#F0F0F0] bg-white px-4 py-2">
            <ProductsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              from={pageStart + 1}
              to={pageEnd}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </section>

      {renameProduct ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-[20px] border border-[#E2E4DC] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#111111]">Rename Product</h3>
                <p className="mt-1 text-xs text-[#737373]">
                  Update the product name for this client and the main products list.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenameProduct(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E4DC] text-[#525252]"
                aria-label="Close rename dialog"
              >
                <X size={16} />
              </button>
            </div>

            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-4 h-11 w-full rounded-xl border border-[#E2E4DC] px-4 text-sm font-medium text-[#111111] outline-none"
              autoFocus
              placeholder="Product name"
            />

            {renameError ? (
              <p className="mt-2 text-xs font-medium text-red-600">{renameError}</p>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setRenameProduct(null)}
                className="h-10 flex-1 rounded-2xl border border-[#E2E4DC] bg-white px-4 text-sm font-semibold text-[#525252]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveRename()}
                disabled={renameBusy}
                className="h-10 flex-1 rounded-2xl px-4 text-sm font-black text-[#102000] disabled:opacity-50"
                style={{ backgroundColor: CLIENT_ACCENT }}
              >
                {renameBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 rounded-2xl px-4 text-[13px] font-semibold disabled:opacity-40 ${
        danger
          ? "bg-red-50 text-red-600"
          : "border border-[#ECECEC] bg-white text-[#525252] hover:bg-[#FFFFFF]"
      }`}
    >
      {children}
    </button>
  );
}

function Menu({
  product,
  hub,
  onClose,
  onRename,
  onUnlink,
}: {
  product: ClientWorkspaceProduct;
  hub: ReturnType<typeof productHubLinks>;
  onClose: () => void;
  onRename: () => void;
  onUnlink: () => void;
}) {
  return (
    <UserActionMenuPanel className="w-44">
      {renderUserActionMenuItems([
        {
          label: "Rename",
          icon: <FilePenLine />,
          onClick: () => {
            onClose();
            onRename();
          },
        },
        {
          label: "Open viewer",
          icon: <Eye />,
          onClick: () => {
            onClose();
            window.open(hub.viewer, "_blank", "noopener,noreferrer");
          },
        },
        {
          label: "Preview AR",
          icon: <Smartphone />,
          onClick: () => {
            onClose();
            window.open(hub.ar, "_blank", "noopener,noreferrer");
          },
        },
        {
          label: "Remove from client",
          icon: <Unlink />,
          danger: true,
          onClick: onUnlink,
        },
      ])}
    </UserActionMenuPanel>
  );
}
