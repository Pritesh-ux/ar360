"use client";

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Tag,
  Unlink,
  CheckCircle2,
  Box,
  QrCode,
  Globe,
  Plus,
  ChevronRight,
  TrendingUp,
  Download,
  AlertCircle,
  X,
  Search,
} from "lucide-react";
import Link from "next/link";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import ClientLinkedProductsGrid from "@/components/features/clients/ClientLinkedProductsGrid";
import ClientDeliveryHub from "@/components/features/clients/ClientDeliveryHub";

type ClientDetails = {
  client: {
    client_uid: string;
    name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    status: string;
    tags: string | string[] | null;
    created_at: string;
  };
  products: Array<{
    product_uid: string;
    name: string;
    status: string;
    created_at: string;
    category?: string | null;
    poster?: string | null;
    thumbnail_url?: string | null;
    file_name?: string | null;
    views?: number | null;
    product_folder?: string | null;
  }>;
  qrCodes: Array<{
    id?: number;
    qr_uid: string;
    name: string;
    status: string;
    scans_count: number;
    created_at: string;
    product_id?: string;
    product_title?: string | null;
  }>;
  domains: Array<{
    domain: string;
    status: string;
    ssl_status: string;
    created_at: string;
  }>;
  activities: Array<{
    action: string;
    resource_type: string;
    resource_id: string;
    created_at: string;
  }>;
};

type LinkModalType = "product" | "qr" | "domain";

function parseTags(tags: string | string[] | null | undefined): string[] {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (typeof tags !== "string" || !tags.trim()) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
}

function resourceIdOf(item: Record<string, unknown>) {
  return String(
    item.id ||
      item.productUid ||
      item.product_uid ||
      item.qrUid ||
      item.qr_uid ||
      item.domain ||
      "",
  ).trim();
}

function resourceLabelOf(item: Record<string, unknown>) {
  return String(
    item.title || item.name || item.domain || "Untitled",
  ).trim();
}

const TABS = [
  { key: "products", label: "Products" },
  { key: "qr", label: "QR Codes" },
  { key: "domains", label: "Domains" },
  { key: "timeline", label: "Activity" },
  { key: "settings", label: "Settings" },
] as const;

