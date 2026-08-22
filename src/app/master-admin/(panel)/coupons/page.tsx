"use client";

import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Copy,
  Download,
  Edit3,
  Eye,
  IndianRupee,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminAreaChart } from "@/components/features/master-admin/AdminSparkline";
import CouponFormModal, { type CouponFormValues } from "@/components/features/master-admin/CouponFormModal";
import CouponRedemptionsModal from "@/components/features/master-admin/CouponRedemptionsModal";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import {
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
import type { PaginationMeta } from "@/lib/master-admin/pagination";
import "@/components/dashboard/dashboard-premium.css";
import {
  couponStatusClass,
  couponTypeClass,
  couponTypeLabel,
  fmtDateShort,
  fmtDiscount,
  fmtMoneyInr,
  usagePercent,
} from "@/components/features/master-admin/coupons-utils";

type Coupon = {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  usageCount: number;
  usageLimit: number;
  revenueSaved: number;
  expiresAt: string | null;
  status: "Active" | "Expired" | "Disabled";
};

type Summary = {
  activeCoupons: number;
  totalUsed: number;
  expiredCoupons: number;
  revenueSaved: number;
  totalCount: number;
  redemptionValueInRange?: number;
};

function defaultCouponDateRange(): DateRangeValue {
  return defaultDateRange("30d");
}

const initialRange = defaultCouponDateRange();

type TypeBreakdown = {
  type: string;
  count: number;
  percent: number;
};

const PAGE_SIZE = 10;
const typeOptions = [
  { label: "All Types", value: "all" },
  { label: "Percentage", value: "percentage" },
  { label: "Fixed Amount", value: "fixed" },
  { label: "Free Trial", value: "free_trial" },
];
const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "active" },
  { label: "Expired", value: "expired" },
  { label: "Disabled", value: "disabled" },
];
const statusFilterOptions = statusOptions.map((s) => s.value);
const typeFilterOptions = typeOptions.map((t) => t.value);

const typeColors: Record<string, string> = {
  percentage: "#10B981",
  fixed: "#0EA5E9",
  free_trial: "#8B5CF6",
};

function MiniLineChart({ rows, color = "#8B5CF6" }: { rows: { label: string; value: number }[]; color?: string }) {
  return <AdminAreaChart rows={rows} color={color} className="mt-3 h-28 w-full" />;
}

