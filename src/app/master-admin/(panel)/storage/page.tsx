"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Box,
  CalendarDays,
  ChevronDown,
  Download,
  FileImage,
  FileVideo,
  HardDrive,
  Layers,
  Package,
  RefreshCw,
  Settings,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import OrphanScanModal, { type OrphanFolder } from "@/components/features/master-admin/OrphanScanModal";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
import { type PaginationMeta } from "@/lib/master-admin/pagination";
import {
  fmtDateShort,
  fmtFileSize,
  fmtStorageFromMb,
  fmtStorageTb,
  fileTypeIconClass,
  planStorageLabel,
} from "@/components/features/master-admin/storage-utils";

type StorageUser = {
  customer_uid: string;
  customer: string;
  email: string;
  plan: string;
  usedMB: number;
  limitMB: number;
  pct: number;
  products: number;
};

type Summary = {
  totalStorageTb: number;
  usedStorageTb: number;
  freeStorageTb: number;
  usedPct: number;
  freePct: number;
  bandwidthUsedTb: number;
  bandwidthLimitTb: number;
  bandwidthPct: number;
  warnings: number;
  critical: number;
  storageTrend?: string;
  bandwidthTrend?: string;
  growthDays?: number;
  liveSource?: "hostinger_api" | "vps_disk" | "unavailable";
  liveHostname?: string | null;
  liveVmId?: string | null;
  livePlan?: string | null;
  liveSampledAt?: string | null;
  liveNotes?: string[];
  customerStorageTb?: number;
  customerBandwidthTb?: number;
};

type TopUser = {
  customerUid: string;
  name: string;
  email: string;
  usedMB: number;
  platformPct: number;
};

type LargestFile = {
  fileName: string;
  customerUid: string;
  customerName: string;
  productTitle: string;
  sizeBytes: number;
  fileType: string;
  uploadedAt: string;
};

type PlanStorage = {
  planId: string;
  usedMB: number;
  customers: number;
};

type Activity = {
  type: "upload";
  title: string;
  subtitle: string;
  meta: string;
  date: string;
};

type ApiResponse = {
  items: StorageUser[];
  pagination?: PaginationMeta;
  summary: Summary;
  analytics: {
    storageGrowth: { label: string; value: number }[];
    fileTypeBreakdown: { key: string; label: string; bytes: number; tb: number; percent: number }[];
    usedVsFree: { usedTb: number; freeTb: number; totalTb: number };
  };
  topUsers: TopUser[];
  largestFiles: LargestFile[];
  storageByPlan: PlanStorage[];
  recentActivities: Activity[];
  error?: string;
};

const typeColors: Record<string, string> = {
  models: "#10B981",
  images: "#0EA5E9",
  textures: "#8B5CF6",
  videos: "#F59E0B",
  other: "#94A3B8",
};

