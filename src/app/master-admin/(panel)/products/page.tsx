"use client";

import Link from "next/link";
import AppImage from "@/components/shared/AppImage";
import { useEffect, useState } from "react";
import {
  Ban,
  Box,
  Download,
  Edit3,
  Eye,
  Filter,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  UserRoundCog,
  View,
  X,
} from "lucide-react";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminAreaChart } from "@/components/features/master-admin/AdminSparkline";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import ExportDateModal, { isWithinDateRange } from "@/components/features/master-admin/ExportDateModal";
import TransferOwnerModal from "@/components/features/master-admin/TransferOwnerModal";
import {
  AdminBulkActions,
  AdminEmptyState,
  AdminLoadingState,
  AdminMetricCard,
  AdminPagination,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import "@/components/dashboard/dashboard-premium.css";
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
  totalViews?: number;
  uploadsThisMonth?: number;
};

type Analytics = {
  growthDaily: { label: string; value: number }[];
  uploadsDaily: { label: string; value: number }[];
  storageDaily: { label: string; value: number }[];
  categoryBreakdown: { name: string; value: number }[];
  uploadsThisMonth?: number;
  productGrowthPct?: number;
};

type SortKey = "default" | "storage" | "views";

const STATUS_FILTER_OPTIONS = ["all", "Published", "Draft", "Archived"];

