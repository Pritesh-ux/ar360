"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  Copy,
  Download,
  Edit3,
  Eye,
  IndianRupee,
  Plus,
  Tag,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import CouponFormModal, { type CouponFormValues } from "@/components/features/master-admin/CouponFormModal";
import CouponRedemptionsModal from "@/components/features/master-admin/CouponRedemptionsModal";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
import { paginationRange, type PaginationMeta } from "@/lib/master-admin/pagination";
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

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const initialRange = defaultDateRange();

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

const typeColors: Record<string, string> = {
  percentage: "#10B981",
  fixed: "#0EA5E9",
  free_trial: "#8B5CF6",
};

function MiniLineChart({ rows, color = "#8B5CF6" }: { rows: { label: string; value: number }[]; color?: string }) {
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
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
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
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [redemptionsCoupon, setRedemptionsCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);

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

  useEffect(() => {
    setPage(1);
  }, [search, status, type, createdFrom, createdTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, type, createdFrom, createdTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageItems = coupons;
  const range = paginationRange(pagination);

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

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setType("all");
    setCreatedFrom("");
    setCreatedTo("");
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);
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
    createdFrom || createdTo
      ? `${fmtDateShort(createdFrom || chartRange.from)} – ${fmtDateShort(createdTo || chartRange.to)}`
      : `${summary?.totalCount ?? 0} matching filters`;

  const statCards = [
    {
      title: "Active Coupons",
      value: summary?.activeCoupons ?? 0,
      subtitle: filterLabel,
      color: "#10B981",
      icon: Tag,
      iconBg: "bg-emerald-50 text-emerald-600",
      isText: false,
    },
    {
      title: "Total Used",
      value: (summary?.totalUsed ?? 0).toLocaleString("en-IN"),
      subtitle: "Redemptions across filtered coupons",
      color: "#0EA5E9",
      icon: TrendingUp,
      iconBg: "bg-sky-50 text-sky-600",
      isText: true,
    },
    {
      title: "Expired Coupons",
      value: summary?.expiredCoupons ?? 0,
      subtitle: "Past expiry or marked expired",
      color: "#F59E0B",
      icon: XCircle,
      iconBg: "bg-amber-50 text-amber-600",
      isText: false,
    },
    {
      title: "Customer Discounts",
      value: fmtMoneyInr(summary?.revenueSaved ?? 0),
      subtitle: "Lifetime discount value (not platform revenue)",
      color: "#8B5CF6",
      icon: IndianRupee,
      iconBg: "bg-violet-50 text-violet-600",
      isText: true,
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
    <div className="master-admin-panel">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          <AdminPageHeader
            title="Coupons & Promotions"
            subtitle="Create and manage discount codes, usage limits, and promotional offers."
            actions={
              <>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700"
                >
                  <Download size={16} />
                  Export
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCoupon(null);
                    setFormOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#A6FF2E] px-4 py-2.5 text-[13px] font-black text-slate-900"
                >
                  <Plus size={16} />
                  Create Coupon
                </button>
              </>
            }
          />

          {message ? (
            <AdminActionMessage
              message={message}
              variant={message.toLowerCase().includes("fail") ? "error" : "success"}
            />
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}>
                      <Icon size={16} />
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-slate-500">{card.title}</p>
                  <p className="mt-0.5 text-[20px] font-black leading-none text-slate-950">
                    {card.isText ? card.value : Number(card.value).toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">{card.subtitle}</p>
                </div>
              );
            })}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:flex-wrap lg:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code or description..."
                className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[13px] font-medium outline-none focus:border-[#A6FF2E] focus:bg-white"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                title="Created from"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              />
              <input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                title="Created to"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              />
              <button
                type="button"
                onClick={() => {
                  const range = defaultDateRange();
                  setCreatedFrom(range.from);
                  setCreatedTo(range.to);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700"
              >
                <CalendarClock size={14} />
                Last 30 days
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-600"
              >
                Reset
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={pageItems.length > 0 && pageItems.every((row) => selected.has(row.id))}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Usage Limit</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center font-semibold text-slate-400">
                        Loading coupons...
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center font-semibold text-slate-400">
                        No coupons found.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((row) => {
                      const pct = usagePercent(row.usageCount, row.usageLimit);
                      return (
                        <tr key={row.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(row.id)}
                              onChange={() => toggleOne(row.id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-3">
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

            <AdminPagination
              page={page}
              totalPages={pagination.totalPages}
              meta={pagination}
              onPageChange={setPage}
            />
          </section>

          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action.label)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[12px] font-bold text-slate-700 transition hover:border-[#A6FF2E]/60 hover:bg-[#A6FF2E]/5"
                >
                  <Icon size={14} className="text-[#4D9A00]" />
                  {action.label}
                </button>
              );
            })}
          </section>
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[320px]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Coupon Types</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {donutTotal} total coupons
            </p>
            <div className="mt-4">
              <DonutChart items={donutItems} total={donutTotal} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Top Performing Coupons</h3>
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

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-black text-slate-900">Customer Discounts</h3>
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
    </div>
  );
}
