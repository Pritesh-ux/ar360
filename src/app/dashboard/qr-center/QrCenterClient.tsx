"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Filter,
  Palette,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Share2,
  SlidersHorizontal,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import StatusBadge from "@/components/user-panel/StatusBadge";
import UserActionMenu from "@/components/user-panel/UserActionMenu";
import UserDateRangePicker, {
  defaultDateRange,
  isDateInRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import QrCodePreview, { downloadQrSvg, type QrPreviewItem } from "@/components/user-panel/QrCodePreview";
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
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draft, setDraft] = useState<QrCodeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("30d"));
  const pageSize = 10;

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
      const params = new URLSearchParams({ status, pageSize: "50", page: "1" });
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
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

  useEffect(() => {
    setPage(1);
  }, [dateRange]);

  useEffect(() => {
    if (selectedId && !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? null);
    }
  }, [filteredItems, selectedId]);

  useEffect(() => {
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

  async function saveDesign() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/qr-codes/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          expiresAt: draft.expiresAt,
          foregroundColor: draft.foregroundColor,
          backgroundColor: draft.backgroundColor,
          patternStyle: draft.patternStyle,
          cornerStyle: draft.cornerStyle,
          logoUrl: draft.logoUrl || null,
          logoSize: draft.logoSize,
          frameEnabled: draft.frameEnabled,
          frameStyle: draft.frameStyle,
          frameColor: draft.frameColor,
          frameText: draft.frameText,
        }),
      });
      if (!res.ok) throw new Error();
      setNotice("QR saved");
      window.setTimeout(() => setNotice(""), 1200);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setNotice(`${label} copied`);
    window.setTimeout(() => setNotice(""), 1200);
  }

  const showingFrom = filteredItems.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredItems.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <UserPageHeader
        title="QR Center"
        subtitle="One permanent QR per published product. The same QR always opens the latest version."
        actions={
          <>
            <label className="relative min-w-[240px] flex-1 sm:min-w-[300px]">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && replaceParams({ q: searchInput.trim() || null })}
                placeholder="Search by product name..."
                className="h-11 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-4 pr-10 text-[14px] font-medium outline-none transition focus:border-[#84D400]"
              />
              <Search
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]"
              />
            </label>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-[14px] border border-[#ECECEC] bg-white text-[#525252] hover:bg-[#FAFAFA]"
              aria-label="Filter"
            >
              <Filter size={18} />
            </button>
            <UserButton
              icon={<QrCode size={16} />}
              onClick={() => router.push("/dashboard/products")}
              className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] hover:bg-[#78C400] shadow-sm"
            >
              Publish Product
            </UserButton>
          </>
        }
      />

      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total QR Codes" value={String(stats.total)} icon={QrCode} />
        <StatCard label="Scans (All Time)" value={stats.totalScans.toLocaleString("en-US")} icon={Eye} />
        <StatCard
          label="This Month Scans"
          value={stats.monthScans.toLocaleString("en-US")}
          icon={Calendar}
        />
        <StatCard label="Active QR Codes" value={String(stats.active)} icon={QrCode} />
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#ECECEC] px-5 pt-1">
          <div className="flex flex-wrap">
            {TABS.map((tab) => {
              const active = status === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => replaceParams({ status: tab.key === "all" ? "all" : tab.key })}
                  className={`relative px-4 py-3.5 text-[13px] font-semibold transition ${
                    active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                  }`}
                >
                  {tab.label}
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <UserDateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#ECECEC] bg-[#FAFAFA] text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5">QR ID</th>
                    <th className="px-5 py-3.5">Scans</th>
                    <th className="px-5 py-3.5">Created On</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-20 text-center text-sm font-medium text-[#737373]">
                        Loading QR codes…
                      </td>
                    </tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-20 text-center">
                        <QrCode size={32} className="mx-auto text-[#D4D4D4]" />
                        <p className="mt-3 text-sm font-semibold text-[#111111]">No QR codes found</p>
                        <p className="mt-1 text-xs font-medium text-[#737373]">
                          Publish a product to auto-generate its Main QR.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => {
                      const active = selected?.id === item.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={`cursor-pointer border-b border-[#ECECEC] transition hover:bg-[#FAFAFA] ${
                            active ? "bg-[#F7FCE8]" : ""
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#F5F5F5]">
                                {item.poster ? (
                                  <img src={item.poster} alt="" className="h-full w-full object-cover" />
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
                          <td className="px-5 py-3.5 font-medium text-[#111111]">{item.qrCode || item.qrUid}</td>
                          <td className="px-5 py-3.5 font-semibold text-[#111111]">
                            {item.scans.toLocaleString("en-US")}
                          </td>
                          <td className="px-5 py-3.5 text-[#737373]">{fmtDate(item.createdAt)}</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge label={item.effectiveStatus} tone={statusTone(item.effectiveStatus)} />
                          </td>
                          <td className="px-5 py-3.5">
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
                                    label: "Copy QR link",
                                    icon: <Copy />,
                                    onClick: () => void copyText(item.qrLinkUrl, "QR link"),
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
                                    label: "Regenerate",
                                    icon: <RefreshCw />,
                                    onClick: async () => {
                                      setSelectedId(item.id);
                                      const res = await fetch(`/api/qr-codes/${item.id}/regenerate`, {
                                        method: "POST",
                                      });
                                      if (!res.ok) {
                                        setNotice("Could not regenerate QR");
                                        window.setTimeout(() => setNotice(""), 1600);
                                        return;
                                      }
                                      setNotice("QR asset regenerated");
                                      window.setTimeout(() => setNotice(""), 1200);
                                      await load();
                                    },
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] px-5 py-3.5 text-[13px] text-[#737373]">
              <span>
                Showing {showingFrom}-{showingTo} of {filteredItems.length} QR codes
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold ${
                        page === n
                          ? "bg-[#84D400] text-[#102000]"
                          : "text-[#737373] hover:bg-[#FAFAFA] hover:text-[#111111]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#ECECEC] bg-white px-2.5 py-1.5 text-sm font-medium">
                  {pageSize}
                  <ChevronDown size={14} className="text-[#A3A3A3]" />
                </label>
              </div>
            </div>
          </div>

          <aside className="flex w-full shrink-0 flex-col border-t border-[#ECECEC] xl:h-auto xl:w-[300px] xl:self-stretch xl:border-l xl:border-t-0">
            {selected && draft && previewItem ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-[#111111]">QR Preview</p>
                  <StatusBadge label={draft.effectiveStatus} tone={statusTone(draft.effectiveStatus)} />
                </div>

                <div className="mt-3 flex justify-center rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-3">
                  <QrCodePreview item={previewItem} size={236} />
                </div>

                <div className="mt-3">
                  <p className="text-[14px] font-semibold text-[#111111]">{draft.title}</p>
                  <p className="mt-0.5 text-[12px] font-medium text-[#737373]">Permanent QR: {draft.qrCode}</p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2">
                    <code className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#525252]">
                      {draft.qrLinkUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyText(draft.qrLinkUrl, "QR link")}
                      className="shrink-0 text-[#737373] hover:text-[#111111]"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <UserButton
                    className="h-10 w-full rounded-xl bg-[#84D400] text-[13px] font-semibold text-[#102000] hover:bg-[#78C400]"
                    icon={<Download size={15} />}
                    onClick={() => downloadQrSvg(previewItem, `${draft.title}-qr.svg`)}
                  >
                    Download QR
                  </UserButton>
                  <UserButton
                    variant="outline"
                    className="h-10 w-full rounded-xl text-[13px] font-semibold"
                    icon={<Eye size={15} />}
                    onClick={() => window.open(draft.destinationUrl, "_blank")}
                  >
                    View AR
                  </UserButton>
                </div>

                <div className="mt-3 space-y-0.5 border-t border-[#ECECEC] pt-3">
                  <OptionRow
                    icon={Palette}
                    title="Customize QR Design"
                    subtitle="Change colors, logo and frame style."
                    onClick={() => draft && router.push(`/dashboard/qr-center/${draft.id}`)}
                  />
                  {!draft.hasPngAsset ? (
                    <OptionRow
                      icon={RefreshCw}
                      title="Regenerate QR"
                      subtitle="Rebuild the PNG for this permanent QR URL."
                      onClick={async () => {
                        await fetch(`/api/qr-codes/${draft.id}/regenerate`, { method: "POST" });
                        setNotice("QR asset regenerated");
                        window.setTimeout(() => setNotice(""), 1200);
                        await load();
                      }}
                    />
                  ) : null}
                </div>

                {customizeOpen ? (
                  <div className="mt-3 space-y-3 rounded-[14px] border border-[#ECECEC] bg-white p-3">
                    <label className="block text-xs font-semibold text-[#737373]">
                      QR name
                      <input
                        className="mt-1 h-9 w-full rounded-lg border border-[#ECECEC] bg-white px-2 text-sm"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-[#737373]">
                        QR color
                        <input
                          type="color"
                          className="mt-1 h-9 w-full rounded-lg border border-[#ECECEC] bg-white"
                          value={draft.foregroundColor}
                          onChange={(e) => setDraft({ ...draft, foregroundColor: e.target.value.toUpperCase() })}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-[#737373]">
                        Background
                        <input
                          type="color"
                          className="mt-1 h-9 w-full rounded-lg border border-[#ECECEC] bg-white"
                          value={draft.backgroundColor}
                          onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value.toUpperCase() })}
                        />
                      </label>
                    </div>
                    <UserButton
                      loading={saving}
                      icon={<Save size={16} />}
                      className="h-10 w-full rounded-2xl bg-[#84D400] font-semibold text-[#102000]"
                      onClick={() => void saveDesign()}
                    >
                      Save QR changes
                    </UserButton>
                  </div>
                ) : null}
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
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  icon: typeof QrCode;
  trend?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF9E0] text-[#84D400]">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">{label}</p>
          <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-[#111111]">{value}</p>
          {trend ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#5FA800]">
              <TrendingUp size={12} />
              {trend}
            </p>
          ) : null}
        </div>
      </div>
    </div>
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
}: {
  icon: typeof Palette;
  title: string;
  subtitle: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-1 py-2 text-left transition hover:bg-[#FAFAFA]"
    >
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#ECECEC] bg-white ${
          danger ? "text-red-500" : "text-[#737373]"
        }`}
      >
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-semibold leading-tight ${danger ? "text-red-600" : "text-[#111111]"}`}>
          {title}
        </p>
        <p className="text-[11px] font-medium text-[#737373]">{subtitle}</p>
      </div>
      <ChevronRight size={15} className="shrink-0 text-[#A3A3A3]" />
    </button>
  );
}