function MiniLineChart({ rows }: { rows: { label: string; value: number }[] }) {
  return <AdminAreaChart rows={rows} className="mt-3 h-28 w-full" />;
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("all"));
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
    if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);

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
    const timer = window.setTimeout(() => void load(page, pageSize), 300);
    return () => window.clearTimeout(timer);
  }, [search, customerFilter, categoryFilter, statusFilter, dateRange.from, dateRange.to, dateRange.preset, sortBy, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setCategoryFilter("all");
    setStatusFilter("all");
    setDateRange(defaultDateRange("all"));
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

  const sparkFromDaily = (analytics?.uploadsDaily || []).slice(-8).map((row) => row.value);
  const publishedShare =
    summary && summary.total > 0
      ? `${Math.round((summary.published / summary.total) * 1000) / 10}% of total`
      : undefined;
  const draftShare =
    summary && summary.total > 0
      ? `${Math.round((summary.draft / summary.total) * 1000) / 10}% of total`
      : undefined;
  const archivedShare =
    summary && summary.total > 0
      ? `${Math.round((summary.archived / summary.total) * 1000) / 10}% of total`
      : undefined;

  const statCards = [
    {
      title: "Total Products",
      value: summary?.total ?? 0,
      note: summary?.uploadsThisMonth != null ? `${summary.uploadsThisMonth} uploaded this month` : undefined,
      spark: sparkFromDaily,
      changeTone: "neutral" as const,
    },
    {
      title: "Published",
      value: summary?.published ?? 0,
      note: publishedShare,
      changeTone: "neutral" as const,
    },
    {
      title: "Draft",
      value: summary?.draft ?? 0,
      note: draftShare,
      changeTone: "neutral" as const,
    },
    {
      title: "Unpublished",
      value: summary?.archived ?? 0,
      note: archivedShare,
      changeTone: "neutral" as const,
    },
    {
      title: "Storage Used",
      value: fmtStorageTB(summary?.totalStorageMB ?? 0),
      note:
        summary?.storageCapacityMB != null && summary.storageCapacityMB > 0
          ? `of ${fmtStorageTB(summary.storageCapacityMB)}`
          : "of platform limit",
      isText: true,
      gauge: summary?.storageUsedPct ?? 0,
    },
    {
      title: "AR Views",
      value: fmtCount(summary?.totalArViews ?? 0),
      note: summary?.totalViews != null ? `${fmtCount(summary.totalViews)} total views` : undefined,
      isText: true,
      changeTone: "neutral" as const,
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
      categoryFilter !== "all" ||
      statusFilter !== "all" ||
      dateRange.preset !== "all" ||
      sortBy !== "default",
  );

  const categoryOptions = ["all", ...categories];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Products"
        subtitle="Manage all 3D products and their performance."
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <Download size={15} />
              Export
            </button>
            <button type="button" className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <Plus size={15} strokeWidth={2.2} />
              Add Product
            </button>
          </>
        }
      />

      {loadError ? (
        <div className="dash-premium-card flex items-center justify-between gap-3 border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#B91C1C]">{loadError}</p>
          <button
            type="button"
            onClick={() => setLoadError("")}
            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#B91C1C] hover:bg-white/70"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {actionMessage ? (
        <div
          className={`dash-premium-card flex items-center justify-between gap-3 px-4 py-3 ${
            actionMessage.toLowerCase().includes("fail")
              ? "border-[#FECACA] bg-[#FEF2F2]"
              : "border-[#DCFCE7] bg-[#F0FDF4]"
          }`}
        >
          <p
            className={`text-[13px] font-semibold ${
              actionMessage.toLowerCase().includes("fail") ? "text-[#B91C1C]" : "text-[#166534]"
            }`}
          >
            {actionMessage}
          </p>
          <button
            type="button"
            onClick={() => setActionMessage("")}
            className="grid h-8 w-8 place-items-center rounded-[10px] hover:bg-white/70"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((card) =>
          "gauge" in card && card.gauge != null ? (
            <div key={card.title} className="dash-premium-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{card.title}</p>
              <p className="mt-1 text-[22px] font-semibold leading-none text-[#111111]">{card.value}</p>
              <p className="mt-1 text-[11px] font-medium text-[#9CA3AF]">{card.note}</p>
              <StorageGauge pct={card.gauge} />
            </div>
          ) : (
            <AdminMetricCard
              key={card.title}
              title={card.title}
              value={card.isText ? card.value : Number(card.value)}
              change={card.note}
              changeTone={"changeTone" in card && card.changeTone ? card.changeTone : "neutral"}
              sparkline={"spark" in card ? card.spark : undefined}
              layout="compact"
            />
          ),
        )}
      </section>

      <section className="dash-premium-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
          <div className="relative min-w-[200px] flex-1 basis-[220px] max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by product name, owner or ID..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>
          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Status"
            menuTitle="Status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            renderOption={(value) =>
              value === "all" ? "All Status" : value === "Archived" ? "Unpublished" : value
            }
            renderValue={(value) =>
              value === "all" ? "All Status" : value === "Archived" ? "Unpublished" : value
            }
          />
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
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-[14px] border px-3 text-[12px] font-semibold transition ${
              moreFiltersOpen
                ? "border-[#84D400] bg-[#F0FDF4] text-[#111827]"
                : "border-[#ECECEC] bg-white text-[#6B7280] hover:bg-[#FAFAFB]"
            }`}
          >
            <Filter size={15} />
            More Filters
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[14px] px-3 text-[12px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          ) : null}
        </div>

        {moreFiltersOpen && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] bg-[#FAFAFB] px-4 py-3">
            <input
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Customer name or email"
              className="h-10 min-w-[190px] rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400]"
            />
            <UserFilterDropdown
              hideLabel
              compact
              className="w-[160px] shrink-0"
              label="Category"
              menuTitle="Category"
              value={categoryFilter}
              options={categoryOptions}
              onChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
              renderOption={(value) => (value === "all" ? "All Categories" : value)}
              renderValue={(value) => (value === "all" ? "All Categories" : value)}
            />
            <UserDateRangePicker
              value={dateRange}
              onChange={(next) => {
                setDateRange(next);
                setPage(1);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setSortBy((prev) => (prev === "storage" ? "default" : "storage"));
                setPage(1);
              }}
              className={`h-10 rounded-[14px] border px-3 text-[12px] font-semibold ${
                sortBy === "storage"
                  ? "border-[#84D400] bg-[#F0FDF4] text-[#111827]"
                  : "border-[#ECECEC] bg-white text-[#6B7280] hover:bg-[#FAFAFB]"
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
              className={`h-10 rounded-[14px] border px-3 text-[12px] font-semibold ${
                sortBy === "views"
                  ? "border-[#84D400] bg-[#F0FDF4] text-[#111827]"
                  : "border-[#ECECEC] bg-white text-[#6B7280] hover:bg-[#FAFAFB]"
              }`}
            >
              Sort: Views
            </button>
          </div>
        )}

        {loading ? (
          <AdminLoadingState label="Loading products..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAllPage}
                      className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                    />
                  </th>
                  <th className="px-3 py-3">Thumbnail</th>
                  <th className="px-3 py-3">Product Name</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Company</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Variants</th>
                  <th className="px-3 py-3">Materials</th>
                  <th className="px-3 py-3">File Size</th>
                  <th className="px-3 py-3">Storage</th>
                  <th className="px-3 py-3">Views</th>
                  <th className="px-3 py-3">AR Views</th>
                  <th className="px-3 py-3">QR Scans</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="w-32 px-3 py-3">Actions</th>
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
                    <tr key={p.id} className={adminTableRowClass}>
                      <td className="px-3 py-3">
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
                          className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          {p.poster ? (
                            <AppImage src={p.poster} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Box size={18} className="text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/master-admin/products/${p.id}`}
                          className="truncate text-[13px] font-bold text-[#111827] transition hover:text-[#5AA700]"
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
                    <td colSpan={17}>
                      <AdminEmptyState title="No products found." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#ECECEC] px-2">
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
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <div className="dash-premium-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-black text-slate-900">Upload Trend</h3>
            <span className="text-[11px] font-bold text-emerald-600">
              {analytics?.uploadsThisMonth ?? 0} this month
            </span>
          </div>
          <MiniLineChart rows={analytics?.uploadsDaily || []} />
        </div>
        <div className="dash-premium-card p-4">
          <h3 className="text-[14px] font-black text-[#111827]">Categories</h3>
          <DonutLegend items={categoryDonut} total={categoryTotal} />
        </div>
        <div className="dash-premium-card p-4">
          <h3 className="text-[14px] font-black text-[#111827]">Storage Usage</h3>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            {fmtStorageTB(summary?.totalStorageMB ?? 0)} used ·{" "}
            {fmtStorageTB(Math.max(0, (summary?.storageCapacityMB ?? 0) - (summary?.totalStorageMB ?? 0)))} remaining
          </p>
          <StorageGauge pct={summary?.storageUsedPct ?? 0} />
        </div>
        <div className="dash-premium-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-black text-[#111827]">Product Growth</h3>
            {(() => {
              const pct = analytics?.productGrowthPct;
              if (pct == null) return null;
              const up = pct >= 0;
              return (
                <span className={`text-[11px] font-bold ${up ? "text-emerald-600" : "text-red-500"}`}>
                  {up ? "+" : ""}
                  {pct}% vs prior week
                </span>
              );
            })()}
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