export default function ClientWorkspacePage() {
  const router = useRouter();
  const { id: clientUid } = useParams() as { id: string };

  const [data, setData] = useState<ClientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("products");
  const [notice, setNotice] = useState("");

  const [showLinkModal, setShowLinkModal] = useState<LinkModalType | null>(null);
  const [searchResourceQuery, setSearchResourceQuery] = useState("");
  const [unlinkedResources, setUnlinkedResources] = useState<Record<string, unknown>[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkingBusy, setLinkingBusy] = useState(false);

  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    tagsInput: "",
    status: "active",
  });

  const loadClientDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientUid}`, { cache: "no-store" });
      const body = await res.json();
      if (res.ok && body.success) {
        setData(body);
        setEditFormData({
          name: body.client.name,
          email: body.client.email || "",
          phone: body.client.phone || "",
          companyName: body.client.company_name || "",
          tagsInput: parseTags(body.client.tags).join(", "),
          status: body.client.status,
        });
      } else {
        setError(body.error || "Client profile not found.");
      }
    } catch (err) {
      console.error(err);
      setError("Workspace communication failed.");
    } finally {
      setLoading(false);
    }
  }, [clientUid]);

  useEffect(() => {
    if (clientUid) void loadClientDetails();
  }, [clientUid, loadClientDetails]);

  const fetchUnlinkedResources = useCallback(async () => {
    if (!showLinkModal) return;
    setLinkLoading(true);
    setUnlinkedResources([]);
    setSearchResourceQuery("");

    const linkable =
      showLinkModal === "qr" ? "qr_code" : showLinkModal === "product" ? "product" : "domain";

    try {
      const res = await fetch(`/api/clients/${clientUid}?linkable=${linkable}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (res.ok) {
        setUnlinkedResources(Array.isArray(body.items) ? body.items : []);
      } else {
        setNotice(body.error || "Could not load available resources.");
      }
    } catch (err) {
      console.error(err);
      setNotice("Could not load available resources.");
    } finally {
      setLinkLoading(false);
    }
  }, [showLinkModal, clientUid]);

  useEffect(() => {
    void fetchUnlinkedResources();
  }, [fetchUnlinkedResources]);

  async function handleLinkResource(resourceId: string) {
    if (!showLinkModal || linkingBusy || !resourceId) return;
    setLinkingBusy(true);
    setNotice("");

    try {
      const res = await fetch(`/api/clients/${clientUid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link",
          resourceType: showLinkModal === "qr" ? "qr_code" : showLinkModal,
          resourceId,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        setShowLinkModal(null);
        setNotice("Resource linked.");
        await loadClientDetails();
      } else {
        setNotice(body.error || "Failed to map resource.");
      }
    } catch (err) {
      console.error(err);
      setNotice("Failed to map resource.");
    } finally {
      setLinkingBusy(false);
    }
  }

  async function handleUnlinkResource(
    resourceType: "product" | "qr_code" | "domain",
    resourceId: string,
  ) {
    if (!confirm(`Unlink this ${resourceType.replace("_", " ")} from the client workspace?`)) return;

    try {
      const res = await fetch(`/api/clients/${clientUid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlink",
          resourceType,
          resourceId,
        }),
      });
      if (res.ok) {
        setNotice("Resource unlinked.");
        await loadClientDetails();
      } else {
        const body = await res.json().catch(() => ({}));
        setNotice(body.error || "Unlink failed.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpdateSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      const tagsArray = editFormData.tagsInput
        ? editFormData.tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const res = await fetch(`/api/clients/${clientUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          email: editFormData.email.trim(),
          phone: editFormData.phone.trim(),
          companyName: editFormData.companyName.trim(),
          status: editFormData.status,
          tags: tagsArray,
        }),
      });

      if (res.ok) {
        setNotice("Settings saved.");
        await loadClientDetails();
      } else {
        const body = await res.json().catch(() => ({}));
        setNotice(body.error || "Settings save failed.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteClient() {
    if (
      !confirm(
        "Delete this client profile permanently? All resource maps will be cleared.",
      )
    )
      return;

    try {
      const res = await fetch(`/api/clients/${clientUid}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/clients");
      } else {
        setNotice("Delete failed.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleExportClientData() {
    if (!data) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2),
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute(
      "download",
      `client_workspace_${data.client.name.replace(/\s+/g, "_")}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  const clientTags = useMemo(() => (data ? parseTags(data.client.tags) : []), [data]);

  const qrRecordByProductId = useMemo(() => {
    if (!data) return {};
    const map: Record<string, number> = {};
    for (const qr of data.qrCodes) {
      const pid = String(qr.product_id || "").trim();
      if (pid && qr.id != null && !map[pid]) map[pid] = qr.id;
    }
    return map;
  }, [data]);

  const filteredUnlinkedList = useMemo(() => {
    const q = searchResourceQuery.trim().toLowerCase();
    if (!q) return unlinkedResources;
    return unlinkedResources.filter((item) =>
      resourceLabelOf(item).toLowerCase().includes(q),
    );
  }, [unlinkedResources, searchResourceQuery]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-semibold text-[#737373]">Loading client workspace…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-3">
        <UserPageHeader
          title="Client workspace"
          subtitle={error || "Failed to load client details."}
          leading={
            <Link
              href="/dashboard/clients"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] text-[#525252] transition hover:border-[#84D400]/40 hover:bg-[#EEF9E0] hover:text-[#3D6600]"
              aria-label="Back to Clients"
            >
              <ArrowLeft size={18} />
            </Link>
          }
        />
        <div className="rounded-[20px] border border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle size={32} className="mx-auto mb-2 text-red-500" />
          <p className="text-sm font-semibold text-red-700">{error || "Failed to load client details."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {notice ? (
        <div className="rounded-[18px] border border-[#C8E6A0] bg-[#EEF9E0] px-4 py-3 text-sm font-semibold text-[#3D6600]">
          {notice}
        </div>
      ) : null}

      {showLinkModal ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#ECECEC] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#ECECEC] pb-4">
              <h3 className="text-base font-black capitalize text-[#111111]">
                Link{" "}
                {showLinkModal === "qr"
                  ? "QR Code"
                  : showLinkModal === "domain"
                    ? "Domain"
                    : "Product"}{" "}
                to Client
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(null)}
                className="rounded-xl p-1 text-[#737373] hover:bg-slate-100 hover:text-[#111111]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-[#737373]" size={16} />
              <input
                type="text"
                placeholder="Search…"
                value={searchResourceQuery}
                onChange={(e) => setSearchResourceQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#ECECEC] bg-[#FAFAFA] pl-9 pr-4 text-xs outline-none focus:border-[#84D400]"
              />
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {linkLoading ? (
                <p className="py-8 text-center text-xs text-[#737373]">Loading resources…</p>
              ) : (
                <>
                  {filteredUnlinkedList.map((item) => {
                    const label = resourceLabelOf(item);
                    const val = resourceIdOf(item);
                    if (!val) return null;
                    return (
                      <div
                        key={val}
                        className="flex items-center justify-between rounded-xl border border-[#ECECEC] p-3 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#111111]">{label}</p>
                          <p className="truncate text-[10px] text-[#8A9098]">{val}</p>
                        </div>
                        <button
                          type="button"
                          disabled={linkingBusy}
                          onClick={() => void handleLinkResource(val)}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#84D400] px-3 text-[11px] font-black text-[#102000] disabled:opacity-50"
                        >
                          <Plus size={12} /> Link
                        </button>
                      </div>
                    );
                  })}
                  {!filteredUnlinkedList.length ? (
                    <div className="rounded-xl bg-[#FAFAFA] px-4 py-8 text-center">
                      <p className="text-xs font-semibold text-[#737373]">
                        No matching unlinked resources found.
                      </p>
                      <p className="mt-1 text-[11px] text-[#8A9098]">
                        {showLinkModal === "product"
                          ? "Create a product first, then link it here."
                          : showLinkModal === "qr"
                            ? "Create a QR code in QR Center first."
                            : "Add a custom domain in Branding first."}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <UserPageHeader
        title={data.client.name}
        subtitle={
          [
            data.client.company_name,
            data.client.email,
            data.client.status === "active" ? "Active workspace" : "Archived workspace",
          ]
            .filter(Boolean)
            .join(" · ")
        }
        leading={
          <Link
            href="/dashboard/clients"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] text-[#525252] transition hover:border-[#84D400]/40 hover:bg-[#EEF9E0] hover:text-[#3D6600]"
            aria-label="Back to Clients"
          >
            <ArrowLeft size={18} />
          </Link>
        }
        actions={
          <>
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${
                data.client.status === "active"
                  ? "bg-[#EEF9E0] text-[#5FA800] ring-1 ring-[#84D400]/30"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {data.client.status}
            </span>
            <button
              type="button"
              onClick={handleExportClientData}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <Download size={16} /> Export JSON
            </button>
          </>
        }
      />

      {clientTags.length > 0 ? (
        <div className="-mt-1 flex flex-wrap gap-1.5 px-1">
          {clientTags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm"
            >
              <Tag size={10} /> {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Products", value: data.products.length, icon: Box, tone: "bg-[#EEF9E0] text-[#5FA800]" },
          { label: "QR Codes", value: data.qrCodes.length, icon: QrCode, tone: "bg-sky-50 text-sky-600" },
          { label: "Domains", value: data.domains.length, icon: Globe, tone: "bg-violet-50 text-violet-600" },
          {
            label: "Actions",
            value: data.activities.length,
            icon: TrendingUp,
            tone: "bg-orange-50 text-orange-600",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm"
            >
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${stat.tone}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#737373]">
                  {stat.label}
                </p>
                <p className="text-lg font-bold text-[#111111]">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-[20px] border border-[#ECECEC] bg-white px-2 pt-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`relative shrink-0 px-4 py-3.5 text-[13px] font-semibold transition ${
              activeTab === t.key
                ? "text-[#5FA800]"
                : "text-[#737373] hover:text-[#111111]"
            }`}
          >
            {t.label}
            {activeTab === t.key ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" />
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === "products" ? (
        <ClientLinkedProductsGrid
          className="min-h-0 flex-1"
          products={data.products}
          qrRecordByProductId={qrRecordByProductId}
          onLinkProduct={() => setShowLinkModal("product")}
          onUnlink={(productId) => handleUnlinkResource("product", productId)}
        />
      ) : null}

      {activeTab === "qr" ? (
        <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <div className="border-b border-[#ECECEC] pb-4">
            <h3 className="text-[15px] font-extrabold text-[#111111]">Delivery &amp; QR</h3>
            <p className="mt-1 text-xs font-medium text-[#737373]">
              Each assigned product brings its QR, share links, embed, and AR — manage them here for
              this end-customer (agency workflow).
            </p>
          </div>
          <ClientDeliveryHub products={data.products} qrCodes={data.qrCodes} />
        </section>
      ) : null}

      {activeTab === "domains" ? (
        <div className="rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#ECECEC] pb-3">
            <div>
              <h3 className="text-[15px] font-extrabold text-[#111111]">Branding &amp; domains</h3>
              <p className="text-xs text-[#737373]">
                White-label viewer links for this client&apos;s products — map verified domains below,
                then set logo/theme in Branding.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/branding"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-4 text-xs font-bold text-[#111111] hover:bg-[#FAFAFA]"
              >
                Branding
              </Link>
              <Link
                href="/dashboard/settings?tab=domains"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-4 text-xs font-bold text-[#111111] hover:bg-[#FAFAFA]"
              >
                Add domain
              </Link>
              <button
                type="button"
                onClick={() => setShowLinkModal("domain")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#84D400] px-4 text-xs font-black text-[#102000]"
              >
                <Plus size={13} /> Link to client
              </button>
            </div>
          </div>
          <ResourceTable
            empty="No custom domains associated with this client."
            headers={["Domain", "SSL", "Verification", ""]}
            rows={data.domains.map((d) => ({
              key: d.domain,
              cells: [
                <span key="n" className="font-extrabold text-[#111111]">
                  {d.domain}
                </span>,
                <span
                  key="s"
                  className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700"
                >
                  {d.ssl_status || "none"}
                </span>,
                <span key="v" className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                  <CheckCircle2 size={13} /> {d.status || "pending"}
                </span>,
                <button
                  key="a"
                  type="button"
                  onClick={() => void handleUnlinkResource("domain", d.domain)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 text-[11px] font-bold text-red-600 hover:bg-red-100"
                >
                  <Unlink size={12} /> Unlink
                </button>,
              ],
            }))}
          />
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <div className="rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <h3 className="mb-4 border-b border-[#ECECEC] pb-3 text-[15px] font-extrabold text-[#111111]">
            Activity Timeline
          </h3>
          <div className="space-y-4">
            {data.activities.map((act, index) => (
              <div key={`${act.created_at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                {index < data.activities.length - 1 ? (
                  <span className="absolute bottom-0 left-[13px] top-[26px] w-0.5 bg-slate-100" />
                ) : null}
                <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-slate-100 text-[#737373]">
                  <ChevronRight size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-relaxed text-[#111111]">
                    Action{" "}
                    <span className="font-extrabold capitalize text-[#5FA800]">{act.action}</span> on{" "}
                    {act.resource_type}.
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#737373]">
                    {new Date(act.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {!data.activities.length ? (
              <p className="py-8 text-center text-xs text-[#737373]">
                No log events recorded for this workspace.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <div className="rounded-[24px] border border-[#ECECEC] bg-white p-6 shadow-sm">
          <h3 className="mb-5 border-b border-[#ECECEC] pb-3 text-[15px] font-extrabold text-[#111111]">
            Client Profile Settings
          </h3>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                Client Name
              </label>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Email
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Phone
                </label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Company
                </label>
                <input
                  type="text"
                  value={editFormData.companyName}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, companyName: e.target.value })
                  }
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold outline-none focus:border-[#84D400]"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={editFormData.tagsInput}
                onChange={(e) => setEditFormData({ ...editFormData, tagsInput: e.target.value })}
                className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] pt-6">
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] hover:bg-[#78C400]"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteClient()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                <Trash2 size={15} /> Delete Client
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
      {label}
    </span>
  );
}

function ResourceTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<{ key: string; cells: ReactNode[] }>;
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#FAFAFA] text-[11px] font-bold uppercase tracking-wider text-[#737373]">
          <tr>
            {headers.map((h) => (
              <th key={h || "actions"} className={`px-4 py-3 ${h === "" ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-[#ECECEC]">
              {row.cells.map((cell, i) => (
                <td
                  key={`${row.key}-${i}`}
                  className={`px-4 py-3 ${i === row.cells.length - 1 ? "text-right" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td
                colSpan={headers.length}
                className="rounded-b-xl bg-[#FAFAFA] py-10 text-center text-xs text-[#737373]"
              >
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
