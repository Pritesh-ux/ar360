"use client";

import Link from "next/link";
import AppImage from "@/components/shared/AppImage";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Box,
  Check,
  Eye,
  FilePenLine,
  Folder,
  Layers,
  MoveRight,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import ViewportPortal from "@/components/shared/ViewportPortal";
import { useUserPanelToast } from "@/components/user-panel/UserPanelToastContext";
import UploadProductModal from "@/components/features/dashboard/UploadProductModal";
import UpgradeRequiredModal from "@/components/features/dashboard/UpgradeRequiredModal";
import "@/components/dashboard/dashboard-premium.css";
import {
  ProductCard as ProductCardUI,
  ProductGrid,
  ProductsEmptyState,
  ProductsFilters,
  ProductsFiltersSkeleton,
  ProductsPagination,
  ProductsSkeletonGrid,
  ProductsToolbar,
} from "@/components/user-panel/products";
import { MobileProductCard } from "@/components/user-panel/mobile";
import type { ProductSortKey } from "@/lib/user-panel/products.service";
import { useUserPanelSession } from "@/components/user-panel/UserPanelContext";
import UserActionMenu, {
  UserActionMenuPanel,
  renderUserActionMenuItems,
} from "@/components/user-panel/UserActionMenu";

type Product = {
  id: string;
  productUid?: string;
  customerUid?: string;
  title: string;
  category?: string;
  folder?: string;
  productFolder?: string;
  folderPath?: string;
  publicFolder?: string;
  destination?: string;
  modelUrl?: string;
  fileName?: string;
  poster?: string;
  thumbnailUrl?: string;
  views?: number;
  status?: string;
  variants?: { id: string; name: string; materialSettings?: Record<number, unknown> }[];
  activeVariantId?: string;
  materialSettings?: Record<number, unknown>;
  hotspots?: { id: string; title: string; description: string; position: string }[];
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_FOLDERS = ["All"];
const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [8, 12] as const;
const PAGE_SIZE_KEY = "ar360_products_page_size";
const VIEW_MODE_KEY = "ar360_products_view";

function parsePageSize(value: string | null | undefined) {
  const size = Number(value || DEFAULT_PAGE_SIZE);
  return PAGE_SIZE_OPTIONS.includes(size as (typeof PAGE_SIZE_OPTIONS)[number]) ? size : DEFAULT_PAGE_SIZE;
}

function readStoredPageSize() {
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
  try {
    const stored = localStorage.getItem(PAGE_SIZE_KEY);
    if (stored) return parsePageSize(stored);
  } catch {
    // ignore
  }
  return DEFAULT_PAGE_SIZE;
}

function resolvePageSize(searchParams: URLSearchParams) {
  const fromUrl = searchParams.get("pageSize");
  if (fromUrl) return parsePageSize(fromUrl);
  return readStoredPageSize();
}

const SORT_TO_API: Record<string, ProductSortKey> = {
  Newest: "newest",
  Oldest: "oldest",
  "Name A-Z": "name_asc",
  "Name Z-A": "name_desc",
  "Most Views": "views",
  Views: "views",
  "Recently Updated": "updated",
};

const API_TO_SORT: Record<ProductSortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name_asc: "Name A-Z",
  name_desc: "Name Z-A",
  views: "Most Views",
  updated: "Recently Updated",
};

function normalizeValue(value?: string | null, fallback = "") {
  const cleaned = String(value || "").trim();
  return cleaned || fallback;
}

function isStoragePathFolder(value?: string | null) {
  const folder = normalizeValue(value).replace(/\\/g, "/");
  if (!folder) return false;
  return (
    folder.startsWith("/Storage/")
    || folder.startsWith("Storage/")
    || /\/Storage\/Customers\//i.test(folder)
    || /\/Customers\/[^/]+\/Products\//i.test(folder)
  );
}

function normalizeFolderLabel(value?: string | null) {
  const folder = normalizeValue(value, "All");
  if (!folder || folder === "All" || isStoragePathFolder(folder)) return "All";
  return folder;
}

function normalizeStatus(value?: string | null) {
  const raw = normalizeValue(value, "published").toLowerCase();
  if (raw === "archived" || raw === "archive") return "Archived";
  if (raw === "processing") return "Processing";
  return "Saved";
}

function getProductFolder(product: Product) {
  return normalizeFolderLabel(product.folder || product.productFolder);
}

function getProductCategory(product: Product) {
  return normalizeValue(product.category, "Uncategorized");
}

function getProductStatus(product: Product) {
  return normalizeStatus(product.status);
}

