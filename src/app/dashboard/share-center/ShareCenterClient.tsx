"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Link2,
  Mail,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  Share2,
  Smartphone,
  TrendingUp,
  Users,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import StatusBadge from "@/components/user-panel/StatusBadge";
import UserActionMenu from "@/components/user-panel/UserActionMenu";
import type { ShareLinkRecord, ShareLinkType, ShareStatusFilter } from "@/lib/user-panel/share-links.service";

const TABS: { key: ShareStatusFilter | "all" | "analytics"; label: string }[] = [
  { key: "all", label: "All Shares" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "analytics", label: "Analytics" },
];

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function typeLabel(type: ShareLinkType) {
  if (type === "embed") return "Embed";
  if (type === "email") return "Email";
  return "Public Link";
}

function typeBadgeClass(type: ShareLinkType) {
  if (type === "embed") return "bg-violet-50 text-violet-700";
  if (type === "email") return "bg-slate-100 text-slate-600";
  return "bg-[#EEF9E0] text-[#5FA800]";
}

function statusTone(status: string): "success" | "warning" | "neutral" | "danger" {
  if (status === "active") return "success";
  if (status === "expired") return "danger";
  if (status === "archived" || status === "disabled") return "neutral";
  return "neutral";
}

function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
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

export default function ShareCenterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") as ShareStatusFilter) || "all";
  const q = searchParams.get("q") || "";
  const productId = searchParams.get("productId") || "";

  const [items, setItems] = useState<ShareLinkRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, totalViews: 0, active: 0, expired: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState(q);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [typeFilter, setTypeFilter] = useState<ShareLinkType | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      });
      router.replace(`/dashboard/share-center?${next.toString()}`);
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, pageSize: "50", page: "1" });
      if (q) params.set("q", q);
      if (productId) params.set("productId", productId);
      const res = await fetch(`/api/share-links?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setItems(data.shareLinks || []);
      setStats(data.stats || { total: 0, totalViews: 0, active: 0, expired: 0, archived: 0 });
      if (data.shareLinks?.[0]) setSelectedId((prev) => prev ?? data.shareLinks[0].id);
      setPage(1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, q, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const filteredItems = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((item) => item.linkType === typeFilter);
  }, [items, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const selected = useMemo(
    () => filteredItems.find((x) => x.id === selectedId) || filteredItems[0] || items[0] || null,
    [filteredItems, items, selectedId],
  );

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setNotice(`${label} copied`);
    window.setTimeout(() => setNotice(""), 1200);
  }

  const showingFrom = filteredItems.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredItems.length);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <UserPageHeader
        title="Share Center"
        subtitle="Manage and track all your shared 3D models and links."
        actions={
          <>
            <label className="relative min-w-[240px] flex-1 sm:min-w-[300px]">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && replaceParams({ q: searchInput.trim() || null })}
                placeholder="Search by product name or link..."
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
              icon={<Plus size={16} />}
              onClick={() => setCreateOpen(true)}
              className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] hover:bg-[#78C400] shadow-sm"
            >
              Create Share Link
            </UserButton>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Shares"
          value={String(stats.total)}
          sub="All time"
          icon={Link2}
          iconClass="bg-[#EEF9E0] text-[#84D400]"
        />
        <StatCard
          label="Total Views"
          value={stats.totalViews.toLocaleString("en-US")}
          trend="↑ 18% vs last month"
          icon={Eye}
          iconClass="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="QR Scans"
          value="—"
          trend="↑ 14% vs last month"
          icon={QrCode}
          iconClass="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="Active Links"
          value={String(stats.active)}
          sub="Currently active"
          icon={Share2}
          iconClass="bg-orange-50 text-orange-600"
        />
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECECEC] px-5 pt-1">
          <div className="flex flex-wrap">
            {TABS.map((tab) => {
              const active = tab.key !== "analytics" && status === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    if (tab.key === "analytics") {
                      router.push("/dashboard/analytics");
                      return;
                    }
                    replaceParams({ status: tab.key });
                  }}
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
          <label className="mb-2 inline-flex items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 py-2 text-[13px] font-medium text-[#525252]">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as ShareLinkType | "all");
                setPage(1);
              }}
              className="bg-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="public">Public Link</option>
              <option value="embed">Embed</option>
              <option value="email">Email</option>
            </select>
            <ChevronDown size={15} className="text-[#A3A3A3]" />
          </label>
        </div>

        <div className="flex min-h-[620px] flex-col xl:flex-row">
          <div className="min-w-0 flex-1">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#ECECEC] bg-[#FAFAFA] text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                    <th className="px-5 py-3.5">Item</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Share Link / QR</th>
                    <th className="px-5 py-3.5">Views &amp; QR Scans</th>
                    <th className="px-5 py-3.5">Created On</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-20 text-center text-sm font-medium text-[#737373]">
                        Loading share links…
                      </td>
                    </tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-20 text-center">
                        <Share2 size={32} className="mx-auto text-[#D4D4D4]" />
                        <p className="mt-3 text-sm font-semibold text-[#111111]">No share links yet</p>
                        <UserButton
                          className="mt-4 rounded-2xl bg-[#84D400] font-semibold text-[#102000]"
                          icon={<Plus size={16} />}
                          onClick={() => setCreateOpen(true)}
                        >
                          Create first link
                        </UserButton>
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
                                <p className="truncate text-xs text-[#737373]">{item.label || "Collection"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${typeBadgeClass(item.linkType)}`}
                            >
                              {typeLabel(item.linkType)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {item.linkType === "embed" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyText(item.embedCode || item.shareUrl, "Embed");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#ECECEC] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#FAFAFA]"
                              >
                                Embed code
                                <Copy size={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyText(item.shareUrl, "Link");
                                }}
                                className="inline-flex max-w-[190px] items-center gap-1.5 rounded-lg border border-[#ECECEC] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#FAFAFA]"
                              >
                                <span className="truncate">{shortUrl(item.shareUrl)}</span>
                                <Copy size={12} />
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-[#111111]">{item.viewCount.toLocaleString("en-US")}</div>
                            <div className="text-xs text-[#737373]">—</div>
                          </td>
                          <td className="px-5 py-3.5 text-[#737373]">{fmtDate(item.createdAt)}</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge label={item.effectiveStatus} tone={statusTone(item.effectiveStatus)} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
                              <UserActionMenu
                                items={[
                                  {
                                    label: "View",
                                    icon: <Eye />,
                                    onClick: () =>
                                      window.open(item.shareUrl, "_blank", "noopener,noreferrer"),
                                  },
                                  {
                                    label: "View in AR",
                                    icon: <Smartphone />,
                                    onClick: () =>
                                      window.open(
                                        withOpenAr(item.destinationUrl || item.shareUrl),
                                        "_blank",
                                        "noopener,noreferrer",
                                      ),
                                  },
                                  {
                                    label: "Copy link",
                                    icon: <Copy />,
                                    onClick: () => void copyText(item.shareUrl, "Link"),
                                  },
                                  ...(item.linkType === "embed" && item.embedCode
                                    ? [
                                        {
                                          label: "Copy embed",
                                          icon: <Link2 />,
                                          onClick: () => void copyText(item.embedCode || "", "Embed"),
                                        },
                                      ]
                                    : []),
                                  {
                                    label: "Open QR Center",
                                    icon: <QrCode />,
                                    href: "/dashboard/qr-center",
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] px-5 py-3.5 text-[13px] text-[#737373]">
              <span>
                Showing {showingFrom} to {showingTo} of {filteredItems.length} shares
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

          <aside className="w-full shrink-0 border-t border-[#ECECEC] xl:w-[340px] xl:border-l xl:border-t-0">
            {selected ? (
              <div className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-[#111111]">Preview</p>
                  <StatusBadge label={selected.effectiveStatus} tone={statusTone(selected.effectiveStatus)} />
                </div>

                <div className="mt-4 overflow-hidden rounded-[16px] border border-[#ECECEC] bg-[#FAFAFA]">
                  {selected.poster ? (
                    <img src={selected.poster} alt="" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="grid h-44 place-items-center text-[#D4D4D4]">
                      <Box size={36} />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-[15px] font-semibold text-[#111111]">{selected.title}</p>
                  <p className="text-xs font-medium text-[#737373]">{selected.label || "Collection"}</p>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2.5">
                  <code className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#525252]">
                    {selected.shareUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyText(selected.shareUrl, "Link")}
                    className="shrink-0 text-[#737373] hover:text-[#111111]"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <UserButton
                    className="h-11 w-full rounded-2xl bg-[#84D400] font-semibold text-[#102000] hover:bg-[#78C400]"
                    icon={<ExternalLink size={16} />}
                    onClick={() => window.open(selected.shareUrl, "_blank", "noopener,noreferrer")}
                  >
                    Open Link
                  </UserButton>
                  <UserButton
                    variant="outline"
                    className="h-11 w-full rounded-2xl font-semibold"
                    icon={<Smartphone size={16} />}
                    onClick={() =>
                      window.open(
                        withOpenAr(selected.destinationUrl || selected.shareUrl),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    View in AR
                  </UserButton>
                </div>

                <div className="mt-5">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                    Share options
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {[Link2, QrCode, Share2, Mail, MoreHorizontal].map((Icon, i) => (
                      <button
                        key={i}
                        type="button"
                        className="grid h-10 place-items-center rounded-xl border border-[#ECECEC] bg-white text-[#525252] hover:bg-[#FAFAFA]"
                      >
                        <Icon size={16} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                    Analytics (All Time)
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <AnalyticsRow icon={Eye} label="Total Views" value={selected.viewCount.toLocaleString("en-US")} />
                    <AnalyticsRow icon={QrCode} label="QR Scans" value="—" />
                    <AnalyticsRow icon={Clock} label="Avg. View Duration" value="—" />
                    <AnalyticsRow icon={Users} label="Unique Viewers" value="—" />
                  </div>
                </div>

                <Link
                  href="/dashboard/analytics"
                  className="mt-4 text-sm font-semibold text-[#84D400] hover:text-[#5FA800]"
                >
                  View Full Analytics →
                </Link>

                {selected.embedCode ? (
                  <div className="mt-4">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">Embed code</p>
                    <pre className="max-h-24 overflow-auto rounded-lg border border-[#ECECEC] bg-white p-2 text-[10px] text-[#525252]">
                      {selected.embedCode}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid h-full min-h-[320px] place-items-center p-8 text-center text-sm font-medium text-[#737373]">
                Select a share link to preview
              </div>
            )}
          </aside>
        </div>
      </section>

      {createOpen ? (
        <CreateShareModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      ) : null}

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
  iconClass,
  sub,
  trend,
}: {
  label: string;
  value: string;
  icon: typeof Share2;
  iconClass: string;
  sub?: string;
  trend?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">{label}</p>
          <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-[#111111]">{value}</p>
          {sub ? <p className="mt-1.5 text-xs font-medium text-[#737373]">{sub}</p> : null}
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

function AnalyticsRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-[#737373]">
        <Icon size={14} className="text-[#A3A3A3]" />
        {label}
      </span>
      <span className="font-semibold text-[#111111]">{value}</span>
    </div>
  );
}

function CreateShareModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [products, setProducts] = useState<{ id: string; title: string }[]>([]);
  const [form, setForm] = useState({ productId: "", linkType: "public" as ShareLinkType, slug: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/products?pageSize=50")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }, []);

  async function submit() {
    if (!form.productId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: form.productId, linkType: form.linkType, slug: form.slug || null }),
      });
      if (!res.ok) throw new Error();
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#111111]">Create Share Link</h2>
        <div className="mt-4 space-y-3">
          <select
            className="h-10 w-full rounded-xl border border-[#ECECEC] px-3 text-sm font-medium"
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
          >
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-xl border border-[#ECECEC] px-3 text-sm font-medium"
            value={form.linkType}
            onChange={(e) => setForm({ ...form, linkType: e.target.value as ShareLinkType })}
          >
            <option value="public">Public Link</option>
            <option value="embed">Embed</option>
            <option value="email">Email</option>
          </select>
          <input
            className="h-10 w-full rounded-xl border border-[#ECECEC] px-3 text-sm font-medium"
            placeholder="Label (optional)"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <UserButton variant="outline" onClick={onClose}>
            Cancel
          </UserButton>
          <UserButton
            loading={saving}
            disabled={!form.productId}
            className="bg-[#84D400] text-[#102000]"
            onClick={() => void submit()}
          >
            Create
          </UserButton>
        </div>
      </div>
    </div>
  );
}