function DonutChart({ items, total }: { items: { label: string; value: number; color: string }[]; total: number }) {
  const segments = items.map((item, index) => {
    const pct = total > 0 ? item.value / total : 0;
    const dash = `${pct * 100} ${100 - pct * 100}`;
    const offset = items.slice(0, index).reduce((sum, curr) => {
      const currPct = total > 0 ? curr.value / total : 0;
      return sum + currPct * 100;
    }, 0);
    return { ...item, dash, offset };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 36 36" className="h-24 w-24 shrink-0 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
        {segments.map((seg) => (
          <circle
            key={seg.label}
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={seg.color}
            strokeWidth="3.5"
            strokeDasharray={seg.dash}
            strokeDashoffset={100 - seg.offset}
          />
        ))}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <span className="font-semibold text-slate-600">{item.label}</span>
            </div>
            <span className="font-bold text-slate-800">
              {item.value}{" "}
              <span className="font-semibold text-slate-400">
                ({total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdown[]>([]);
  const [topPerforming, setTopPerforming] = useState<{ code: string; uses: number }[]>([]);
  const [revenueDaily, setRevenueDaily] = useState<{ label: string; value: number }[]>([]);
  const [chartRange, setChartRange] = useState({ from: initialRange.from, to: initialRange.to });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [createdDateRange, setCreatedDateRange] = useState<DateRangeValue>(() => defaultCouponDateRange());
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [redemptionsCoupon, setRedemptionsCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (createdDateRange.from) params.set("createdFrom", createdDateRange.from);
    if (createdDateRange.to) params.set("createdTo", createdDateRange.to);

    try {
      const response = await fetch(`/api/master-admin/coupons?${params}`, { cache: "no-store" });
      const data = await response.json();
      setCoupons(data.coupons || []);
      setSummary(data.summary || null);
      setTypeBreakdown(data.analytics?.typeBreakdown || []);
      setTopPerforming(data.analytics?.topPerforming || []);
      setRevenueDaily(data.analytics?.revenueDaily || []);
      if (data.analytics?.chartFrom && data.analytics?.chartTo) {
        setChartRange({ from: data.analytics.chartFrom, to: data.analytics.chartTo });
      }
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
      if (data.error) setMessage(data.error);
      setSelected(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load coupons");
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    setPage(1);
  }, [search, status, type, createdDateRange.from, createdDateRange.to, createdDateRange.preset]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, type, createdDateRange.from, createdDateRange.to, createdDateRange.preset, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageItems = coupons;

  async function saveCoupon(values: CouponFormValues) {
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...values,
        expiresAt: values.expiresAt ? `${values.expiresAt} 23:59:59` : null,
      };
      const res = editingCoupon
        ? await fetch(`/api/master-admin/coupons/${editingCoupon.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/master-admin/coupons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage(editingCoupon ? "Coupon updated." : "Coupon created.");
      setFormOpen(false);
      setEditingCoupon(null);
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function activateCouponRow(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/master-admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activate failed");
      setMessage("Coupon activated.");
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activate failed");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateCouponRow(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/master-admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      setMessage(data.coupon?.code ? `Duplicated as ${data.coupon.code}.` : "Coupon duplicated.");
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Duplicate failed");
    } finally {
      setSaving(false);
    }
  }

  async function disableCoupon(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/master-admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disable failed");
      setMessage("Coupon disabled.");
      setDisableId(null);
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disable failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setMessage(`${data.deleted || ids.length} coupon(s) deleted.`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      await load(1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearAllCoupons() {
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setMessage(`${data.deleted || 0} coupon(s) deleted.`);
      setSelected(new Set());
      setClearAllOpen(false);
      await load(1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setType("all");
    setCreatedDateRange(defaultCouponDateRange());
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (createdDateRange.from) params.set("createdFrom", createdDateRange.from);
    if (createdDateRange.to) params.set("createdTo", createdDateRange.to);
    window.open(`/api/master-admin/coupons?${params}`, "_blank");
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    setMessage(`Copied ${code} to clipboard.`);
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(pageItems.map((row) => row.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filterLabel =
    createdDateRange.from || createdDateRange.to
      ? `${fmtDateShort(createdDateRange.from || chartRange.from)} – ${fmtDateShort(createdDateRange.to || chartRange.to)}`
      : `${summary?.totalCount ?? 0} matching filters`;

  const hasFilters = Boolean(search || status !== "all" || type !== "all" || createdDateRange.preset !== "30d");

  const statCards = [
    {
      title: "Active Coupons",
      value: summary?.activeCoupons ?? 0,
      note: filterLabel,
      icon: Tag,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Total Used",
      value: (summary?.totalUsed ?? 0).toLocaleString("en-IN"),
      note: "Redemptions across filtered coupons",
      icon: TrendingUp,
      iconClassName: "bg-sky-50 text-sky-600",
    },
    {
      title: "Expired Coupons",
      value: summary?.expiredCoupons ?? 0,
      note: "Past expiry or marked expired",
      icon: XCircle,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Customer Discounts",
      value: fmtMoneyInr(summary?.revenueSaved ?? 0),
      note: "Lifetime discount value (not platform revenue)",
      icon: IndianRupee,
      iconClassName: "bg-violet-50 text-violet-600",
    },
  ];

  const donutItems = typeBreakdown.map((item) => ({
    label: couponTypeLabel(item.type),
    value: item.count,
    color: typeColors[item.type] || "#94A3B8",
  }));
  const donutTotal = donutItems.reduce((sum, item) => sum + item.value, 0);

  const quickActions = [
    { label: "Create Coupon", icon: Plus },
    { label: "Export Coupons", icon: Download },
    { label: "View Redemptions", icon: Eye },
  ];

  function handleQuickAction(label: string) {
    if (label === "Create Coupon") {
      setEditingCoupon(null);
      setFormOpen(true);
      return;
    }
    if (label === "Export Coupons") {
      exportCsv();
      return;
    }
    if (label === "View Redemptions") {
      const target = pageItems.find((row) => selected.has(row.id)) || pageItems[0];
      if (!target) {
        setMessage("Select a coupon or create one first.");
        return;
      }
      setRedemptionsCoupon(target);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <div className="ma-split-layout">
        <div className="ma-main-col flex flex-col gap-3">
          <AdminPageHeader
            title="Coupons & Promotions"
            subtitle="Create and manage discount codes, usage limits, and promotional offers."
            actions={
              <>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkDeleteOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-3 text-[12px] font-semibold text-[#B91C1C] transition hover:bg-[#FEE2E2]"
                  >
                    <Trash2 size={15} />
                    Delete Selected ({selected.size})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setClearAllOpen(true)}
                  className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
                >
                  Clear Demo Data
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
                >
                  <Download size={15} />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCoupon(null);
                    setFormOpen(true);
                  }}
                  className="dash-premium-btn-primary h-10 px-4 text-[12px]"
                >
                  <Plus size={15} strokeWidth={2.2} />
                  Create Coupon
                </button>
              </>
            }
          />

          {message ? (
            <div
              className={`dash-premium-card flex items-center justify-between gap-3 px-4 py-3 ${
                message.toLowerCase().includes("fail")
                  ? "border-[#FECACA] bg-[#FEF2F2]"
                  : "border-[#DCFCE7] bg-[#F0FDF4]"
              }`}
            >
              <p
                className={`text-[13px] font-semibold ${
                  message.toLowerCase().includes("fail") ? "text-[#B91C1C]" : "text-[#166534]"
                }`}
              >
                {message}
              </p>
              <button
                type="button"
                onClick={() => setMessage("")}
                className="grid h-8 w-8 place-items-center rounded-[10px] hover:bg-white/70"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <AdminMetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                note={card.note}
                iconComponent={card.icon}
                iconClassName={card.iconClassName}
                layout="compact"
              />
            ))}
          </section>

          <section className="dash-premium-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
              <div className="relative min-w-[220px] flex-1 basis-[240px] max-w-sm">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by code or description..."
                  className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
                />
              </div>
              <UserFilterDropdown
                hideLabel
                compact
                className="w-[138px] shrink-0"
                label="Status"
                menuTitle="Status"
                value={status}
                options={statusFilterOptions}
                onChange={setStatus}
                renderOption={(value) => statusOptions.find((s) => s.value === value)?.label || value}
                renderValue={(value) => statusOptions.find((s) => s.value === value)?.label || value}
              />
              <UserFilterDropdown
                hideLabel
                compact
                className="w-[148px] shrink-0"
                label="Type"
                menuTitle="Type"
                value={type}
                options={typeFilterOptions}
                onChange={setType}
                renderOption={(value) => typeOptions.find((t) => t.value === value)?.label || value}
                renderValue={(value) => typeOptions.find((t) => t.value === value)?.label || value}
              />
              <UserDateRangePicker value={createdDateRange} onChange={setCreatedDateRange} />
              {hasFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-auto inline-flex h-10 shrink-0 items-center rounded-[14px] px-3 text-[12px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[13px]">
                <thead>
                  <tr className={adminTableHeadClass}>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={pageItems.length > 0 && pageItems.every((row) => selected.has(row.id))}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                      />
                    </th>
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3">Discount</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Usage</th>
                    <th className="px-3 py-3">Usage Limit</th>
                    <th className="px-3 py-3">Expiry</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10}>
                        <AdminLoadingState label="Loading coupons..." />
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <AdminEmptyState title="No coupons found." />
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((row) => {
                      const pct = usagePercent(row.usageCount, row.usageLimit);
                      return (
                        <tr key={row.id} className={adminTableRowClass}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(row.id)}
                              onChange={() => toggleOne(row.id)}
                              className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-black tracking-wide text-slate-900">{row.code}</span>
                              <button
                                type="button"
                                onClick={() => copyCode(row.code)}
                                title="Copy code"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </td>
                          <td className="max-w-[180px] px-4 py-3">
                            <p className="truncate font-medium text-slate-600">{row.description}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {fmtDiscount(row.discountType, row.discountValue)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${couponTypeClass(row.discountType)}`}
                            >
                              {couponTypeLabel(row.discountType)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-[120px]">
                              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                                <span>{row.usageCount.toLocaleString("en-IN")}</span>
                                {row.usageLimit > 0 && <span>{pct}%</span>}
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-[#A6FF2E]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-600">
                            {row.usageLimit > 0 ? row.usageLimit.toLocaleString("en-IN") : "Unlimited"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{fmtDateShort(row.expiresAt)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${couponStatusClass(row.status)}`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setRedemptionsCoupon(row)}
                              title="View redemptions"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-violet-50 hover:text-violet-600"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateCouponRow(row.id)}
                              title="Duplicate"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCoupon(row);
                                setFormOpen(true);
                              }}
                              title="Edit"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-sky-50 hover:text-sky-600"
                            >
                              <Edit3 size={15} />
                            </button>
                            {row.status === "Disabled" ? (
                              <button
                                type="button"
                                onClick={() => activateCouponRow(row.id)}
                                title="Activate"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <Zap size={15} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDisableId(row.id)}
                                title="Disable"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#ECECEC] px-2">
              <AdminPagination
                page={page}
                totalPages={pagination.totalPages}
                meta={pagination}
                onPageChange={setPage}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action.label)}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#ECECEC] bg-white px-3 py-3 text-[12px] font-bold text-[#374151] transition hover:border-[#84D400]/60 hover:bg-[#FAFAFB]"
                >
                  <Icon size={14} className="text-[#5AA700]" />
                  {action.label}
                </button>
              );
            })}
          </section>
        </div>

        <aside className="ma-side-col space-y-3">
          <div className="dash-premium-card p-4">
            <h3 className="text-[13px] font-black text-slate-900">Coupon Types</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {donutTotal} total coupons
            </p>
            <div className="mt-4">
              <DonutChart items={donutItems} total={donutTotal} />
            </div>
          </div>

          <div className="dash-premium-card p-4">
            <h3 className="text-[13px] font-black text-[#111827]">Top Performing Coupons</h3>
            <div className="mt-3 space-y-2">
              {topPerforming.length === 0 ? (
                <p className="text-[12px] font-semibold text-slate-400">No usage data yet</p>
              ) : (
                topPerforming.map((item, index) => (
                  <div key={item.code} className="flex items-center justify-between gap-2 text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-600">
                        {index + 1}
                      </span>
                      <span className="truncate font-bold text-slate-800">{item.code}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-slate-500">
                      {item.uses.toLocaleString("en-IN")} uses
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dash-premium-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-black text-[#111827]">Customer Discounts</h3>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {fmtDateShort(chartRange.from)} – {fmtDateShort(chartRange.to)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-black text-slate-900">
                  {fmtMoneyInr(summary?.redemptionValueInRange ?? 0)}
                </p>
                <p className="text-[10px] font-bold text-slate-400">From redemptions</p>
              </div>
            </div>
            <MiniLineChart rows={revenueDaily} />
          </div>
        </aside>
      </div>

      <CouponFormModal
        open={formOpen}
        title={editingCoupon ? `Edit ${editingCoupon.code}` : "Create Coupon"}
        initial={
          editingCoupon
            ? {
                ...editingCoupon,
                discountType: editingCoupon.discountType as CouponFormValues["discountType"],
                expiresAt: editingCoupon.expiresAt || "",
                status: editingCoupon.status === "Disabled" ? "disabled" : "active",
              }
            : undefined
        }
        saving={saving}
        onClose={() => {
          setFormOpen(false);
          setEditingCoupon(null);
        }}
        onSubmit={saveCoupon}
      />

      <CouponRedemptionsModal
        open={Boolean(redemptionsCoupon)}
        couponUid={redemptionsCoupon?.id || null}
        couponCode={redemptionsCoupon?.code}
        onClose={() => setRedemptionsCoupon(null)}
      />

      <ConfirmModal
        open={Boolean(disableId)}
        title="Disable coupon?"
        description="This coupon will no longer be redeemable."
        confirmText="Disable"
        danger
        onCancel={() => setDisableId(null)}
        onConfirm={() => {
          if (disableId) void disableCoupon(disableId);
        }}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selected.size} coupon(s)?`}
        description="This will permanently remove the selected coupons and all their redemption records. This action cannot be undone."
        confirmText="Delete"
        danger
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void deleteSelected()}
      />

      <ConfirmModal
        open={clearAllOpen}
        title="Delete ALL coupons?"
        description="This will permanently remove every coupon and all redemption records from the database. This action cannot be undone."
        confirmText="Delete All"
        danger
        onCancel={() => setClearAllOpen(false)}
        onConfirm={() => void clearAllCoupons()}
      />
    </div>
  );
}
