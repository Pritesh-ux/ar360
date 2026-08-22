"use client";

import Link from "next/link";
import AppImage from "@/components/shared/AppImage";
import { useEffect, useCallback, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Check,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Mail,
  Plus,
  QrCode,
  Search,
  Share2,
  Smartphone,
  Users,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import ViewportPortal from "@/components/shared/ViewportPortal";
import UserStatCard from "@/components/user-panel/UserStatCard";
import StatusBadge from "@/components/user-panel/StatusBadge";
import UserActionMenu from "@/components/user-panel/UserActionMenu";
import { panelTable, panelTableRowClass } from "@/components/user-panel/panel-table";
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

function typeHint(type: ShareLinkType) {
  if (type === "embed") return "Paste on your website";
  if (type === "email") return "For email campaigns";
  return "WhatsApp, email, social";
}

function copyActionLabel(type: ShareLinkType) {
  return type === "embed" ? "Copy code" : "Copy link";
}

const SHARE_TYPE_OPTIONS: { value: ShareLinkType; title: string; desc: string }[] = [
  {
    value: "public",
    title: "Public Link",
    desc: "Copy a URL and send it on WhatsApp, email, or social. Anyone with the link can open the 3D viewer.",
  },
  {
    value: "embed",
    title: "Embed",
    desc: "Copy iframe code and paste it on your website, Shopify, or blog. The 3D viewer shows on your page.",
  },
  {
    value: "email",
    title: "Email",
    desc: "A tracked link meant for email campaigns and newsletters.",
  },
];

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

function ShareCopyChip({
  label,
  hint,
  copyLabel,
  onCopy,
  wide,
  className = "",
}: {
  label: string;
  hint?: string;
  copyLabel: string;
  onCopy: () => void | Promise<void>;
  wide?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div
      className={`flex min-w-0 ${wide ? "w-full flex-col items-stretch gap-2" : "max-w-[280px] items-center gap-2"} ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-[#111111]">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] font-medium text-[#737373]">{hint}</p> : null}
      </div>
      <button
        type="button"
        title={copyLabel}
        aria-label={copyLabel}
        onClick={() => void handleCopy()}
        className={`share-copy-btn inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${
          wide ? "h-9 w-full" : "h-8"
        }`}
      >
        {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2.25} />}
        {copied ? "Copied" : copyLabel}
      </button>
    </div>
  );
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
  const [pageSize, setPageSize] = useState(10);

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

  useDeferredEffect(() => {
    void load();
  }, [load]);

  useDeferredEffect(() => {
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

  async function copyText(text: string, kind: "link" | "embed") {
    await navigator.clipboard.writeText(text);
    setNotice(
      kind === "embed"
        ? "Embed code copied — paste it on your website"
        : "Link copied — send on WhatsApp or email",
    );
    window.setTimeout(() => setNotice(""), 2200);
  }

  async function shareLinkNative(item: ShareLinkRecord) {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: item.title || "AR360 product",
          url: item.shareUrl,
        });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    await copyText(item.shareUrl, "link");
  }

  const showingFrom = filteredItems.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredItems.length);

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="Share Center"
        subtitle="Public links for WhatsApp and email. Embed codes to put the 3D viewer on your website."
        actions={
          <>
            <div className="dash-products-search min-w-0 flex-1 sm:min-w-[300px]">
              <Search size={16} className="dash-products-search__icon" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && replaceParams({ q: searchInput.trim() || null })}
                placeholder="Search by product name or link..."
                className="dash-products-input dash-products-input--icon"
              />
            </div>
            <UserFilterDropdown
              label="Type"
              hideLabel
              compact
              value={typeFilter}
              options={["all", "public", "embed", "email"]}
              onChange={(value) => {
                setTypeFilter(value as ShareLinkType | "all");
                setPage(1);
              }}
              renderValue={(value) =>
                ({ all: "All Types", public: "Public Link", embed: "Embed", email: "Email" } as Record<string, string>)[
                  value
                ] || value
              }
              renderOption={(value) =>
                ({ all: "All Types", public: "Public Link", embed: "Embed", email: "Email" } as Record<string, string>)[
                  value
                ] || value
              }
              className="hidden shrink-0 md:block"
            />
            <UserButton
              icon={<Plus size={16} />}
              onClick={() => setCreateOpen(true)}
              className="h-11 shrink-0 rounded-2xl bg-[#84D400] px-4 font-semibold text-[#102000] shadow-sm hover:bg-[#78C400] sm:px-5"
            >
              <span className="sm:hidden">Create</span>
              <span className="hidden sm:inline">Create Share Link</span>
            </UserButton>
          </>
        }
      />

      <section className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <UserStatCard
          dense
          label="Total Shares"
          value={String(stats.total)}
          sub="All time"
          icon={Link2}
          accent="lime"
        />
        <UserStatCard
          dense
          label="Total Views"
          value={stats.totalViews.toLocaleString("en-US")}
          sub="All share links"
          icon={Eye}
          accent="sky"
        />
        <UserStatCard
          dense
          label="QR Scans"
          value="—"
          sub="Not tracked per share"
          icon={QrCode}
          accent="violet"
        />
        <UserStatCard
          dense
          label="Active Links"
          value={String(stats.active)}
          sub="Currently active"
          icon={Share2}
          accent="orange"
        />
      </section>

      <section className="flex min-h-[480px] flex-1 flex-col overflow-hidden dash-premium-card md:min-h-[640px]">
        <div className="flex shrink-0 flex-col gap-2 border-b border-[#ECECEC] px-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-5">
          <div className="-mx-1 flex overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
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
                  className={`relative shrink-0 whitespace-nowrap px-3 py-3 text-[12px] font-semibold transition sm:px-4 sm:py-3.5 sm:text-[13px] ${
                    tab.key === "analytics" ? "hidden md:inline-flex" : ""
                  } ${active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"}`}
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
          <UserFilterDropdown
            label="Type"
            hideLabel
            compact
            value={typeFilter}
            options={["all", "public", "embed", "email"]}
            onChange={(value) => {
              setTypeFilter(value as ShareLinkType | "all");
              setPage(1);
            }}
            renderValue={(value) =>
              ({ all: "All Types", public: "Public Link", embed: "Embed", email: "Email" } as Record<string, string>)[
                value
              ] || value
            }
            renderOption={(value) =>
              ({ all: "All Types", public: "Public Link", embed: "Embed", email: "Email" } as Record<string, string>)[
                value
              ] || value
            }
            className="mb-2 w-full shrink-0 sm:mb-0 sm:w-auto"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {loading ? (
              <UserWorkspaceLoading
                className="min-h-[420px]"
                label="Loading Share Links"
                hint="Please wait while we load your share links..."
              />
            ) : paginatedItems.length === 0 ? (
              <div className="flex min-h-[420px] flex-1 items-center justify-center px-5 py-12">
                <div className="text-center">
                  <Share2 size={32} className="mx-auto text-[#D4D4D4]" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-[#111111]">No share links yet</p>
                  <p className="mt-1 text-xs font-medium text-[#737373]">
                    Create a link to share a published product with anyone.
                  </p>
                  <UserButton
                    className="mt-4 rounded-2xl bg-[#84D400] font-semibold text-[#102000]"
                    icon={<Plus size={16} />}
                    onClick={() => setCreateOpen(true)}
                  >
                    Create first link
                  </UserButton>
                </div>
              </div>
            ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="space-y-2.5 p-3 md:hidden">
                {filteredItems.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <article
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={[
                        "rounded-[16px] border border-[#ECECEC] bg-white p-3.5",
                        active ? "ring-2 ring-[#C8FF46]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-white ring-1 ring-[#ECECEC]">
                          {item.poster ? (
                            <AppImage src={item.poster} alt="" className="h-full w-full bg-white object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center bg-white text-[#A3A3A3]">
                              <Box size={18} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-[#111111]">{item.title}</p>
                              <p className="mt-0.5 text-[12px] font-medium text-[#737373]">
                                {typeHint(item.linkType)} · {item.viewCount.toLocaleString("en-US")} views
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <StatusBadge label={item.effectiveStatus} tone={statusTone(item.effectiveStatus)} />
                              <UserActionMenu
                                triggerVariant="plain"
                                iconOrientation="vertical"
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
                                    label: copyActionLabel(item.linkType),
                                    icon: item.linkType === "embed" ? <Code2 /> : <Copy />,
                                    onClick: () =>
                                      void copyText(
                                        item.linkType === "embed"
                                          ? item.embedCode || item.shareUrl
                                          : item.shareUrl,
                                        item.linkType === "embed" ? "embed" : "link",
                                      ),
                                  },
                                ]}
                              />
                            </div>
                          </div>
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {item.linkType === "embed" ? (
                              <ShareCopyChip
                                wide
                                label="Website iframe code"
                                hint={typeHint(item.linkType)}
                                copyLabel="Copy code"
                                onCopy={() => void copyText(item.embedCode || item.shareUrl, "embed")}
                              />
                            ) : (
                              <ShareCopyChip
                                wide
                                label={shortUrl(item.shareUrl)}
                                hint={typeHint(item.linkType)}
                                copyLabel="Copy link"
                                onCopy={() => void copyText(item.shareUrl, "link")}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <table className={`hidden ${panelTable.table} min-w-[1020px] md:table`}>
                <thead>
                  <tr className={panelTable.theadRow}>
                    <th className={panelTable.th}>Item</th>
                    <th className={panelTable.th}>Type</th>
                    <th className={panelTable.th}>Copy</th>
                    <th className={panelTable.th}>Views &amp; QR Scans</th>
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
                                <p className="truncate text-xs text-[#737373]">{typeHint(item.linkType)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${typeBadgeClass(item.linkType)}`}
                              >
                                {typeLabel(item.linkType)}
                              </span>
                              <p className="mt-1 text-[11px] font-medium text-[#737373]">{typeHint(item.linkType)}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {item.linkType === "embed" ? (
                              <ShareCopyChip
                                label="Website iframe code"
                                hint="Paste in Shopify, WordPress, or HTML"
                                copyLabel="Copy code"
                                onCopy={() => void copyText(item.embedCode || item.shareUrl, "embed")}
                              />
                            ) : (
                              <ShareCopyChip
                                label={shortUrl(item.shareUrl)}
                                hint={typeHint(item.linkType)}
                                copyLabel="Copy link"
                                onCopy={() => void copyText(item.shareUrl, "link")}
                              />
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-[#111111]">{item.viewCount.toLocaleString("en-US")}</div>
                            <div className="text-xs font-medium text-[#737373]">views</div>
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
                                    label: copyActionLabel(item.linkType),
                                    icon: item.linkType === "embed" ? <Code2 /> : <Copy />,
                                    onClick: () =>
                                      void copyText(
                                        item.linkType === "embed"
                                          ? item.embedCode || item.shareUrl
                                          : item.shareUrl,
                                        item.linkType === "embed" ? "embed" : "link",
                                      ),
                                  },
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
                  })}
                </tbody>
              </table>
            </div>
            )}

            <div className="hidden shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] px-5 py-3.5 text-[13px] text-[#737373] md:flex">
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

          <aside className="flex w-full shrink-0 flex-col border-t border-[#ECECEC] xl:w-[340px] xl:self-stretch xl:border-l xl:border-t-0">
            {selected ? (
              <div className="flex h-full min-h-0 flex-1 flex-col p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-[#111111]">Preview</p>
                  <StatusBadge label={selected.effectiveStatus} tone={statusTone(selected.effectiveStatus)} />
                </div>

                <div className="mt-4 overflow-hidden rounded-[16px] border border-[#ECECEC] bg-[#FAFAFA]">
                  {selected.poster ? (
                    <AppImage src={selected.poster} alt="" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="grid h-44 place-items-center text-[#D4D4D4]">
                      <Box size={36} />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-[15px] font-semibold text-[#111111]">{selected.title}</p>
                  <p className="text-xs font-medium text-[#737373]">
                    {typeLabel(selected.linkType)} · {typeHint(selected.linkType)}
                  </p>
                </div>

                {selected.linkType === "embed" && selected.embedCode ? (
                  <ShareCopyChip
                    wide
                    className="mt-3"
                    label="Website iframe code"
                    hint="Paste this in Shopify, WordPress, or any HTML page."
                    copyLabel="Copy code"
                    onCopy={() => void copyText(selected.embedCode || "", "embed")}
                  />
                ) : (
                  <ShareCopyChip
                    wide
                    className="mt-3"
                    label={shortUrl(selected.shareUrl)}
                    hint="Send this URL on WhatsApp, email, or social."
                    copyLabel="Copy link"
                    onCopy={() => void copyText(selected.shareUrl, "link")}
                  />
                )}

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
                    <button
                      type="button"
                      title={copyActionLabel(selected.linkType)}
                      aria-label={copyActionLabel(selected.linkType)}
                      onClick={() =>
                        void copyText(
                          selected.linkType === "embed"
                            ? selected.embedCode || selected.shareUrl
                            : selected.shareUrl,
                          selected.linkType === "embed" ? "embed" : "link",
                        )
                      }
                      className="up-icon-btn grid h-10 place-items-center rounded-xl"
                    >
                      {selected.linkType === "embed" ? <Code2 size={16} /> : <Link2 size={16} />}
                    </button>
                    <button
                      type="button"
                      title="Open QR Center"
                      aria-label="Open QR Center"
                      onClick={() =>
                        router.push(
                          selected.productId
                            ? `/dashboard/qr-center?productId=${encodeURIComponent(selected.productId)}`
                            : "/dashboard/qr-center",
                        )
                      }
                      className="up-icon-btn grid h-10 place-items-center rounded-xl"
                    >
                      <QrCode size={16} />
                    </button>
                    <button
                      type="button"
                      title="Share"
                      aria-label="Share"
                      onClick={() => void shareLinkNative(selected)}
                      className="up-icon-btn grid h-10 place-items-center rounded-xl"
                    >
                      <Share2 size={16} />
                    </button>
                    <button
                      type="button"
                      title="Email link"
                      aria-label="Email link"
                      onClick={() => {
                        const subject = encodeURIComponent(selected.title || "AR360 product");
                        const body = encodeURIComponent(selected.shareUrl);
                        window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
                      }}
                      className="up-icon-btn grid h-10 place-items-center rounded-xl"
                    >
                      <Mail size={16} />
                    </button>
                    <div className="grid h-10 place-items-center">
                      <UserActionMenu
                        iconOrientation="horizontal"
                        triggerClassName="up-icon-btn !h-10 !w-full !rounded-xl"
                        triggerProps={{ "aria-label": "More share options" }}
                        items={[
                          {
                            label: "View",
                            icon: <Eye />,
                            onClick: () =>
                              window.open(selected.shareUrl, "_blank", "noopener,noreferrer"),
                          },
                          {
                            label: "View in AR",
                            icon: <Smartphone />,
                            onClick: () =>
                              window.open(
                                withOpenAr(selected.destinationUrl || selected.shareUrl),
                                "_blank",
                                "noopener,noreferrer",
                              ),
                          },
                          {
                            label: copyActionLabel(selected.linkType),
                            icon: selected.linkType === "embed" ? <Code2 /> : <Copy />,
                            onClick: () =>
                              void copyText(
                                selected.linkType === "embed"
                                  ? selected.embedCode || selected.shareUrl
                                  : selected.shareUrl,
                                selected.linkType === "embed" ? "embed" : "link",
                              ),
                          },
                        ]}
                      />
                    </div>
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
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                      Paste this on your website
                    </p>
                    <pre className="max-h-24 overflow-auto rounded-lg border border-[#ECECEC] bg-white p-2 text-[10px] text-[#525252]">
                      {selected.embedCode}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm font-medium text-[#737373]">
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
    </UserPanelPageShell>
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/products?pageSize=50")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }, []);

  async function submit() {
    if (!form.productId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: form.productId, linkType: form.linkType, slug: form.slug || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(body.error || "Could not create share link."));
        return;
      }
      onCreated();
    } catch {
      setError("Could not create share link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewportPortal>
    <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-[20px] border border-[#ECECEC] bg-white sm:rounded-[20px]">
        <div className="border-b border-[#ECECEC] px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-[#111111]">Create Share Link</h2>
          <p className="mt-1 text-[12px] font-medium text-[#737373]">
            Choose how people will open this 3D model.
          </p>
        </div>
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <select
            className="h-11 w-full rounded-xl border border-[#ECECEC] px-3 text-sm font-medium"
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
          <div className="space-y-2">
            {SHARE_TYPE_OPTIONS.map((option) => {
              const active = form.linkType === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-2xl border px-3.5 py-3 ${
                    active ? "border-[#84D400] bg-[#F7FCE8]" : "border-[#ECECEC] bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="share-link-type"
                    className="mt-1 accent-[#84D400]"
                    checked={active}
                    onChange={() => setForm({ ...form, linkType: option.value })}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#111111]">{option.title}</span>
                    <span className="mt-0.5 block text-[12px] font-medium leading-snug text-[#737373]">
                      {option.desc}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <input
            className="h-11 w-full rounded-xl border border-[#ECECEC] px-3 text-sm font-medium"
            placeholder="Label (optional)"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        </div>
        <div className="flex gap-2 border-t border-[#ECECEC] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:justify-end sm:px-5">
          <UserButton variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onClose}>
            Cancel
          </UserButton>
          <UserButton
            loading={saving}
            disabled={!form.productId}
            className="h-11 flex-1 bg-[#B6FF38] text-[#102000] sm:flex-none"
            onClick={() => void submit()}
          >
            Create
          </UserButton>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
}
