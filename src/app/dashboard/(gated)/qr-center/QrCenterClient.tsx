"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppImage from "@/components/shared/AppImage";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Palette,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import UserStatCard from "@/components/user-panel/UserStatCard";
import StatusBadge from "@/components/user-panel/StatusBadge";
import UserActionMenu from "@/components/user-panel/UserActionMenu";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  isDateInRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import QrCodePreview, { downloadQrSvg, type QrPreviewItem } from "@/components/user-panel/QrCodePreview";
import { panelTable, panelTableRowClass } from "@/components/user-panel/panel-table";
import type { QrCodeRecord, QrStatusFilter } from "@/lib/user-panel/qr-codes.service";

const TABS: { key: QrStatusFilter | "all"; label: string }[] = [
  { key: "all", label: "All QR Codes" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "archived", label: "Archived" },
];

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusTone(status: string): "success" | "warning" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "expired") return "warning";
  if (status === "processing") return "info";
  return "neutral";
}

function withOpenAr(url: string) {
  try {
    const next = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    next.searchParams.set("openAR", "1");
    return next.toString();
  } catch {
    return url.includes("?") ? `${url}&openAR=1` : `${url}?openAR=1`;
  }
}

function qrPreviewFromItem(item: QrCodeRecord): QrPreviewItem {
  return {
    id: item.id,
    productId: item.productId,
    destinationUrl: item.destinationUrl,
    foregroundColor: item.foregroundColor,
    backgroundColor: item.backgroundColor,
    patternStyle: item.patternStyle,
    cornerStyle: item.cornerStyle,
    logoUrl: item.logoUrl,
    logoSize: item.logoSize,
    frameEnabled: item.frameEnabled,
    frameStyle: item.frameStyle,
    frameColor: item.frameColor,
    frameText: item.frameText,
  };
}

