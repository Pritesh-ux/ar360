"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Ban,
  Box,
  ChevronDown,
  Download,
  Edit3,
  Eye,
  Filter,
  Plus,
  QrCode,
  RotateCcw,
  Share2,
  Trash2,
  UserRoundCog,
  View,
} from "lucide-react";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminSparkline from "@/components/features/master-admin/AdminSparkline";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import ExportDateModal, { isWithinDateRange } from "@/components/features/master-admin/ExportDateModal";
import TransferOwnerModal from "@/components/features/master-admin/TransferOwnerModal";
import { AdminActionMessage, AdminBulkActions, AdminPagination } from "@/components/ui/admin";
import {
  categoryBadgeClass,
  fmtCount,
  fmtStorageShort,
  fmtStorageTB,
  productStatusClass,
} from "@/components/features/master-admin/products-utils";

type ProductStatus = "Published" | "Draft" | "Archived";

type Product = {
  id: string;
  name: string;
  code: string;
  owner: string;
  customer: string;
  category: string;
  status: ProductStatus;
  fileSize: string;
  storageMB: number;
  variants: number;
  materials: number;
  views: number;
  arViews: number;
  qrScans: number;
  createdAt: string;
  updatedAt: string;
  createdAtRaw?: string;
  poster?: string;
  customerUid: string;
  publicId?: string;
};

type Summary = {
  total: number;
  published: number;
  draft: number;
  archived: number;
  totalStorageMB: number;
  storageCapacityMB: number;
  storageUsedPct: number;
  totalArViews: number;
};

type Analytics = {
  growthDaily: { label: string; value: number }[];
  uploadsDaily: { label: string; value: number }[];
  storageDaily: { label: string; value: number }[];
  categoryBreakdown: { name: string; value: number }[];
  uploadsThisMonth?: number;
};

type SortKey = "default" | "storage" | "views";