function ProgressBar({ pct, color = "bg-[#A6FF2E]" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function MiniLineChart({ rows, color = "#7AE02E" }: { rows: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0.001);
  const points = rows
    .map((row, index) => {
      const x = (index / Math.max(rows.length - 1, 1)) * 100;
      const y = 100 - (row.value / max) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="mt-3 h-36 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

function DonutChart({ usedPct, freePct }: { usedPct: number; freePct: number }) {
  const usedDash = `${usedPct} ${100 - usedPct}`;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 36 36" className="h-28 w-28 shrink-0 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#A6FF2E" strokeWidth="3.5" strokeDasharray={usedDash} />
      </svg>
      <div className="space-y-2 text-[12px]">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-slate-600">Used</span>
          <span className="font-black text-slate-900">{usedPct}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-slate-600">Free</span>
          <span className="font-black text-slate-900">{freePct}%</span>
        </div>
      </div>
    </div>
  );
}

function FileTypeDonut({
  items,
  totalBytes,
}: {
  items: { key: string; label: string; bytes: number; percent: number }[];
  totalBytes: number;
}) {
  const activeItems = items.filter((i) => i.bytes > 0);
  const segments = activeItems.map((item, index) => {
    const pct = totalBytes > 0 ? item.bytes / totalBytes : 0;
    const dash = `${pct * 100} ${100 - pct * 100}`;
    const offset = activeItems.slice(0, index).reduce((sum, curr) => {
      const currPct = totalBytes > 0 ? curr.bytes / totalBytes : 0;
      return sum + currPct * 100;
    }, 0);
    return { ...item, dash, offset, color: typeColors[item.key] || "#94A3B8" };
  });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <svg viewBox="0 0 36 36" className="mx-auto h-28 w-28 shrink-0 -rotate-90 lg:mx-0">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
        {segments.map((seg) => (
          <circle
            key={seg.key}
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
          <div key={item.key} className="flex items-center justify-between gap-2 text-[11px]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColors[item.key] }} />
              <span className="truncate font-semibold text-slate-600">{item.label}</span>
            </div>
            <span className="shrink-0 font-bold text-slate-800">
              {fmtStorageTb(item.bytes / (1024 ** 4))}{" "}
              <span className="font-semibold text-slate-400">({item.percent}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function StoragePage() {
  const initialRange = defaultDateRange();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [actionPending, setActionPending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"cleanup" | null>(null);
  const [orphanScan, setOrphanScan] = useState<{
    orphanCount: number;
    orphanBytes: number;
    orphans: OrphanFolder[];
    scannedCustomers: number;
  } | null>(null);
  const [orphanModalOpen, setOrphanModalOpen] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", "10");
    if (search) params.set("search", search);
    const growthDays = Math.max(
      7,
      Math.round(
        (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000,
      ) + 1,
    );
    params.set("growthDays", String(Math.min(growthDays, 90)));

    try {
      const response = await fetch(`/api/master-admin/storage?${params}`, { cache: "no-store" });
      const json = (await response.json()) as ApiResponse;
      setData(json);
      if (json.pagination) {
        setPagination(json.pagination);
        setPage(json.pagination.page);
      }
      if (json.error) setMessage(json.error);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load storage data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, dateFrom, dateTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runStorageAction(
    action: "cleanup" | "scan_orphans" | "delete_orphans",
    options?: { dryRun?: boolean; orphanPaths?: string[] },
  ) {
    setActionPending(true);
    setMessage("");
    try {
      const res = await fetch("/api/master-admin/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dryRun: options?.dryRun, orphanPaths: options?.orphanPaths }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      if (action === "cleanup") {
        setMessage(
          options?.dryRun
            ? `Dry run: would remove ${json.result?.removedFiles ?? 0} temp files.`
            : `Removed ${json.result?.removedFiles ?? 0} temp files (${fmtFileSize(json.result?.freedBytes ?? 0)} freed).`,
        );
      } else if (action === "scan_orphans") {
        const scan = json.result as {
          orphanCount: number;
          orphanBytes: number;
          orphans: OrphanFolder[];
          scannedCustomers: number;
        };
        setOrphanScan(scan || null);
        setOrphanModalOpen(true);
        setMessage(`Found ${scan?.orphanCount ?? 0} orphan product folders.`);
      } else {
        setOrphanModalOpen(false);
        setOrphanScan(null);
        setMessage(`Deleted ${json.result?.deleted ?? 0} orphan folders (${fmtFileSize(json.result?.freedBytes ?? 0)} freed).`);
      }
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Storage action failed");
    } finally {
      setActionPending(false);
      setConfirmAction(null);
    }
  }

  async function scanOrphans() {
    await runStorageAction("scan_orphans");
  }

  const summary = data?.summary;
  const analytics = data?.analytics;
  const fileTypeTotal = (analytics?.fileTypeBreakdown || []).reduce((sum, row) => sum + row.bytes, 0);

  function exportReport() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    window.open(`/api/master-admin/storage?${params}`, "_blank");
  }

  const actionCards = [
    {
      title: "Cleanup Storage",
      description: "Remove unused temp files, old versions and cache.",
      button: actionPending ? "Running..." : "Run Cleanup",
      icon: RefreshCw,
      action: () => setConfirmAction("cleanup"),
    },
    {
      title: "Scan Orphan Files",
      description: "Dry-run scan for product folders on disk with no database record.",
      button: actionPending ? "Scanning..." : "Scan Orphans",
      icon: Trash2,
      action: () => void scanOrphans(),
    },
    {
      title: "Download Report",
      description: "Download detailed storage usage report.",
      button: "Download Report",
      icon: Download,
      action: exportReport,
    },
    {
      title: "Storage Settings",
      description: "Configure storage limits and alerts.",
      button: "Manage Settings",
      icon: Settings,
      href: "/master-admin/settings",
    },
  ];

  const sidebarActions = [
    { label: "Cleanup Storage", icon: RefreshCw, action: () => setConfirmAction("cleanup") },
    { label: "Scan Orphan Files", icon: Trash2, action: () => void scanOrphans() },
    { label: "Download Report", icon: Download, action: exportReport },
    { label: "Storage Settings", icon: Settings, href: "/master-admin/settings" },
  ];

  return (
    <div className="master-admin-panel">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          <AdminPageHeader
            title="Storage Manager"
            subtitle="Live Hostinger/VPS disk & bandwidth, plus per-customer storage usage."
            actions={
              <>
                <div className="flex max-w-full items-stretch gap-2">
                  <label className="flex min-w-[142px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300">
                    <CalendarDays size={15} className="shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">From</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setPage(1);
                        }}
                        aria-label="Storage report start date"
                        className="block h-5 min-w-0 w-[104px] appearance-none !border-0 bg-transparent !p-0 text-[11px] font-bold text-slate-700 !shadow-none !outline-none !ring-0"
                      />
                    </span>
                  </label>
                  <label className="flex min-w-[142px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300">
                    <CalendarDays size={15} className="shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">To</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setPage(1);
                        }}
                        aria-label="Storage report end date"
                        className="block h-5 min-w-0 w-[104px] appearance-none !border-0 bg-transparent !p-0 text-[11px] font-bold text-slate-700 !shadow-none !outline-none !ring-0"
                      />
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={exportReport}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700"
                >
                  <Download size={16} />
                  Export Report
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
              </>
            }
          />

          {message ? (
            <AdminActionMessage
              message={message}
              variant={
                message.toLowerCase().includes("fail") && !message.toLowerCase().includes("showing live")
                  ? "error"
                  : message.toLowerCase().includes("showing live") || message.toLowerCase().includes("partial")
                    ? "success"
                    : message.toLowerCase().includes("unable")
                      ? "error"
                      : "success"
              }
            />
          ) : null}

          {summary ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-[12px] font-semibold text-emerald-900">
              <span className="inline-flex items-center rounded-full bg-[#A6FF2E] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-950">
                {summary.liveSource === "hostinger_api"
                  ? "Hostinger API live"
                  : summary.liveSource === "vps_disk"
                    ? "VPS disk live"
                    : "Live unavailable"}
              </span>
              <span>
                {summary.liveHostname ? `${summary.liveHostname}` : "Server"}
                {summary.livePlan ? ` · ${summary.livePlan}` : ""}
                {summary.liveSampledAt
                  ? ` · updated ${new Date(summary.liveSampledAt).toLocaleString("en-IN")}`
                  : ""}
              </span>
              {summary.liveNotes?.[0] ? (
                <span className="w-full text-[11px] font-medium text-emerald-800/80 sm:w-auto">
                  {summary.liveNotes[0]}
                </span>
              ) : null}
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                title: "Total Storage",
                value: `${fmtStorageTb(summary?.usedStorageTb ?? 0)} of ${fmtStorageTb(summary?.totalStorageTb ?? 0)}`,
                sub: `${summary?.usedPct ?? 0}% Used · Hostinger/VPS`,
                pct: summary?.usedPct ?? 0,
                color: "bg-[#A6FF2E]",
                icon: HardDrive,
                iconBg: "bg-emerald-50 text-emerald-600",
              },
              {
                title: "Used Storage",
                value: fmtStorageTb(summary?.usedStorageTb ?? 0),
                sub: summary?.storageTrend || "Live Hostinger/VPS disk",
                icon: TrendingUp,
                iconBg: "bg-sky-50 text-sky-600",
              },
              {
                title: "Free Storage",
                value: `${fmtStorageTb(summary?.freeStorageTb ?? 0)} of ${fmtStorageTb(summary?.totalStorageTb ?? 0)}`,
                sub: `${summary?.freePct ?? 0}% Available · live disk`,
                pct: summary?.freePct ?? 0,
                color: "bg-slate-300",
                icon: Package,
                iconBg: "bg-violet-50 text-violet-600",
              },
              {
                title: "Bandwidth Used",
                value: fmtStorageTb(summary?.bandwidthUsedTb ?? 0),
                sub:
                  summary?.liveSource === "hostinger_api"
                    ? "Live Hostinger bandwidth"
                    : summary?.bandwidthTrend || "Customer totals (set Hostinger API for panel parity)",
                icon: Upload,
                iconBg: "bg-amber-50 text-amber-600",
              },
              {
                title: "Bandwidth Limit",
                value: `${fmtStorageTb(summary?.bandwidthLimitTb ?? 0)} / month`,
                sub: `${summary?.bandwidthPct ?? 0}% Used`,
                pct: summary?.bandwidthPct ?? 0,
                color: "bg-amber-400",
                icon: Layers,
                iconBg: "bg-orange-50 text-orange-600",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                >
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${card.iconBg}`}>
                    <Icon size={16} />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">{card.title}</p>
                  <p className="mt-0.5 text-[18px] font-black leading-tight text-slate-950">{card.value}</p>
                  <p className={`mt-1 text-[10px] font-bold text-slate-500`}>
                    {card.sub}
                  </p>
                  {card.pct !== undefined && (
                    <div className="mt-3">
                      <ProgressBar pct={card.pct} color={card.color} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm xl:col-span-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[13px] font-black text-slate-900">Storage Growth</h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    Last {summary?.growthDays ?? 30} days
                  </p>
                </div>
                <p className="text-[13px] font-black text-slate-900">
                  {fmtStorageTb(summary?.usedStorageTb ?? 0)}
                </p>
              </div>
              {loading ? (
                <div className="py-16 text-center text-[12px] font-semibold text-slate-400">Loading chart...</div>
              ) : (
                <MiniLineChart rows={analytics?.storageGrowth || []} />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm xl:col-span-1">
              <h3 className="text-[13px] font-black text-slate-900">Storage by File Type</h3>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Scanned asset breakdown</p>
              <div className="mt-4">
                {loading ? (
                  <div className="py-12 text-center text-[12px] font-semibold text-slate-400">Scanning files...</div>
                ) : (
                  <FileTypeDonut items={analytics?.fileTypeBreakdown || []} totalBytes={fileTypeTotal} />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm xl:col-span-1">
              <h3 className="text-[13px] font-black text-slate-900">Storage Breakdown</h3>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Total Storage {fmtStorageTb(summary?.totalStorageTb ?? 0)}
              </p>
              <div className="mt-4">
                <DonutChart usedPct={summary?.usedPct ?? 0} freePct={summary?.freePct ?? 0} />
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-semibold text-slate-500">Used</p>
                    <p className="mt-1 font-black text-slate-900">{fmtStorageTb(summary?.usedStorageTb ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-semibold text-slate-500">Free</p>
                    <p className="mt-1 font-black text-slate-900">{fmtStorageTb(summary?.freeStorageTb ?? 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-black text-slate-900">Top Storage Users</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Used</th>
                      <th className="px-4 py-2">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topUsers || []).map((user) => (
                      <tr key={user.customerUid} className="border-b border-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CustomerAvatar name={user.name} seed={user.email} size="sm" />
                            <Link
                              href={`/master-admin/customers/${user.customerUid}`}
                              className="font-bold text-slate-900 hover:text-[#4D9A00]"
                            >
                              {user.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{fmtStorageFromMb(user.usedMB)}</td>
                        <td className="px-4 py-3">
                          <div className="min-w-[90px]">
                            <div className="mb-1 text-[10px] font-bold text-slate-500">{user.platformPct}%</div>
                            <ProgressBar pct={user.platformPct} />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && (data?.topUsers || []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center font-semibold text-slate-400">
                          No storage users yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-black text-slate-900">Largest Files</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2">File</th>
                      <th className="px-4 py-2">Size</th>
                      <th className="px-4 py-2">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.largestFiles || []).map((file) => (
                      <tr key={`${file.customerUid}-${file.fileName}`} className="border-b border-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${fileTypeIconClass(file.fileType)}`}
                            >
                              {file.fileType === "videos" ? <FileVideo size={13} /> : file.fileType === "images" ? <FileImage size={13} /> : <Box size={13} />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">{file.fileName}</p>
                              <p className="truncate text-[10px] font-medium text-slate-400">{file.customerName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{fmtFileSize(file.sizeBytes)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-500">{fmtDateShort(file.uploadedAt)}</td>
                      </tr>
                    ))}
                    {!loading && (data?.largestFiles || []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center font-semibold text-slate-400">
                          No files scanned yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-black text-slate-900">Storage by Plan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2">Plan</th>
                      <th className="px-4 py-2">Used</th>
                      <th className="px-4 py-2">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.storageByPlan || []).map((row) => (
                      <tr key={row.planId} className="border-b border-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{planStorageLabel(row.planId)}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{fmtStorageFromMb(row.usedMB)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-500">{row.customers}</td>
                      </tr>
                    ))}
                    {!loading && (data?.storageByPlan || []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center font-semibold text-slate-400">
                          No plan data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#A6FF2E]/15 text-[#4D9A00]">
                    <Icon size={18} />
                  </div>
                  <h4 className="text-[13px] font-black text-slate-900">{card.title}</h4>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{card.description}</p>
                  {"href" in card && card.href ? (
                    <Link
                      href={card.href}
                      className="mt-4 block w-full rounded-xl border border-slate-200 py-2.5 text-center text-[12px] font-bold text-slate-700 transition hover:border-[#A6FF2E]/60 hover:bg-[#A6FF2E]/5"
                    >
                      {card.button}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={card.action}
                      className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-[12px] font-bold text-slate-700 transition hover:border-[#A6FF2E]/60 hover:bg-[#A6FF2E]/5"
                    >
                      {card.button}
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[300px]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Quick Actions</h3>
            <div className="mt-3 space-y-1">
              {sidebarActions.map((action) => {
                const Icon = action.icon;
                if ("href" in action && action.href) {
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icon size={14} className="text-[#4D9A00]" />
                      {action.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => action.action?.()}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Icon size={14} className="text-[#4D9A00]" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Recent Activities</h3>
            <div className="mt-3 space-y-3">
              {(data?.recentActivities || []).length === 0 ? (
                <p className="text-[12px] font-semibold text-slate-400">No recent activity</p>
              ) : (
                data?.recentActivities.map((activity, index) => (
                  <div key={`${activity.title}-${index}`} className="flex gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Upload size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800">{activity.title}</p>
                      <p className="text-[11px] font-medium text-slate-500">{activity.subtitle}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{fmtDateShort(activity.date)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">All Customers</h3>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search customers..."
              className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[12px] font-medium outline-none focus:border-[#A6FF2E] focus:bg-white"
            />
            <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
              {loading ? (
                <p className="py-6 text-center text-[12px] font-semibold text-slate-400">Loading...</p>
              ) : (
                (data?.items || []).map((item) => (
                  <Link
                    key={item.customer_uid}
                    href={`/master-admin/customers/${item.customer_uid}`}
                    className="block rounded-xl border border-slate-100 p-3 transition hover:border-[#A6FF2E]/40 hover:bg-[#A6FF2E]/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-bold text-slate-900">{item.customer}</p>
                      <span className="shrink-0 text-[11px] font-bold text-slate-600">{item.pct}%</span>
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-slate-400">
                      {fmtStorageFromMb(item.usedMB)} · {item.products} products
                    </p>
                    <div className="mt-2">
                      <ProgressBar pct={item.pct} color={item.pct >= 90 ? "bg-red-500" : item.pct >= 80 ? "bg-amber-400" : "bg-[#A6FF2E]"} />
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <AdminPagination
                page={page}
                totalPages={pagination.totalPages}
                meta={pagination}
                onPageChange={setPage}
                className="border-0 px-0 py-0"
              />
            </div>
          </div>
        </aside>
      </div>

      <OrphanScanModal
        open={orphanModalOpen}
        scan={orphanScan}
        deleting={actionPending}
        onClose={() => {
          setOrphanModalOpen(false);
        }}
        onConfirmDelete={(orphanPaths) => void runStorageAction("delete_orphans", { orphanPaths })}
      />

      <ConfirmModal
        open={confirmAction === "cleanup"}
        title="Run storage cleanup?"
        description="This removes temporary and cache files older than 7 days from customer storage folders."
        confirmText="Run Cleanup"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runStorageAction("cleanup")}
      />
    </div>
  );
}