function mergeFolderList(storedFolders: string[], extraFolders: string[]) {
  return Array.from(
    new Set([
      "All",
      ...storedFolders
        .map((folder) => normalizeFolderLabel(folder))
        .filter((folder) => folder !== "All"),
      ...extraFolders
        .map((folder) => normalizeFolderLabel(folder))
        .filter((folder) => folder !== "All"),
    ]),
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useUserPanelSession();
  const { showToast: pushToast } = useUserPanelToast();
  const canAssignToClient = Boolean(session?.addons?.clientManagement);

  const [products, setProducts] = useState<Product[]>([]);
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    from: 0,
    to: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const customerUidRef = useRef<string>("");
  const isMobileRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const search = searchParams.get("q") ?? "";
  const folderFilter = normalizeFolderLabel(searchParams.get("folder") ?? "All");
  const statusFilter = searchParams.get("status") ?? "All";
  const categoryFilter = searchParams.get("category") ?? "All";
  const sortBy =
    API_TO_SORT[(searchParams.get("sort") as ProductSortKey) || "newest"] || "Newest";
  const currentPage = Math.max(1, Number(searchParams.get("page") || "1"));
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const pageSizeHydratedRef = useRef(false);

  const [searchInput, setSearchInput] = useState(search);
  const [folderSearch, setFolderSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [checkingUploadAccess, setCheckingUploadAccess] = useState(false);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [renameProduct, setRenameProduct] = useState<Product | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveProductIds, setMoveProductIds] = useState<string[]>([]);
  const [moveTargetFolder, setMoveTargetFolder] = useState("All");

  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteBulkOpen, setDeleteBulkOpen] = useState(false);

  const [assignProduct, setAssignProduct] = useState<Product | null>(null);
  const [assignClients, setAssignClients] = useState<
    Array<{ client_uid: string; name: string; company_name: string | null; status: string }>
  >([]);
  const [assignClientUid, setAssignClientUid] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState("");

  const updateQuery = useCallback((updates: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "All" ||
        (key === "page" && Number(value) <= 1)
      ) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/dashboard/products", { scroll: false });
  }, [router, searchParams]);

  const fetchProducts = useCallback(async () => {
    const append = isMobileRef.current && currentPage > 1;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (folderFilter !== "All") params.set("folder", folderFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (categoryFilter !== "All") params.set("category", categoryFilter);
      params.set("sort", SORT_TO_API[sortBy] || "newest");
      params.set("page", String(currentPage));
      params.set("pageSize", String(pageSize));
      params.set("excludeClientLinked", "1");

      const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load products");

      const nextProducts: Product[] = data.products || [];
      setProducts((prev) => {
        if (!append || prev.length === 0) return nextProducts;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...nextProducts.filter((p) => !seen.has(p.id))];
      });
      setPagination(
        data.pagination || {
          page: currentPage,
          pageSize,
          total: data.products?.length || 0,
          totalPages: 1,
          from: data.products?.length ? 1 : 0,
          to: data.products?.length || 0,
        },
      );
      setCategories(data.facets?.categories || ["All"]);
      setFolders(mergeFolderList(customFolders, data.facets?.folders || DEFAULT_FOLDERS));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      if (!append) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, folderFilter, statusFilter, categoryFilter, sortBy, currentPage, pageSize, customFolders]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      isMobileRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useDeferredEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== search) {
        updateQuery({ q: searchInput.trim() || null, page: null });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, updateQuery]);

  useDeferredEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useDeferredEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "grid" || stored === "list") setViewMode(stored);
    } catch {
      // ignore
    }
  }, []);

  useDeferredEffect(() => {
    setPageSize(resolvePageSize(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (pageSizeHydratedRef.current) return;
    pageSizeHydratedRef.current = true;

    const resolved = resolvePageSize(searchParams);
    if (searchParams.get("pageSize")) return;

    updateQuery({ pageSize: resolved, page: null });
  }, [searchParams, updateQuery]);

  // Strip legacy disk paths from ?folder= so the UI never shows /Storage/...
  useEffect(() => {
    const raw = searchParams.get("folder");
    if (raw && isStoragePathFolder(raw)) {
      updateQuery({ folder: null, page: null });
    }
  }, [searchParams, updateQuery]);

  useEffect(() => {
    async function loadCustomerUid() {
      try {
        const res = await fetch("/api/customer/bootstrap", { cache: "no-store" });
        const data = await res.json();
        customerUidRef.current = data?.customer?.customerUid || data?.session?.user?.customerUid || "";
      } catch {
        // optional
      }
    }
    loadCustomerUid();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const closeMenu = () => setOpenMenuId(null);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-product-actions-menu]")) return;
      closeMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuId]);

  function showToast(type: "success" | "error" | "info", title: string, message?: string) {
    const text = message ? `${title} — ${message}` : title;
    pushToast(text, type === "error" ? "err" : type === "info" ? "info" : "ok");
  }

  function saveFolders(next: string[]) {
    const cleaned = Array.from(
      new Set([
        "All",
        ...next.map((f) => normalizeFolderLabel(f)).filter((f) => f && f !== "All"),
      ]),
    );
    setCustomFolders(cleaned.filter((folder) => folder !== "All"));
    setFolders(cleaned);
  }

  const categoryOptions = categories;

  async function openUploadModalWithEntitlement() {
    if (checkingUploadAccess) return;

    setCheckingUploadAccess(true);
    try {
      const res = await fetch("/api/billing/entitlement?action=upload_product", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const entitlement = data?.entitlement;

      if (res.ok && entitlement && !entitlement.allowed) {
        setUpgradeReason(
          entitlement.reason ||
            "Product limit reached on your current plan. Upgrade to continue uploading.",
        );
        setUpgradeModalOpen(true);
        return;
      }

      setUploadModalOpen(true);
    } catch (err) {
      console.warn("Failed to check upload entitlement", err);
      setUploadModalOpen(true);
    } finally {
      setCheckingUploadAccess(false);
    }
  }

  // Deep-link: /dashboard/products?upload=1 opens the same upload popup.
  const uploadDeepLinkHandled = useRef(false);
  useEffect(() => {
    if (searchParams.get("upload") !== "1") return;
    if (uploadDeepLinkHandled.current) return;
    uploadDeepLinkHandled.current = true;
    updateQuery({ upload: null });
    void openUploadModalWithEntitlement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const paginatedProducts = products;
  const totalPages = pagination.totalPages;
  const pageEnd = pagination.to;

  useDeferredEffect(() => {
    setSelectedIds([]);
  }, [folderFilter, statusFilter, categoryFilter, search, sortBy, currentPage, pageSize]);

  const visibleFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((folder) => folder.toLowerCase().includes(q));
  }, [folders, folderSearch]);

  function folderCount(folder: string) {
    if (folder === "All") return String(pagination.total);
    return String(products.filter((product) => getProductFolder(product) === folder).length);
  }

  function toggleSelect(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (paginatedProducts.length === 0) return;

    const pageIds = paginatedProducts.map((p) => p.id);
    const allPageSelected = pageIds.every((id) => selectedIds.includes(id));

    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }

  function goToPage(page: number) {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    if (nextPage === currentPage) return;
    updateQuery({ page: nextPage <= 1 ? null : nextPage });
    setSelectedIds([]);
  }

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!isMobileRef.current) return;
        if (!entries[0]?.isIntersecting) return;
        if (loading || loadingMore) return;
        if (currentPage >= totalPages) return;
        goToPage(currentPage + 1);
      },
      { root: null, rootMargin: "160px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading, loadingMore, currentPage, totalPages, products.length]);

  function changePageSize(nextPageSize: number) {
    const size = parsePageSize(String(nextPageSize));
    setPageSize(size);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(size));
    } catch {
      // ignore
    }
    updateQuery({
      pageSize: size,
      page: null,
    });
    setSelectedIds([]);
  }

  function createFolder() {
    const name = newFolderName.trim();

    if (!name) {
      showToast("error", "Folder name required");
      return;
    }

    if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
      showToast("error", "Folder already exists");
      return;
    }

    saveFolders([...folders, name]);
    setNewFolderName("");
    setCreateFolderOpen(false);
    showToast("success", "Folder Created", `${name} folder created.`);
  }

  async function confirmDeleteFolder() {
    if (!folderToDelete || folderToDelete === "All" || deletingBusy) return;

    setDeletingBusy(true);
    try {
      const ids: string[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const params = new URLSearchParams({
          folder: folderToDelete,
          pageSize: "50",
          page: String(page),
        });
        const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load folder products");
        for (const product of data.products || []) {
          if (product?.id) ids.push(String(product.id));
        }
        totalPages = Math.max(1, Number(data.pagination?.totalPages || 1));
        page += 1;
      }

      for (const id of ids) {
        await deleteProductById(id);
      }

      const nextFolders = folders.filter((f) => f !== folderToDelete);
      saveFolders(nextFolders);
      if (folderFilter === folderToDelete) updateQuery({ folder: null, page: null });
      setFolderToDelete(null);
      setSelectedIds([]);
      await fetchProducts();
      showToast("success", "Folder Deleted", "Folder and its products were deleted.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Folder delete failed");
    } finally {
      setDeletingBusy(false);
    }
  }

  function openRename(product: Product) {
    setRenameProduct(product);
    setRenameValue(product.title);
    setOpenMenuId(null);
  }

  async function saveRename() {
    if (!renameProduct) return;

    const name = renameValue.trim();
    if (!name) {
      showToast("error", "Product name required");
      return;
    }

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(renameProduct.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rename failed");
      setRenameProduct(null);
      setRenameValue("");
      showToast("success", "Product Renamed");
      await fetchProducts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function duplicateProduct(product: Product) {
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(product.id)}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      showToast("success", "Product Duplicated");
      await fetchProducts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Duplicate failed");
    }
  }

  function openMove(ids: string[]) {
    if (ids.length === 0) return;

    setMoveProductIds(ids);
    setMoveTargetFolder("All");
    setMoveModalOpen(true);
    setOpenMenuId(null);
  }

  async function openAssignToClient(product: Product) {
    if (!canAssignToClient) {
      showToast("error", "Client Management required", "Upgrade your plan or buy the Client Management add-on.");
      return;
    }
    setOpenMenuId(null);
    setAssignProduct(product);
    setAssignClientUid("");
    setAssignError("");
    setAssignClients([]);
    setAssignLoading(true);
    try {
      const res = await fetch("/api/clients?status=active", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setAssignError(body.error || "Client Management add-on is required.");
        return;
      }
      if (!res.ok) throw new Error(body.error || "Failed to load clients.");
      const list = Array.isArray(body.clients) ? body.clients : [];
      setAssignClients(list);
      if (!list.length) {
        setAssignError("No active clients yet. Create a client first.");
      }
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to load clients.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function confirmAssignToClient() {
    if (!assignProduct || !assignClientUid || assignBusy) return;
    setAssignBusy(true);
    const productTitle = assignProduct.title;
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(assignClientUid)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link",
          resourceType: "product",
          resourceId: assignProduct.id,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Assign failed.");
      const clientName =
        assignClients.find((c) => c.client_uid === assignClientUid)?.name || "client";
      setAssignProduct(null);
      showToast("success", "Assigned to Client", `${productTitle} linked to ${clientName}.`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Assign failed");
    } finally {
      setAssignBusy(false);
    }
  }

  async function saveMove() {
    try {
      await Promise.all(
        moveProductIds.map((id) =>
          fetch(`/api/products/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: moveTargetFolder }),
          }),
        ),
      );
      setMoveModalOpen(false);
      setSelectedIds([]);
      showToast("success", "Moved Successfully");
      await fetchProducts();
    } catch {
      showToast("error", "Move failed");
    }
  }

  async function deleteProductById(id: string) {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Delete failed");
    }
  }

  async function confirmDeleteProduct() {
    if (!deleteProduct || deletingBusy) return;

    setDeletingBusy(true);
    try {
      await deleteProductById(deleteProduct.id);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteProduct.id));
      setDeleteProduct(null);
      showToast("success", "Product Deleted");
      await fetchProducts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingBusy(false);
    }
  }

  async function confirmBulkDelete() {
    if (deletingBusy) return;
    const ids = [...selectedIds];
    setDeletingBusy(true);
    try {
      const failures: string[] = [];
      for (const id of ids) {
        try {
          await deleteProductById(id);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : id);
        }
      }
      setSelectedIds([]);
      setDeleteBulkOpen(false);
      if (failures.length === 0) {
        showToast("success", "Products Deleted");
      } else if (failures.length === ids.length) {
        showToast("error", failures[0] || "Bulk delete failed");
      } else {
        showToast(
          "info",
          "Partial delete",
          `${ids.length - failures.length} deleted, ${failures.length} could not be removed.`,
        );
      }
      await fetchProducts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setDeletingBusy(false);
    }
  }

  const allCurrentPageSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((product) => selectedIds.includes(product.id));
  const showingStart = pagination.from;

  return (
    <div className="dash-premium dash-products-shell animate-dash-fade-in flex min-h-[calc(100dvh-10.5rem)] flex-col gap-1.5 md:min-h-0 md:flex-1 md:gap-3">
      <ProductsToolbar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          localStorage.setItem(VIEW_MODE_KEY, mode);
        }}
        onUpload={openUploadModalWithEntitlement}
        uploading={checkingUploadAccess}
      />

      {loading && products.length === 0 ? (
        <ProductsFiltersSkeleton />
      ) : (
        <ProductsFilters
          folder={folderFilter}
          status={statusFilter}
          category={categoryFilter}
          sortBy={sortBy}
          folders={folders}
          categories={categoryOptions}
          sortOptions={["Newest", "Oldest", "Name A-Z", "Name Z-A", "Most Views", "Recently Updated"]}
          statusCounts={{
            all: pagination.total,
            published: undefined,
            drafts: undefined,
          }}
          onFolderChange={(value) => updateQuery({ folder: value === "All" ? null : value, page: null })}
          onStatusChange={(value) => updateQuery({ status: value === "All" ? null : value, page: null })}
          onCategoryChange={(value) => updateQuery({ category: value === "All" ? null : value, page: null })}
          onSortChange={(value) => updateQuery({ sort: SORT_TO_API[value] || "newest", page: null })}
        />
      )}

      <section
        className="up-fill-panel flex min-h-0 flex-1 flex-col overflow-hidden md:bg-white"
        style={{ minHeight: "55dvh" }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 flex-col border-[#ECECEC] xl:flex xl:border-r">
            <div className="dash-products-panel-header justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Folders</p>
              <button
                onClick={() => setCreateFolderOpen(true)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[rgba(182,255,56,0.15)] text-lg font-bold text-[#5FA800] transition hover:bg-[rgba(182,255,56,0.25)]"
                title="Create folder"
              >
                +
              </button>
            </div>

            <div className="border-b border-[#ECECEC] p-3">
              <div className="dash-products-search">
                <Search size={15} className="dash-products-search__icon" />
                <input
                  type="text"
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  placeholder="Search folders..."
                  className="dash-products-input dash-products-input--icon text-[13px]"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
              {visibleFolders.map((folder) => {
                const active = folderFilter === folder;

                return (
                  <button
                    key={folder}
                    onClick={() => updateQuery({ folder: folder === "All" ? null : folder, page: null })}
                    className={`group relative flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left transition ${
                      active ? "dash-products-folder-active text-[#111827]" : "text-[#525252] hover:bg-[#FAFAFB]"
                    }`}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#B6FF38]" />
                    ) : null}

                    <Folder size={18} className={active ? "text-[#5FA800]" : "text-[#737373]"} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {folder === "All" ? "All Folders" : folder}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-[#6B7280]">
                        {folderCount(folder)} product{folderCount(folder) === "1" ? "" : "s"}
                      </span>
                    </span>

                    {folder !== "All" ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderToDelete(folder);
                        }}
                        className="hidden h-7 w-7 place-items-center rounded-xl bg-red-50 text-red-500 group-hover:grid"
                      >
                        <Trash2 size={14} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mx-3 mb-3 shrink-0 rounded-[16px] border border-[#ECECEC] bg-[#FAFAFB] p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                <Box size={16} className="text-[#5FA800]" />
                Folder insights
              </div>

              <InfoRow label="Total folders" value={`${folders.length}`} />
              <InfoRow label="Total products" value={`${pagination.total}`} />
              <InfoRow label="Selected" value={`${selectedIds.length}`} />
            </div>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="dash-products-panel-header dash-products-selection-bar !hidden gap-3 md:!flex">
              <button
                onClick={toggleSelectAll}
                aria-label="Select all visible products"
                className={`up-select-check grid shrink-0 place-items-center rounded-full border bg-white ${
                  allCurrentPageSelected ? "border-[#84D400] bg-[#EEF9E0]" : "border-[#C8CDD4]"
                }`}
              >
                {allCurrentPageSelected ? <Check size={11} strokeWidth={3} className="text-[#5FA800]" /> : null}
              </button>

              <p className="text-[13px] font-semibold text-[#525252]">{selectedIds.length} selected</p>

              <div className="ml-auto flex h-9 items-center gap-2">
                <ActionButton disabled={selectedIds.length === 0} onClick={() => openMove(selectedIds)}>
                  Move
                </ActionButton>
                <ActionButton danger disabled={selectedIds.length === 0} onClick={() => setDeleteBulkOpen(true)}>
                  Delete
                </ActionButton>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-0 pb-1 pt-2 md:px-4 md:pb-2 md:pt-4">
              {loading && products.length === 0 ? (
                <ProductsSkeletonGrid count={pageSize} />
              ) : error && products.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center dash-premium-card px-6 text-center shadow-sm">
                  <div>
                    <p className="font-semibold text-red-600">{error}</p>
                    <button
                      type="button"
                      onClick={() => fetchProducts()}
                      className="dash-premium-btn-primary mt-4"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : paginatedProducts.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <ProductsEmptyState onUpload={openUploadModalWithEntitlement} uploading={checkingUploadAccess} />
                </div>
              ) : viewMode === "grid" ? (
                <ProductGrid viewMode="grid">
                  {paginatedProducts.map((product) => {
                    const menu =
                      openMenuId === product.id ? (
                        <ProductMenu
                          product={product}
                          canAssignToClient={canAssignToClient}
                          onRename={openRename}
                          onDuplicate={duplicateProduct}
                          onMove={(id) => openMove([id])}
                          onAssignToClient={openAssignToClient}
                          onDelete={(p) => {
                            setOpenMenuId(null);
                            setDeleteProduct(p);
                          }}
                        />
                      ) : null;
                    const cardProps = {
                      product,
                      selected: selectedIds.includes(product.id),
                      menuOpen: openMenuId === product.id,
                      menu,
                      onOpen: (id: string) => router.push(`/dashboard/products/${id}`),
                      onMore: (_e: MouseEvent, id: string) =>
                        setOpenMenuId(openMenuId === id ? null : id),
                    };
                    return (
                      <div key={product.id}>
                        <div className="md:hidden">
                          <MobileProductCard {...cardProps} />
                        </div>
                        <div className="hidden md:block">
                          <ProductCardUI {...cardProps} onSelect={toggleSelect} />
                        </div>
                      </div>
                    );
                  })}
                </ProductGrid>
              ) : (
                <ProductGrid viewMode="list">
                  {paginatedProducts.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      selected={selectedIds.includes(product.id)}
                      canAssignToClient={canAssignToClient}
                      onSelect={toggleSelect}
                      onDelete={(p) => {
                        setOpenMenuId(null);
                        setDeleteProduct(p);
                      }}
                      onRename={openRename}
                      onDuplicate={duplicateProduct}
                      onMove={(id) => openMove([id])}
                      onAssignToClient={openAssignToClient}
                    />
                  ))}
                </ProductGrid>
              )}

              {!loading && paginatedProducts.length > 0 && currentPage < totalPages ? (
                <div ref={loadMoreSentinelRef} className="h-8 md:hidden" aria-hidden />
              ) : null}
              {loadingMore ? (
                <p className="py-3 text-center text-[12px] font-medium text-[#737373] md:hidden">
                  Loading more…
                </p>
              ) : null}
            </div>

            {!loading && paginatedProducts.length > 0 ? (
              <div className="hidden border-t border-[#F0F0F0] bg-white px-4 py-2 md:block">
                <ProductsPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  from={showingStart}
                  to={pageEnd}
                  total={pagination.total}
                  pageSize={pageSize}
                  onPageChange={goToPage}
                  onPageSizeChange={changePageSize}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {uploadModalOpen && (
        <UploadProductModal
          onClose={() => {
            setUploadModalOpen(false);
            fetchProducts();
          }}
        />
      )}

      <UpgradeRequiredModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason={upgradeReason}
      />


      {createFolderOpen && (
        <Modal title="Create Folder" onClose={() => setCreateFolderOpen(false)}>
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className={MODAL_INPUT}
            autoFocus
          />

          <div className="mt-5 flex gap-3">
            <button onClick={() => setCreateFolderOpen(false)} className={MODAL_BTN_CANCEL}>
              Cancel
            </button>

            <button onClick={createFolder} className={MODAL_BTN_PRIMARY}>
              Create
            </button>
          </div>
        </Modal>
      )}

      {folderToDelete && (
        <Modal title="Delete Folder" onClose={() => { if (!deletingBusy) setFolderToDelete(null); }}>
          <p className="text-[14px] leading-relaxed text-[#525252]">
            You are deleting <b className="text-[#111111]">{folderToDelete}</b> folder. This will permanently
            delete <b className="text-[#111111]">{folderCount(folderToDelete)}</b> product(s) inside this folder.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={deletingBusy}
              onClick={() => setFolderToDelete(null)}
              className={MODAL_BTN_CANCEL}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={deletingBusy}
              onClick={() => void confirmDeleteFolder()}
              className={`${MODAL_BTN_DANGER} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {deletingBusy ? "Deleting…" : "Delete Forever"}
            </button>
          </div>
        </Modal>
      )}

      {renameProduct && (
        <Modal title="Rename Product" onClose={() => setRenameProduct(null)}>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className={MODAL_INPUT}
            autoFocus
          />

          <div className="mt-5 flex gap-3">
            <button onClick={() => setRenameProduct(null)} className={MODAL_BTN_CANCEL}>
              Cancel
            </button>

            <button onClick={saveRename} className={MODAL_BTN_PRIMARY}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {moveModalOpen && (
        <Modal title="Move Product" onClose={() => setMoveModalOpen(false)}>
          <select
            value={moveTargetFolder}
            onChange={(e) => setMoveTargetFolder(e.target.value)}
            className={MODAL_INPUT}
          >
            {folders.map((folder) => (
              <option key={folder}>{folder}</option>
            ))}
          </select>

          <div className="mt-5 flex gap-3">
            <button onClick={() => setMoveModalOpen(false)} className={MODAL_BTN_CANCEL}>
              Cancel
            </button>

            <button onClick={saveMove} className={MODAL_BTN_PRIMARY}>
              Move
            </button>
          </div>
        </Modal>
      )}

      {assignProduct && (
        <Modal title="Assign to Client" onClose={() => setAssignProduct(null)}>
          <p className="mb-3 text-[14px] leading-relaxed text-[#525252]">
            Link <b className="text-[#111111]">{assignProduct.title}</b> to a client workspace.
          </p>
          {assignLoading ? (
            <p className="py-6 text-center text-sm text-[#737373]">Loading clients…</p>
          ) : assignError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              <p>{assignError}</p>
              <Link
                href={
                  assignError.toLowerCase().includes("add-on") ||
                  assignError.toLowerCase().includes("module")
                    ? "/dashboard/subscription"
                    : "/dashboard/clients"
                }
                className="mt-3 inline-flex h-10 items-center rounded-xl bg-[#84D400] px-4 text-xs font-black text-[#102000]"
              >
                {assignError.toLowerCase().includes("add-on") ||
                assignError.toLowerCase().includes("module")
                  ? "View add-ons"
                  : "Open Clients"}
              </Link>
            </div>
          ) : (
            <select
              value={assignClientUid}
              onChange={(e) => setAssignClientUid(e.target.value)}
              className={MODAL_INPUT}
            >
              <option value="">Select client…</option>
              {assignClients.map((client) => (
                <option key={client.client_uid} value={client.client_uid}>
                  {client.name}
                  {client.company_name ? ` · ${client.company_name}` : ""}
                </option>
              ))}
            </select>
          )}
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={() => setAssignProduct(null)} className={MODAL_BTN_CANCEL}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!assignClientUid || assignBusy || Boolean(assignError)}
              onClick={() => void confirmAssignToClient()}
              className={`${MODAL_BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {assignBusy ? "Assigning…" : "Assign"}
            </button>
          </div>
        </Modal>
      )}

      {deleteProduct && (
        <Modal title="Delete Product" onClose={() => { if (!deletingBusy) setDeleteProduct(null); }}>
          <p className="text-[14px] leading-relaxed text-[#525252]">
            This product will be permanently deleted. This action cannot be undone.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={deletingBusy}
              onClick={() => setDeleteProduct(null)}
              className={MODAL_BTN_CANCEL}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={deletingBusy}
              onClick={() => void confirmDeleteProduct()}
              className={`${MODAL_BTN_DANGER} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {deletingBusy ? "Deleting…" : "Delete Forever"}
            </button>
          </div>
        </Modal>
      )}

      {deleteBulkOpen && (
        <Modal title="Delete Selected Products" onClose={() => { if (!deletingBusy) setDeleteBulkOpen(false); }}>
          <p className="text-[14px] leading-relaxed text-[#525252]">
            You are deleting <b className="text-[#111111]">{selectedIds.length}</b> selected product(s). This
            action cannot be undone.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={deletingBusy}
              onClick={() => setDeleteBulkOpen(false)}
              className={MODAL_BTN_CANCEL}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={deletingBusy}
              onClick={() => void confirmBulkDelete()}
              className={`${MODAL_BTN_DANGER} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {deletingBusy ? "Deleting…" : "Delete Forever"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const MODAL_INPUT =
  "h-12 w-full rounded-2xl border border-[#C8CDD4] bg-white px-4 text-[14px] text-[#111111] outline-none transition focus:border-[#84D400] focus:ring-2 focus:ring-[#84D400]/20";
const MODAL_BTN_CANCEL =
  "h-11 flex-1 rounded-2xl border border-[#ECECEC] bg-white text-[14px] font-semibold text-[#525252] transition hover:bg-[#FFFFFF]";
const MODAL_BTN_PRIMARY =
  "h-11 flex-1 rounded-2xl bg-[#B6FF38] text-[14px] font-semibold text-[#102000] transition hover:bg-[#A3F020]";
const MODAL_BTN_DANGER =
  "h-11 flex-1 rounded-2xl bg-red-500 text-[14px] font-semibold text-white transition hover:bg-red-600";

function ProductRow({
  product,
  selected,
  canAssignToClient = false,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
  onMove,
  onAssignToClient,
}: {
  product: Product;
  selected: boolean;
  canAssignToClient?: boolean;
  onSelect: (e: MouseEvent, id: string) => void;
  onDelete: (p: Product) => void;
  onRename: (p: Product) => void;
  onDuplicate: (p: Product) => void;
  onMove: (id: string) => void;
  onAssignToClient: (p: Product) => void;
}) {
  return (
    <div className="flex h-20 items-center gap-4 bg-white px-4 transition hover:bg-[#FFFFFF]">
      <button
        onClick={(e) => onSelect(e, product.id)}
        aria-label={`Select ${product.title}`}
        title="Select product"
        className={`up-select-check grid shrink-0 place-items-center rounded-full border bg-white transition ${
          selected ? "border-[#84D400] bg-[#EEF9E0]" : "border-[#C8CDD4]"
        }`}
      >
        {selected ? <Check size={11} strokeWidth={3} className="text-[#5FA800]" /> : null}
      </button>

      <div className="h-12 w-16 overflow-hidden rounded-xl bg-[#F3FAEB]">
        {product.poster ? (
          <AppImage src={product.poster} className="h-full w-full object-contain" alt="" />
        ) : (
          <div className="grid h-full place-items-center">
            <Box size={22} className="text-[#A3A3A3]" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[#111111]">{product.title}</p>
        <p className="text-[13px] font-medium text-[#525252]">{getProductCategory(product)}</p>
      </div>

      <StatusBadge status={getProductStatus(product)} />

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <UserActionMenu
          items={[
            {
              label: "View",
              icon: <Eye />,
              href: `/dashboard/products/${product.id}`,
            },
            {
              label: "Move",
              icon: <MoveRight />,
              onClick: () => onMove(product.id),
            },
            ...(canAssignToClient
              ? [
                  {
                    label: "Assign to Client",
                    icon: <Users />,
                    onClick: () => onAssignToClient(product),
                  },
                ]
              : []),
            {
              label: "Rename",
              icon: <FilePenLine />,
              onClick: () => onRename(product),
            },
            {
              label: "Duplicate",
              icon: <Layers />,
              onClick: () => onDuplicate(product),
            },
            {
              label: "Delete",
              icon: <Trash2 />,
              danger: true,
              onClick: () => onDelete(product),
            },
          ]}
        />
      </div>
    </div>
  );
}

function ProductMenu({
  product,
  canAssignToClient = false,
  onRename,
  onDuplicate,
  onMove,
  onAssignToClient,
  onDelete,
}: {
  product: Product;
  canAssignToClient?: boolean;
  onRename: (p: Product) => void;
  onDuplicate: (p: Product) => void;
  onMove: (id: string) => void;
  onAssignToClient: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  return (
    <UserActionMenuPanel
      className="up-product-menu z-[30]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div data-product-actions-menu>
        {renderUserActionMenuItems([
          {
            label: "View",
            icon: <Eye />,
            href: `/dashboard/products/${product.id}`,
          },
          {
            label: "Move",
            icon: <MoveRight />,
            onClick: () => onMove(product.id),
          },
          ...(canAssignToClient
            ? [
                {
                  label: "Assign to Client",
                  icon: <Users />,
                  onClick: () => onAssignToClient(product),
                },
              ]
            : []),
          {
            label: "Rename",
            icon: <FilePenLine />,
            onClick: () => onRename(product),
          },
          {
            label: "Duplicate",
            icon: <Layers />,
            onClick: () => onDuplicate(product),
          },
          {
            label: "Delete",
            icon: <Trash2 />,
            danger: true,
            onClick: () => onDelete(product),
          },
        ])}
      </div>
    </UserActionMenuPanel>
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

function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  const archived = norm === "archived";
  const processing = norm === "processing";
  const label = archived ? "Archived" : processing ? "Processing" : "Saved";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        archived
          ? "bg-[#F4F4F5] text-[#525252]"
          : processing
            ? "bg-[#FFF7ED] text-[#C2410C]"
            : "bg-[#EEF9E0] text-[#5FA800]"
      }`}
    >
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5 text-[13px]">
      <span className="font-medium text-[#525252]">{label}</span>
      <span className="font-semibold text-[#111111]">{value}</span>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <ViewportPortal>
      <div
        className="fixed inset-0 z-[100050] grid place-items-center p-4"
        style={{
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(12px) saturate(120%)",
          WebkitBackdropFilter: "blur(12px) saturate(120%)",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-[430px] rounded-[20px] border border-[#ECECEC] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[20px] font-semibold text-[#111111]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-[#ECECEC] bg-white text-[#525252] transition hover:bg-[#F4F4F5]"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </ViewportPortal>
  );
}