function MiniLineChart({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const points = rows
    .map((row, index) => {
      const x = (index / Math.max(rows.length - 1, 1)) * 100;
      const y = 100 - (row.value / max) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="mt-3 h-28 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke="#7AE02E" strokeWidth="2" points={points} />
    </svg>
  );
}

function DonutLegend({
  items,
  total,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="font-semibold text-slate-600">{item.label}</span>
          </div>
          <span className="font-bold text-slate-800">
            {total > 0 ? Math.round((item.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

function StorageGauge({ pct }: { pct: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  return (
    <div className="relative mx-auto mt-3 flex h-32 w-32 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#7AE02E"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-[22px] font-black text-slate-900">{Math.round(pct)}%</p>
        <p className="text-[10px] font-semibold text-slate-400">Used</p>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [transferProduct, setTransferProduct] = useState<{
    id: string;
    name: string;
    customerUid: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  async function load(nextPage = page, nextPageSize = pageSize) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    if (sortBy !== "default") params.set("sort", sortBy);
    if (search) params.set("search", search);
    if (customerFilter) params.set("customer", customerFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const res = await fetch(`/api/master-admin/products?${params}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load products");
      setProducts(Array.isArray(data.products) ? data.products : []);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setSummary(data.summary || null);
      setAnalytics(data.analytics || null);
      setLoadError("");
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
    } catch (error) {
      setProducts([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page, pageSize), 0);
    return () => window.clearTimeout(timer);
  }, [search, customerFilter, categoryFilter, statusFilter, dateFrom, dateTo, sortBy, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageProducts = products;

  const allPageSelected = pageProducts.length > 0 && pageProducts.every((p) => selected.has(p.id));

  function toggleAllPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageProducts.forEach((p) => next.delete(p.id));
      else pageProducts.forEach((p) => next.add(p.id));
      return next;
    });
  }

  async function changeStatus(id: string, status: ProductStatus) {
    const action =
      status === "Published" ? "publish" : status === "Archived" ? "archive" : "draft";
    setActionMessage("");
    try {
      const response = await fetch(`/api/master-admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Product status update failed");
      const nextStatus = (data.status || status) as ProductStatus;
      setProducts((prev) =>
        prev.map((product) => (product.id === id ? { ...product, status: nextStatus } : product)),
      );
      setActionMessage(
        nextStatus === "Published"
          ? "Product published. Public viewer access is active."
          : nextStatus === "Archived"
            ? "Product unpublished. Files are preserved."
            : "Product moved to draft.",
      );
      return true;
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Product status update failed");
      return false;
    }
  }

  async function deleteProduct(id: string) {
    setDeleting(true);
    setActionMessage("");
    try {
      const res = await fetch(`/api/master-admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setConfirmDeleteId(null);
      setActionMessage("Product deleted.");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function openTransfer(product: Product) {
    setTransferProduct({ id: product.id, name: product.name, customerUid: product.customerUid });
  }

  function viewerUrl(p: Product) {
    return `/viewer/${p.publicId || p.id}`;
  }

  function shareProduct(p: Product) {
    const url = `${window.location.origin}${viewerUrl(p)}`;
    void navigator.clipboard?.writeText(url);
    setActionMessage("Viewer link copied to clipboard.");
  }

  function resetFilters() {
    setSearch("");
    setCustomerFilter("");
    setCategoryFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setSortBy("default");
    setMoreFiltersOpen(false);
    setPage(1);
  }

  async function runBulkAction() {
    if (!bulkAction) return;
    const selectedProducts = pageProducts.filter((p) => selected.has(p.id));

    if (bulkAction === "export") {
      exportCsv();
      setBulkAction("");
      return;
    }

    if (selectedProducts.length === 0) {
      setActionMessage("Select at least one product.");
      return;
    }

    if (bulkAction === "archive") {
      let updated = 0;
      for (const product of selectedProducts) {
        if (await changeStatus(product.id, "Archived")) updated += 1;
      }
      setActionMessage(`Unpublished ${updated} product(s). Files were preserved.`);
      setSelected(new Set());
      setBulkAction("");
      return;
    }

    if (bulkAction === "delete") {
      if (!window.confirm(`Delete ${selectedProducts.length} product(s)? This cannot be undone.`)) return;
      setDeleting(true);
      try {
        for (const product of selectedProducts) {
          const res = await fetch(`/api/master-admin/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete" }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Delete failed");
          }
        }
        setActionMessage(`Deleted ${selectedProducts.length} product(s).`);
        setSelected(new Set());
        setBulkAction("");
        await load(page, pageSize);
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Bulk delete failed");
      } finally {
        setDeleting(false);
      }
    }
  }

  function exportCsv(start?: string, end?: string) {
    const items = start || end
      ? products.filter((p) => isWithinDateRange(p.createdAtRaw || p.createdAt, start || "", end || ""))
      : products;

    const header = [
      "Product",
      "ID",
      "Owner",
      "Company",
      "Category",
      "Status",
      "Variants",
      "Materials",
      "File Size",
      "Storage",
      "Views",
      "AR Views",
      "QR Scans",
      "Created",
      "Updated",
    ];
    const rows = items.map((p) => [
      p.name,
      p.code,
      p.owner,
      p.customer,
      p.category,
      p.status,
      p.variants,
      p.materials,
      p.fileSize,
      p.storageMB,
      p.views,
      p.arViews,
      p.qrScans,
      p.createdAt,
      p.updatedAt,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "products.csv";
    a.click();
  }

  const statCards = [
    {
      title: "Total Products",
      value: summary?.total ?? 0,
      note: "+15.3%",
      spark: [8, 10, 9, 12, 11, 14, 13, 16],
    },
    {
      title: "Published",
      value: summary?.published ?? 0,
      note: "+12.7%",
      spark: [6, 7, 8, 9, 10, 11, 12, 13],
    },
    {
      title: "Draft",
      value: summary?.draft ?? 0,
      note: "+8.2%",
      spark: [3, 4, 4, 5, 5, 6, 6, 7],
    },
    {
      title: "Unpublished",
      value: summary?.archived ?? 0,
      note: "-6.1%",
      noteDown: true,
      spark: [5, 4, 4, 3, 3, 2, 2, 2],
    },
    {
      title: "Storage Used",
      value: fmtStorageTB(summary?.totalStorageMB ?? 0),
      note: `of ${fmtStorageTB(summary?.storageCapacityMB ?? 10 * 1024 * 1024)}`,
      isText: true,
      gauge: summary?.storageUsedPct ?? 0,
    },
    {
      title: "AR Views",
      value: fmtCount(summary?.totalArViews ?? 0),
      note: "+18.6%",
      isText: true,
      spark: [4, 6, 7, 8, 10, 12, 14, 16],
    },
  ];

  const categoryColors = ["#7AE02E", "#8B5CF6", "#0EA5E9", "#F472B6", "#6366F1", "#94A3B8"];
  const categoryDonut = (analytics?.categoryBreakdown || []).map((item, index) => ({
    label: item.name,
    value: item.value,
    color: categoryColors[index % categoryColors.length],
  }));
  const categoryTotal = categoryDonut.reduce((sum, item) => sum + item.value, 0);
  const hasActiveFilters = Boolean(
    search ||
      customerFilter ||
      categoryFilter ||
      statusFilter ||
      dateFrom ||
      dateTo ||
      sortBy !== "default",
  );

  return (
    <div className="master-admin-panel space-y-5">
      <AdminPageHeader
        title="Products"
        subtitle="Manage all 3D products and their performance."
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700"
            >
              <Download size={16} />
              Export
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-[#A6FF2E] px-4 py-2.5 text-[13px] font-black text-slate-900"
            >
              <Plus size={16} />
              Add Product
            </button>
          </>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
          {loadError}
        </div>
      )}

      {actionMessage ? (
        <AdminActionMessage
          message={actionMessage}
          variant={actionMessage.toLowerCase().includes("fail") ? "error" : "success"}
        />
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
          >
            <p className="text-[11px] font-semibold text-slate-500">{card.title}</p>
            <p className="mt-1 text-[22px] font-black leading-none text-slate-950">
              {card.isText ? card.value : Number(card.value).toLocaleString("en-IN")}
            </p>
            <p
              className={`mt-1 text-[10px] font-semibold ${
                "noteDown" in card && card.noteDown ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {card.note}
            </p>
            {"gauge" in card && card.gauge != null ? (
              <StorageGauge pct={card.gauge} />
            ) : (
              "spark" in card && card.spark && <AdminSparkline values={card.spark} className="mt-3" />
            )}
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:flex-wrap lg:items-center">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by product name, owner or ID..."
            className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[13px] font-medium outline-none focus:border-[#A6FF2E] focus:bg-white"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700"
          >
            <option value="">All Status</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Unpublished</option>
          </select>
          {selected.size > 0 ? (
            <AdminBulkActions
              value={bulkAction}
              onChange={setBulkAction}
              selectedCount={selected.size}
              onApply={() => void runBulkAction()}
              disabled={deleting}
              requireSelection
              options={[
                { value: "archive", label: "Unpublish Selected" },
                { value: "delete", label: "Delete Selected" },
              ]}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setMoreFiltersOpen((open) => !open)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-bold transition ${
              moreFiltersOpen
                ? "border-[#A6FF2E] bg-[#A6FF2E]/10 text-slate-900"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Filter size={15} />
            More Filters
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-[13px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          ) : null}
        </div>

        {moreFiltersOpen && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
            <input
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Customer name or email"
              className="h-10 min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
            />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-700"
              title="Date from"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-700"
              title="Date to"
            />
            <button
              type="button"
              onClick={() => {
                setSortBy((prev) => (prev === "storage" ? "default" : "storage"));
                setPage(1);
              }}
              className={`h-10 rounded-xl border px-3 text-[13px] font-bold ${
                sortBy === "storage"
                  ? "border-[#A6FF2E] bg-[#A6FF2E]/10 text-slate-900"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Sort: Storage
            </button>
            <button
              type="button"
              onClick={() => {
                setSortBy((prev) => (prev === "views" ? "default" : "views"));
                setPage(1);
              }}
              className={`h-10 rounded-xl border px-3 text-[13px] font-bold ${
                sortBy === "views"
                  ? "border-[#A6FF2E] bg-[#A6FF2E]/10 text-slate-900"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Sort: Views
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-[13px] font-semibold text-slate-400">Loading products...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="w-10 p-3">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage} />
                  </th>
                  <th className="p-3">Thumbnail</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Variants</th>
                  <th className="p-3">Materials</th>
                  <th className="p-3">File Size</th>
                  <th className="p-3">Storage</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">AR Views</th>
                  <th className="p-3">QR Scans</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Updated</th>
                  <th className="w-32 p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageProducts.map((p) => {
                  const actionItems = [
                    {
                      label: "QR settings",
                      icon: <QrCode size={15} />,
                      onClick: () => window.open(`/dashboard/products/${p.id}?tab=qr`, "_blank"),
                    },
                    {
                      label: "Copy viewer link",
                      icon: <Share2 size={15} />,
                      onClick: () => shareProduct(p),
                    },
                    {
                      label: "Transfer owner",
                      icon: <UserRoundCog size={15} />,
                      onClick: () => openTransfer(p),
                    },
                    p.status === "Published"
                      ? {
                          label: "Unpublish",
                          icon: <Ban size={15} />,
                          onClick: () => void changeStatus(p.id, "Archived"),
                        }
                      : {
                          label: "Publish",
                          icon: <Eye size={15} />,
                          onClick: () => void changeStatus(p.id, "Published"),
                        },
                    {
                      label: "Delete permanently",
                      icon: <Trash2 size={15} />,
                      onClick: () => setConfirmDeleteId(p.id),
                      isDangerous: true,
                    },
                  ];

                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          {p.poster ? (
                            <img src={p.poster} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Box size={18} className="text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/master-admin/products/${p.id}`}
                          className="truncate text-[13px] font-bold text-slate-900 hover:text-[#4D9A00]"
                        >
                          {p.name}
                        </Link>
                        <p className="text-[11px] font-semibold text-slate-400">ID: {p.code}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <CustomerAvatar name={p.owner} seed={p.customerUid} size="sm" />
                          {p.customerUid ? (
                            <Link
                              href={`/master-admin/customers/${encodeURIComponent(p.customerUid)}`}
                              className="text-[12px] font-semibold text-slate-700 hover:text-[#4D9A00] hover:underline"
                            >
                              {p.owner}
                            </Link>
                          ) : (
                            <span className="text-[12px] font-semibold text-slate-700">{p.owner}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">
                        {p.customerUid ? (
                          <Link
                            href={`/master-admin/customers/${encodeURIComponent(p.customerUid)}`}
                            className="hover:text-[#4D9A00] hover:underline"
                          >
                            {p.customer}
                          </Link>
                        ) : (
                          p.customer
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${categoryBadgeClass(p.category)}`}>
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${productStatusClass(p.status)}`}>
                          {p.status === "Archived" ? "Unpublished" : p.status}
                        </span>
                      </td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{p.variants}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{p.materials}</td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">{p.fileSize}</td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">{fmtStorageShort(p.storageMB)}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{p.views.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{p.arViews.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{p.qrScans.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-[12px] font-semibold text-slate-600">{p.createdAt}</td>
                      <td className="p-3 text-[12px] font-semibold text-slate-600">{p.updatedAt}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-0.5">
                          <Link href={`/master-admin/products/${p.id}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" title="View">
                            <Eye size={15} />
                          </Link>
                          <Link href={`/dashboard/products/${p.id}`} target="_blank" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" title="Open Editor">
                            <Edit3 size={15} />
                          </Link>
                          {p.status === "Published" ? (
                            <Link href={viewerUrl(p)} target="_blank" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" title="Open Viewer">
                              <View size={15} />
                            </Link>
                          ) : null}
                          <AdminActionMenu items={actionItems} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageProducts.length === 0 && (
                  <tr>
                    <td colSpan={17} className="p-16 text-center text-[13px] font-semibold text-slate-400">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          onPageChange={setPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-black text-slate-900">Upload Trend</h3>
            <span className="text-[11px] font-bold text-emerald-600">
              {analytics?.uploadsThisMonth ?? 0} this month
            </span>
          </div>
          <MiniLineChart rows={analytics?.uploadsDaily || []} />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="text-[14px] font-black text-slate-900">Categories</h3>
          <DonutLegend items={categoryDonut} total={categoryTotal} />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="text-[14px] font-black text-slate-900">Storage Usage</h3>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            {fmtStorageTB(summary?.totalStorageMB ?? 0)} used ·{" "}
            {fmtStorageTB(Math.max(0, (summary?.storageCapacityMB ?? 0) - (summary?.totalStorageMB ?? 0)))} remaining
          </p>
          <StorageGauge pct={summary?.storageUsedPct ?? 0} />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-black text-slate-900">Product Growth</h3>
            <span className="text-[11px] font-bold text-emerald-600">+14.7%</span>
          </div>
          <MiniLineChart rows={analytics?.growthDaily || []} />
        </div>
      </section>

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete Product?"
        description="This product will be removed from the database and its storage folder deleted."
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) void deleteProduct(confirmDeleteId);
        }}
      />
      <TransferOwnerModal
        open={!!transferProduct}
        productId={transferProduct?.id || ""}
        productName={transferProduct?.name || ""}
        currentCustomerUid={transferProduct?.customerUid || ""}
        saving={deleting}
        onClose={() => setTransferProduct(null)}
        onTransferred={() => {
          setTransferProduct(null);
          setActionMessage("Product owner transferred.");
          void load(page, pageSize);
        }}
      />
      <ExportDateModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={exportCsv}
        title="Export Products"
      />
    </div>
  );
}