export default function QrCenterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") as QrStatusFilter) || "all";
  const q = searchParams.get("q") || "";
  const productIdFilter = searchParams.get("productId") || "";

  const [items, setItems] = useState<QrCodeRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, totalScans: 0, monthScans: 0, active: 0, expired: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState(q);
  const [draft, setDraft] = useState<QrCodeRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("30d"));
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(10);

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      });
      router.replace(`/dashboard/qr-center?${next.toString()}`);
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, pageSize: "200", page: "1" });
      if (q) params.set("q", q);
      if (productIdFilter) params.set("productId", productIdFilter);
      const res = await fetch(`/api/qr-codes?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setItems(data.qrCodes || []);
      setStats(data.stats || { total: 0, totalScans: 0, monthScans: 0, active: 0, expired: 0, archived: 0 });
      if (data.qrCodes?.[0]) setSelectedId((prev) => prev ?? data.qrCodes[0].id);
      setPage(1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, q, productIdFilter]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  useDeferredEffect(() => {
    setSearchInput(q);
  }, [q]);

  const filteredItems = useMemo(
    () => items.filter((item) => isDateInRange(item.createdAt, dateRange)),
    [items, dateRange],
  );

  const selected = useMemo(
    () => filteredItems.find((x) => x.id === selectedId) || filteredItems[0] || null,
    [filteredItems, selectedId],
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const mobileItems = useMemo(
    () => filteredItems.slice(0, mobileVisibleCount),
    [filteredItems, mobileVisibleCount],
  );

  useDeferredEffect(() => {
    setPage(1);
    setMobileVisibleCount(10);
  }, [dateRange, status, q, productIdFilter]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setMobileVisibleCount((prev) => {
          if (prev >= filteredItems.length) return prev;
          return Math.min(prev + 10, filteredItems.length);
        });
      },
      { root: null, rootMargin: "160px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filteredItems.length, mobileVisibleCount]);

  useDeferredEffect(() => {
    if (selectedId && !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? null);
    }
  }, [filteredItems, selectedId]);

  useDeferredEffect(() => {
    if (selected) setDraft({ ...selected });
  }, [selected]);

  const previewItem: QrPreviewItem | null = draft
    ? {
        id: draft.id,
        productId: draft.productId,
        destinationUrl: draft.destinationUrl,
        foregroundColor: draft.foregroundColor,
        backgroundColor: draft.backgroundColor,
        patternStyle: draft.patternStyle,
        cornerStyle: draft.cornerStyle,
        logoUrl: draft.logoUrl,
        logoSize: draft.logoSize,
        frameEnabled: draft.frameEnabled,
        frameStyle: draft.frameStyle,
        frameColor: draft.frameColor,
        frameText: draft.frameText,
      }
    : null;

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setNotice(`${label} copied`);
    window.setTimeout(() => setNotice(""), 1200);
  }

  async function regenerateQr(id: number) {
    if (regeneratingId !== null) return;
    setRegeneratingId(id);
    setSelectedId(id);
    try {
      const res = await fetch(`/api/qr-codes/${id}/regenerate`, { method: "POST" });
      if (!res.ok) {
        setNotice("Could not regenerate QR");
        window.setTimeout(() => setNotice(""), 1600);
        return;
      }
      setNotice("QR asset regenerated");
      window.setTimeout(() => setNotice(""), 1200);
      await load();
    } finally {
      setRegeneratingId(null);
    }
  }

  const showingFrom = filteredItems.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredItems.length);

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="QR Center"
        subtitle="One permanent QR per published product. The same QR always opens the latest version."
        actions={
          <>
            <div className="dash-products-search min-w-0 flex-1 sm:min-w-[300px]">
              <Search size={16} className="dash-products-search__icon" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && replaceParams({ q: searchInput.trim() || null })}
                placeholder="Search by product name..."
                className="dash-products-input dash-products-input--icon"
              />
            </div>
            <UserFilterDropdown
              label="Status"
              hideLabel
              compact
              value={status}
              options={TABS.map((tab) => tab.key)}
              onChange={(value) => {
                replaceParams({ status: value === "all" ? "all" : value });
                setPage(1);
              }}
              renderValue={(value) => TABS.find((tab) => tab.key === value)?.label || value}
              renderOption={(value) => TABS.find((tab) => tab.key === value)?.label || value}
              className="hidden shrink-0 md:block"
            />
            <UserButton
              icon={<QrCode size={16} />}
              onClick={() => router.push("/dashboard/products")}
              className="h-11 shrink-0 rounded-2xl bg-[#84D400] px-4 font-semibold text-[#102000] shadow-sm hover:bg-[#78C400] sm:px-5"
            >
              <span className="sm:hidden">Publish</span>
              <span className="hidden sm:inline">Publish Product</span>
            </UserButton>
          </>
        }
      />

      <section className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <UserStatCard dense label="Total QR Codes" value={String(stats.total)} icon={QrCode} accent="lime" />
        <UserStatCard dense label="Scans (All Time)" value={stats.totalScans.toLocaleString("en-US")} icon={Eye} accent="sky" />
        <UserStatCard
          dense
          label="This Month Scans"
          value={stats.monthScans.toLocaleString("en-US")}
          icon={Calendar}
          accent="amber"
        />
        <UserStatCard dense label="Active QR Codes" value={String(stats.active)} icon={QrCode} accent="violet" />
      </section>

      <section className="flex min-h-[480px] w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden dash-premium-card md:min-h-[640px]">
        <div className="flex shrink-0 flex-col gap-2 border-b border-[#ECECEC] px-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-5">
          <div className="-mx-1 flex overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {TABS.map((tab) => {
              const active = status === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => replaceParams({ status: tab.key === "all" ? "all" : tab.key })}
                  className={`relative shrink-0 whitespace-nowrap px-3 py-3 text-[12px] font-semibold transition sm:px-4 sm:py-3.5 sm:text-[13px] ${
                    active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                  }`}
                >
                  {tab.key === "all" ? (
                    <>
                      <span className="sm:hidden">All</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </>
                  ) : (
                    tab.label
                  )}
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <UserDateRangePicker compact value={dateRange} onChange={setDateRange} className="mb-2 w-full sm:mb-0 sm:w-auto" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {loading ? (
              <UserWorkspaceLoading
                className="min-h-[420px]"
                label="Loading QR Codes"
                hint="Please wait while we load your QR codes..."
              />
            ) : paginatedItems.length === 0 ? (
              <div className="flex min-h-[420px] flex-1 items-center justify-center px-5 py-12">
                <div className="text-center">
                  <QrCode size={32} className="mx-auto text-[#D4D4D4]" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-[#111111]">No QR codes yet</p>
                  <p className="mt-1 text-xs font-medium text-[#737373]">
                    Publish a product first — its Main QR appears here automatically.
                  </p>
                </div>
              </div>
            ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              {/* Desktop table */}
              <div className="hidden md:block">
              <table className={`${panelTable.table} min-w-[720px]`}>
                <thead>
                  <tr className={panelTable.theadRow}>
                    <th className={panelTable.th}>Product</th>
                    <th className={panelTable.th}>QR ID</th>
                    <th className={panelTable.th}>Scans</th>
                    <th className={panelTable.th}>Created On</th>
                    <th className={panelTable.th}>Status</th>
                    <th className={panelTable.thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => {
                      const active = selected?.id === item.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={panelTableRowClass({ active, clickable: true })}
                        >
                          <td className={panelTable.td}>
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#F5F5F5]">
                                {item.poster ? (
                                  <AppImage src={item.poster} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="grid h-full place-items-center text-[#A3A3A3]">
                                    <Box size={18} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[#111111]">{item.title}</p>
                                <p className="truncate text-xs text-[#737373]">{item.productStatus || "Product"}</p>
                              </div>
                            </div>
                          </td>
                          <td className={`${panelTable.td} font-medium text-[#111111]`}>{item.qrCode || item.qrUid}</td>
                          <td className={panelTable.tdStrong}>
                            {item.scans.toLocaleString("en-US")}
                          </td>
                          <td className={panelTable.tdMuted}>{fmtDate(item.createdAt)}</td>
                          <td className={panelTable.td}>
                            <StatusBadge label={item.effectiveStatus} tone={statusTone(item.effectiveStatus)} />
                          </td>
                          <td className={panelTable.td}>
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <IconBtn
                                icon={Download}
                                title="Download"
                                accent
                                onClick={() => downloadQrSvg(qrPreviewFromItem(item), `${item.title}-qr.svg`)}
                              />
                              <IconBtn
                                icon={Eye}
                                title="View"
                                onClick={() => window.open(item.destinationUrl, "_blank", "noopener,noreferrer")}
                              />
                              <UserActionMenu
                                items={[
                                  {
                                    label: "View",
                                    icon: <Eye />,
                                    onClick: () =>
                                      window.open(item.destinationUrl, "_blank", "noopener,noreferrer"),
                                  },
                                  {
                                    label: "View in AR",
                                    icon: <Smartphone />,
                                    onClick: () =>
                                      window.open(withOpenAr(item.destinationUrl), "_blank", "noopener,noreferrer"),
                                  },
                                  {
                                    label: "Copy public link",
                                    icon: <Copy />,
                                    onClick: () => void copyText(item.destinationUrl, "Public link"),
                                  },
                                  {
                                    label: "Customize",
                                    icon: <Palette />,
                                    onClick: () => router.push(`/dashboard/qr-center/${item.id}`),
                                  },
                                  {
                                    label: "Download",
                                    icon: <Download />,
                                    onClick: () =>
                                      downloadQrSvg(qrPreviewFromItem(item), `${item.title}-qr.svg`),
                                  },
                                  {
                                    label: regeneratingId === item.id ? "Regenerating…" : "Regenerate",
                                    icon: <RefreshCw className={regeneratingId === item.id ? "animate-spin" : undefined} />,
                                    onClick: () => void regenerateQr(item.id),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-3 md:hidden">
                {mobileItems.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <article
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={[
                        "rounded-[18px] border border-[#ECECEC] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.06)]",
                        active ? "ring-2 ring-[#C8FF46]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-white ring-1 ring-[#ECECEC]">
                          {item.poster ? (
                            <AppImage
                              src={item.poster}
                              alt=""
                              className="h-full w-full bg-white object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center bg-white text-[#A3A3A3]">
                              <QrCode size={22} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold text-[#111111]">{item.title}</p>
                              <p className="mt-0.5 truncate text-[12px] font-medium text-[#737373]">
                                {item.qrCode || item.qrUid}
                              </p>
                              <p className="mt-2 text-[12px] font-medium text-[#6B7280]">
                                {item.scans.toLocaleString("en-US")} scans · {fmtDate(item.createdAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-start gap-1" onClick={(e) => e.stopPropagation()}>
                              <StatusBadge label={item.effectiveStatus} tone={statusTone(item.effectiveStatus)} />
                              <UserActionMenu
                                align="right"
                                triggerVariant="plain"
                                iconOrientation="vertical"
                                triggerProps={{ "aria-label": `Actions for ${item.title}` }}
                                items={[
                                  {
                                    label: "Download",
                                    icon: <Download />,
                                    onClick: () =>
                                      downloadQrSvg(qrPreviewFromItem(item), `${item.title}-qr.svg`),
                                  },
                                  {
                                    label: "View AR",
                                    icon: <Smartphone />,
                                    onClick: () =>
                                      window.open(
                                        withOpenAr(item.destinationUrl),
                                        "_blank",
                                        "noopener,noreferrer",
                                      ),
                                  },
                                  {
                                    label: "Copy public link",
                                    icon: <Copy />,
                                    onClick: () => void copyText(item.destinationUrl, "Public link"),
                                  },
                                  {
                                    label: "Customize",
                                    icon: <Palette />,
                                    onClick: () => router.push(`/dashboard/qr-center/${item.id}`),
                                  },
                                ]}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {mobileVisibleCount < filteredItems.length ? (
                  <div ref={loadMoreSentinelRef} className="h-8" aria-hidden />
                ) : null}
              </div>
            </div>
            )}

            <div className="relative z-20 hidden shrink-0 flex-wrap items-center justify-between gap-3 overflow-visible border-t border-[#ECECEC] px-5 py-3.5 text-[13px] text-[#737373] md:flex">
              <span>
                Showing {showingFrom}-{showingTo} of {filteredItems.length} QR codes
              </span>
              <div className="relative z-20 flex flex-wrap items-center gap-2 overflow-visible">
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold ${
                        page === n
                          ? "bg-[#B6FF38] text-[#102000]"
                          : "text-[#737373] hover:bg-[#FAFAFA] hover:text-[#111111]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <UserFilterDropdown
                  label="Rows"
                  menuTitle="Rows per page"
                  hideLabel
                  size="sm"
                  preferAbove
                  menuWidth={128}
                  className="w-[4.5rem] shrink-0"
                  value={String(pageSize)}
                  options={["10", "25", "50"]}
                  onChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <aside className="hidden w-full min-w-0 shrink-0 flex-col border-t border-[#ECECEC] xl:flex xl:h-auto xl:w-[min(280px,28%)] xl:max-w-[280px] xl:self-stretch xl:border-l xl:border-t-0">
            {selected && draft && previewItem ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-[#111111]">QR Preview</p>
                  <StatusBadge label={draft.effectiveStatus} tone={statusTone(draft.effectiveStatus)} />
                </div>

                <div className="mt-3 flex justify-center rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-2.5">
                  <QrCodePreview item={previewItem} size={200} />
                </div>

                <div className="mt-3">
                  <p className="text-[14px] font-semibold text-[#111111]">{draft.title}</p>
                  <p className="mt-0.5 text-[12px] font-medium text-[#737373]">Permanent QR: {draft.qrCode}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#737373]">
                    Public link
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2">
                    <code className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#525252]">
                      {draft.destinationUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyText(draft.destinationUrl, "Public link")}
                      className="shrink-0 text-[#737373] hover:text-[#111111]"
                      title="Copy public link"
                      aria-label="Copy public link"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid min-w-0 grid-cols-1 gap-2">
                  <UserButton
                    className="h-10 w-full min-w-0 rounded-xl bg-[#84D400] text-[13px] font-semibold text-[#102000] hover:bg-[#78C400]"
                    icon={<Download size={15} />}
                    onClick={() => downloadQrSvg(previewItem, `${draft.title}-qr.svg`)}
                  >
                    Download QR
                  </UserButton>
                  <UserButton
                    variant="outline"
                    className="h-10 w-full min-w-0 rounded-xl text-[13px] font-semibold"
                    icon={<Eye size={15} />}
                    onClick={() => window.open(draft.destinationUrl, "_blank")}
                  >
                    View AR
                  </UserButton>
                </div>

                <div className="mt-3 min-w-0 space-y-2">
                  <OptionRow
                    icon={Palette}
                    title="Customize QR Design"
                    accent
                    onClick={() => draft && router.push(`/dashboard/qr-center/${draft.id}`)}
                  />
                  {!draft.hasPngAsset ? (
                    <OptionRow
                      icon={RefreshCw}
                      title="Regenerate QR"
                      subtitle="Rebuild the PNG for this permanent QR URL."
                      disabled={regeneratingId === draft.id}
                      loading={regeneratingId === draft.id}
                      onClick={() => void regenerateQr(draft.id)}
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-medium text-[#737373]">
                Select a QR code to preview
              </div>
            )}
          </aside>
        </div>
      </section>

      {notice ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <Check size={16} />
          {notice}
        </div>
      ) : null}
    </UserPanelPageShell>
  );
}

function IconBtn({
  icon: Icon,
  title,
  onClick,
  accent,
}: {
  icon: typeof Download;
  title: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`grid h-8 w-8 place-items-center rounded-full border transition ${
        accent
          ? "border-[#C8E899] bg-[#EEF9E0] text-[#5FA800] hover:bg-[#E5F5D4]"
          : "border-[#D4D4D4] bg-white text-[#525252] hover:bg-[#FAFAFA]"
      }`}
    >
      <Icon size={15} />
    </button>
  );
}

function OptionRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  danger,
  accent,
  disabled,
  loading,
}: {
  icon: typeof Palette;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        accent
          ? "border border-transparent bg-[#84D400] py-2.5 text-[#102000] hover:bg-[#78C400]"
          : "border border-transparent py-2 hover:bg-[#FAFAFA]"
      }`}
    >
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          accent
            ? "bg-white/90 text-[#102000]"
            : danger
              ? "border border-[#ECECEC] bg-white text-red-500"
              : "border border-[#ECECEC] bg-white text-[#737373]"
        }`}
      >
        <Icon size={15} className={loading ? "animate-spin" : undefined} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] font-semibold leading-tight ${
            danger ? "text-red-600" : accent ? "text-[#102000]" : "text-[#111111]"
          }`}
        >
          {title}
        </p>
        {subtitle ? (
          <p className={`mt-0.5 text-[11px] font-medium ${accent ? "text-[#102000]/80" : "text-[#737373]"}`}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <ChevronRight size={15} className={`shrink-0 ${accent ? "text-[#102000]" : "text-[#A3A3A3]"}`} />
    </button>
  );
}
