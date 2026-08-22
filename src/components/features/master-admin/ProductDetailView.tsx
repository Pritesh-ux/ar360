"use client";

import Link from "next/link";
import AppImage from "@/components/shared/AppImage";
import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Ban,
  Box,
  Edit3,
  ExternalLink,
  Eye,
  ImageIcon,
  Layers,
  QrCode,
  Share2,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import { AdminAreaChart } from "@/components/features/master-admin/AdminSparkline";
import AdminMetricCard from "@/components/ui/admin/AdminMetricCard";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import { getProductModelSrc } from "@/lib/modelSource";
import { fmtStorageShort } from "@/components/features/master-admin/products-utils";
import "@/components/dashboard/dashboard-premium.css";

const ModelViewer = dynamic(() => import("@/components/shared/ModelViewer"), { ssr: false });

export type ProductDetailPayload = {
  product: {
    id: string;
    code: string;
    name: string;
    category: string;
    status: string;
    owner: string;
    ownerEmail: string;
    company: string;
    customerUid: string;
    fileName: string;
    fileSize: string;
    storageMB: number;
    format: string;
    modelUrl: string;
    productFolder: string;
    poster: string;
    qrUrl: string;
    publicId: string;
    views: number;
    arViews: number;
    qrScans: number;
    variantsCount: number;
    materialsCount: number;
    createdAt: string;
    updatedAt: string;
  };
  settings: {
    exposure: number;
    environmentImage: string;
    backgroundColor: string;
    shadowIntensity: number;
    autoRotate: boolean;
    useSkybox: boolean;
  };
  variants: Array<{ id: string; name: string; status: string }>;
  materials: Array<{ id: string; name: string; baseColor: string }>;
  analytics: {
    summary: {
      views: number;
      arOpens: number;
      avgSessionTime: string;
      bounceRate: number;
      qrScans: number;
    };
    daily: Array<{ date: string; views: number; arLaunches: number }>;
    devices: Array<{ device: string; views: number; percent: number }>;
    countries: Array<{ country: string; views: number; percent: number }>;
    browsers: Array<{ browser: string; views: number; percent: number }>;
    insights: {
      topDevice: string;
      topCountry: string;
      topBrowser: string;
      arOpensWebXR: number;
      qrScans: number;
    };
  };
  qrCodes: Array<{ code: string; name: string; scans: number; createdAt: string }>;
  clientDelivery: {
    clientUid: string;
    clientName: string;
    clientEmail: string | null;
    clientStatus: string;
  } | null;
  history: Array<{
    id: number | string;
    action: string;
    adminName: string;
    createdAt: string;
    ip: string;
    details: string;
  }>;
  links: {
    editor: string;
    viewer: string;
    embed: string;
    ar: string;
  };
};

const TABS = [
  "Overview",
  "Materials",
  "Variants",
  "Lighting",
  "Analytics",
  "QR",
  "Embed",
  "Object Capture",
  "History",
] as const;

type TabId = (typeof TABS)[number];

function PanelCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dash-premium-card p-4 md:p-5 ${className}`}>{children}</div>;
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-[#111827]">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{subtitle}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-2 last:border-0">
      <span className="text-[12px] font-semibold text-[#6B7280]">{label}</span>
      <span className="max-w-[60%] truncate text-right text-[13px] font-bold text-[#111827]">{value}</span>
    </div>
  );
}

function MiniLineChart({ rows }: { rows: { label: string; value: number }[] }) {
  return <AdminAreaChart rows={rows} className="mt-3 h-28 w-full" />;
}

function statusBadgeClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "published" || normalized === "active") {
    return "bg-[#F7FCE8] text-[#3D6600] ring-[#D9F99D]";
  }
  if (normalized === "draft") {
    return "bg-[#FAFAFB] text-[#525252] ring-[#E5E7EB]";
  }
  if (normalized === "archived" || normalized === "disabled") {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-[#FAFAFB] text-[#525252] ring-[#E5E7EB]";
}

export default function ProductDetailView({
  data,
  onPublish,
  onDisable,
  onDelete,
}: {
  data: ProductDetailPayload;
  onPublish?: () => void;
  onDisable?: () => void;
  onDelete?: () => void;
}) {
  const [tab, setTab] = useState<TabId>("Overview");
  const { product, settings, variants, materials, analytics, qrCodes, history, links, clientDelivery } =
    data;

  const modelSrc = useMemo(
    () =>
      getProductModelSrc({
        modelUrl: product.modelUrl,
        fileName: product.fileName,
        publicFolder: product.productFolder,
        productUid: product.id,
        id: product.id,
      }),
    [product],
  );

  const chartRows = (analytics.daily || []).slice(-14).map((row) => ({
    label: row.date.slice(5),
    value: row.views,
  }));

  function shareViewer() {
    const url = `${window.location.origin}${links.viewer}`;
    void navigator.clipboard?.writeText(url);
    window.alert("Viewer link copied.");
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/master-admin/products"
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151] transition hover:border-[#D4D4D4]"
        >
          <ArrowLeft size={14} />
          Back to Products
        </Link>
        <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF]">
          <Link href="/master-admin/products" className="hover:text-[#6B7280]">
            Products
          </Link>
          <span>/</span>
          <span className="text-[#374151]">{product.name}</span>
        </nav>
      </div>

      <UserPageHeader
        highlighted
        title={product.name}
        subtitle={`${product.code} · ${product.category || "Uncategorized"} · ${product.owner}`}
        badge={
          <>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${statusBadgeClass(product.status)}`}
            >
              {product.status}
            </span>
            {clientDelivery ? (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-800 ring-1 ring-inset ring-violet-200">
                Client · {clientDelivery.clientName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F7FCE8] px-2.5 py-1 text-[11px] font-bold text-[#3D6600] ring-1 ring-inset ring-[#D9F99D]">
                <Box size={12} className="shrink-0" />
                Main library
              </span>
            )}
          </>
        }
        actions={
          <>
            <Link href={links.editor} target="_blank" className="dash-premium-btn-primary h-10 px-3 text-[12px]">
              <Edit3 size={14} />
              Open in Editor
            </Link>
            <Link href={links.viewer} target="_blank" className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <ExternalLink size={14} />
              Live Viewer
            </Link>
            <Link href={links.ar} target="_blank" className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <Smartphone size={14} />
              AR
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminMetricCard
          title="Views"
          value={analytics.summary.views.toLocaleString("en-IN")}
          note="All time"
          iconComponent={Eye}
          iconClassName="bg-lime-50 text-[#5AA700]"
          layout="compact"
        />
        <AdminMetricCard
          title="AR Opens"
          value={analytics.summary.arOpens.toLocaleString("en-IN")}
          note="WebXR launches"
          iconComponent={Smartphone}
          iconClassName="bg-sky-50 text-sky-700"
          layout="compact"
        />
        <AdminMetricCard
          title="Avg. Session"
          value={analytics.summary.avgSessionTime}
          note="Viewer sessions"
          iconComponent={Layers}
          iconClassName="bg-violet-50 text-violet-700"
          layout="compact"
        />
        <AdminMetricCard
          title="QR Scans"
          value={analytics.summary.qrScans.toLocaleString("en-IN")}
          note="Tracked scans"
          iconComponent={QrCode}
          iconClassName="bg-orange-50 text-orange-700"
          layout="compact"
        />
      </section>

      {clientDelivery ? (
        <div className="dash-premium-card flex flex-wrap items-center justify-between gap-3 border-violet-200 bg-violet-50/50 p-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Client deliverable</p>
            <p className="mt-1 text-[14px] font-bold text-[#111827]">
              Assigned to end-client: {clientDelivery.clientName}
            </p>
            <p className="text-[11px] font-semibold text-[#6B7280]">
              {clientDelivery.clientEmail || "No email"} · Status: {clientDelivery.clientStatus}
            </p>
          </div>
          <Link
            href={`/master-admin/customers/${encodeURIComponent(product.customerUid)}`}
            className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
          >
            View customer
          </Link>
        </div>
      ) : (
        <div className="dash-premium-card flex items-start gap-3 px-4 py-3.5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#F7FCE8] text-[#3D6600]">
            <Box size={15} />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[#111827]">Main product library</p>
            <p className="mt-0.5 text-[12px] font-medium text-[#6B7280]">
              Not assigned to a client workspace — visible in the shared product library.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <PanelCard className="overflow-hidden md:col-span-2 !p-0">
              <div className="flex items-center justify-between border-b border-[#ECECEC] px-4 py-2.5">
                <p className="text-[13px] font-bold text-[#111827]">3D Preview</p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ring-inset ${statusBadgeClass(product.status)}`}
                >
                  {product.status}
                </span>
              </div>
              <div className="relative h-[min(380px,42vh)] min-h-[240px] bg-[#FAFAFB]">
                {modelSrc ? (
                  <div className="absolute inset-0">
                    <ModelViewer
                      src={modelSrc}
                      poster={product.poster}
                      exposure={settings.exposure}
                      environmentImage={settings.environmentImage}
                      backgroundColor={settings.backgroundColor || "#FAFAFB"}
                      shadowIntensity={settings.shadowIntensity}
                      autoRotate={settings.autoRotate}
                      cameraControls
                    />
                  </div>
                ) : product.poster ? (
                  <AppImage src={product.poster} alt={product.name} className="h-full w-full object-contain p-6" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[13px] font-semibold text-[#9CA3AF]">
                    <Box size={24} className="mr-2" />
                    No preview available
                  </div>
                )}
              </div>
            </PanelCard>

            <div className="flex flex-col gap-3">
              <PanelCard className="flex flex-1 flex-col">
                <p className="text-[11px] font-bold uppercase text-[#9CA3AF]">Poster</p>
                <div className="mt-2 min-h-[120px] flex-1 overflow-hidden rounded-[14px] bg-[#FAFAFB]">
                  {product.poster ? (
                    <AppImage src={product.poster} alt="Poster" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full min-h-[120px] items-center justify-center text-[#9CA3AF]">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
              </PanelCard>
              <Link
                href={links.viewer}
                target="_blank"
                className="dash-activity-row flex items-center justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[12px] font-semibold text-[#111827] transition hover:border-[#D4D4D4]"
              >
                <span className="inline-flex items-center gap-2">
                  <Eye size={14} className="text-[#6B7280]" /> Public viewer
                </span>
                <span className="text-[#5AA700]">Open →</span>
              </Link>
            </div>
          </section>

          <section className="dash-premium-card overflow-hidden">
            <div className="flex overflow-x-auto border-b border-[#ECECEC] px-2 pt-1">
              {TABS.map((item) => {
                const active = tab === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={`relative shrink-0 px-4 py-3.5 text-[13px] font-semibold transition ${
                      active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                    }`}
                  >
                    {item}
                    {active ? (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="p-4 md:p-5">
              {tab === "Overview" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Views", value: analytics.summary.views.toLocaleString("en-IN") },
                      { label: "AR Opens", value: analytics.summary.arOpens.toLocaleString("en-IN") },
                      { label: "Bounce Rate", value: `${analytics.summary.bounceRate}%` },
                      { label: "QR Scans", value: analytics.summary.qrScans.toLocaleString("en-IN") },
                    ].map((tile) => (
                      <div
                        key={tile.label}
                        className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-3"
                      >
                        <p className="text-[11px] font-semibold text-[#6B7280]">{tile.label}</p>
                        <p className="mt-1 text-[20px] font-bold text-[#111827]">{tile.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <h3 className="text-[14px] font-bold text-[#111827]">Performance Trend</h3>
                      <MiniLineChart rows={chartRows.length ? chartRows : [{ label: "—", value: 0 }]} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[#111827]">Top Insights</h3>
                      <div className="mt-3 space-y-1.5">
                        {[
                          ["Top Device", analytics.insights.topDevice],
                          ["Top Country", analytics.insights.topCountry],
                          ["Top Browser", analytics.insights.topBrowser],
                          ["AR Opens via WebXR", analytics.insights.arOpensWebXR.toLocaleString("en-IN")],
                          ["QR Scans", analytics.insights.qrScans.toLocaleString("en-IN")],
                        ].map(([label, value]) => (
                          <div
                            key={label as string}
                            className="flex justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[12px]"
                          >
                            <span className="font-semibold text-[#6B7280]">{label}</span>
                            <span className="font-bold text-[#111827]">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "Materials" && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {materials.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5"
                    >
                      <p className="text-[13px] font-bold text-[#111827]">{m.name}</p>
                      <p className="text-[11px] text-[#6B7280]">Color: {m.baseColor}</p>
                    </div>
                  ))}
                  {materials.length === 0 && (
                    <p className="text-[13px] font-medium text-[#9CA3AF]">No materials configured.</p>
                  )}
                </div>
              )}

              {tab === "Variants" && (
                <div className="space-y-1.5">
                  {variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5"
                    >
                      <p className="text-[13px] font-bold text-[#111827]">{v.name}</p>
                      <span className="text-[11px] font-semibold capitalize text-[#6B7280]">{v.status}</span>
                    </div>
                  ))}
                  {variants.length === 0 && (
                    <p className="text-[13px] font-medium text-[#9CA3AF]">No variants configured.</p>
                  )}
                </div>
              )}

              {tab === "Lighting" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["Environment", settings.environmentImage],
                    ["Exposure", settings.exposure],
                    ["Background", settings.backgroundColor],
                    ["Shadow Intensity", settings.shadowIntensity],
                    ["Auto Rotate", settings.autoRotate ? "Enabled" : "Disabled"],
                    ["Skybox", settings.useSkybox ? "Enabled" : "Disabled"],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[13px]"
                    >
                      <span className="font-semibold text-[#6B7280]">{label}: </span>
                      <span className="font-bold text-[#111827]">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "Analytics" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <h4 className="text-[12px] font-bold uppercase text-[#9CA3AF]">Devices</h4>
                      <div className="mt-2 space-y-1.5">
                        {analytics.devices.map((d) => (
                          <div
                            key={d.device}
                            className="flex justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2 text-[12px]"
                          >
                            <span className="capitalize text-[#6B7280]">{d.device}</span>
                            <span className="font-bold text-[#111827]">{d.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[12px] font-bold uppercase text-[#9CA3AF]">Countries</h4>
                      <div className="mt-2 space-y-1.5">
                        {analytics.countries.map((c) => (
                          <div
                            key={c.country}
                            className="flex justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2 text-[12px]"
                          >
                            <span className="text-[#6B7280]">{c.country || "Unknown"}</span>
                            <span className="font-bold text-[#111827]">{c.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[12px] font-bold uppercase text-[#9CA3AF]">Browsers</h4>
                      <div className="mt-2 space-y-1.5">
                        {analytics.browsers.map((b) => (
                          <div
                            key={b.browser}
                            className="flex justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2 text-[12px]"
                          >
                            <span className="text-[#6B7280]">{b.browser}</span>
                            <span className="font-bold text-[#111827]">{b.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[12px] font-semibold text-[#6B7280]">
                    Session Time avg: {analytics.summary.avgSessionTime}
                  </p>
                </div>
              )}

              {tab === "QR" && (
                <div className="space-y-2">
                  {product.qrUrl && (
                    <div className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-4">
                      <AppImage src={product.qrUrl} alt="QR asset" className="mx-auto h-40 w-40 object-contain" />
                    </div>
                  )}
                  {qrCodes.map((q) => (
                    <div
                      key={q.code}
                      className="dash-activity-row flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[13px]"
                    >
                      <div>
                        <span className="font-bold text-[#111827]">{q.name}</span>
                        <span className="ml-2 font-mono text-[11px] text-[#9CA3AF]">{q.code}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#6B7280]">
                        {q.scans} scans · {q.createdAt}
                      </span>
                    </div>
                  ))}
                  {!product.qrUrl && qrCodes.length === 0 && (
                    <p className="text-[13px] font-medium text-[#9CA3AF]">No QR codes for this product yet.</p>
                  )}
                </div>
              )}

              {tab === "Embed" && (
                <div className="space-y-3">
                  <p className="text-[13px] font-semibold text-[#6B7280]">Embed URL</p>
                  <code className="block rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-3 text-[12px] text-[#374151]">
                    {typeof window !== "undefined" ? `${window.location.origin}${links.embed}` : links.embed}
                  </code>
                  <Link href={links.embed} target="_blank" className="inline-flex text-[12px] font-bold text-[#5AA700]">
                    Open embed preview →
                  </Link>
                </div>
              )}

              {tab === "History" && (
                <div className="overflow-x-auto rounded-[14px] border border-[#ECECEC]">
                  <table className="w-full min-w-[640px] text-left text-[12px]">
                    <thead className="bg-[#FAFAFB] text-[11px] font-bold uppercase text-[#9CA3AF]">
                      <tr className="border-b border-[#ECECEC]">
                        <th className="p-3">Action</th>
                        <th className="p-3">Admin</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">IP</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFB]">
                          <td className="p-3 font-bold text-[#111827]">{row.action}</td>
                          <td className="p-3 text-[#6B7280]">{row.adminName}</td>
                          <td className="p-3 text-[#6B7280]">{row.createdAt}</td>
                          <td className="p-3 text-[#6B7280]">{row.ip}</td>
                          <td className="p-3 text-[#4B5563]">{row.details}</td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[#9CA3AF]">
                            No history recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "Object Capture" && (
                <div className="rounded-[16px] border border-dashed border-[#ECECEC] bg-[#FAFAFB] p-10 text-center">
                  <p className="text-[14px] font-bold text-[#111827]">Object Capture</p>
                  <p className="mt-2 text-[13px] font-medium text-[#6B7280]">
                    Capture jobs for this product will appear here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          <PanelCard>
            <div className="mb-3 flex items-center justify-between">
              <PanelTitle title="Product Info" />
              <Link href={links.editor} target="_blank" className="text-[12px] font-bold text-[#5AA700] hover:underline">
                Edit
              </Link>
            </div>
            <div className="space-y-0.5">
              {clientDelivery ? (
                <div className="mb-3 rounded-[14px] border border-violet-100 bg-violet-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase text-violet-700">Client assignment</p>
                  <p className="mt-1 font-bold text-[#111827]">{clientDelivery.clientName}</p>
                  <p className="font-mono text-[10px] text-[#9CA3AF]">{clientDelivery.clientUid}</p>
                </div>
              ) : null}
              <InfoRow label="Product ID" value={product.code} />
              <InfoRow label="Name" value={product.name} />
              <InfoRow
                label="Owner"
                value={
                  <div className="flex items-center justify-end gap-2">
                    <CustomerAvatar name={product.owner} seed={product.customerUid} size="sm" />
                    {product.customerUid ? (
                      <Link
                        href={`/master-admin/customers/${encodeURIComponent(product.customerUid)}`}
                        className="max-w-[140px] truncate font-bold text-[#3D6600] hover:underline"
                      >
                        {product.owner}
                      </Link>
                    ) : (
                      <span className="max-w-[140px] truncate">{product.owner}</span>
                    )}
                  </div>
                }
              />
              <InfoRow
                label="Company"
                value={
                  product.customerUid ? (
                    <Link
                      href={`/master-admin/customers/${encodeURIComponent(product.customerUid)}`}
                      className="font-bold text-[#3D6600] hover:underline"
                    >
                      {product.company}
                    </Link>
                  ) : (
                    product.company
                  )
                }
              />
              <InfoRow label="Category" value={product.category} />
              <InfoRow label="Size" value={product.fileSize} />
              <InfoRow label="Format" value={product.format} />
              <InfoRow label="Status" value={product.status} />
              <InfoRow label="Created" value={product.createdAt} />
              <InfoRow label="Updated" value={product.updatedAt} />
              <InfoRow label="Variants" value={String(product.variantsCount)} />
              <InfoRow label="Materials" value={String(product.materialsCount)} />
              <InfoRow label="Storage Used" value={fmtStorageShort(product.storageMB)} />
              <InfoRow label="Total Views" value={product.views.toLocaleString("en-IN")} />
              <InfoRow label="Total AR Opens" value={product.arViews.toLocaleString("en-IN")} />
              <InfoRow label="Total QR Scans" value={product.qrScans.toLocaleString("en-IN")} />
            </div>
          </PanelCard>

          <PanelCard>
            <PanelTitle title="Quick Actions" />
            <div className="space-y-1">
              {[
                { label: "Open Editor", icon: Edit3, href: links.editor },
                { label: "Publish", icon: Upload, onClick: onPublish },
                { label: "Disable", icon: Ban, onClick: onDisable, danger: true },
                { label: "Regenerate Poster", icon: ImageIcon, href: links.editor },
                {
                  label: "Generate QR",
                  icon: QrCode,
                  href: `/dashboard/qr-center?productId=${encodeURIComponent(product.id)}`,
                },
                { label: "Share", icon: Share2, onClick: shareViewer },
              ].map((item) => {
                const Icon = item.icon;
                const className = `dash-activity-row flex w-full items-center gap-2.5 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-left text-[13px] font-semibold ${
                  "danger" in item && item.danger ? "text-[#EF4444]" : "text-[#111827]"
                }`;
                if ("href" in item && item.href) {
                  return (
                    <Link key={item.label} href={item.href} target="_blank" className={className}>
                      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm">
                        <Icon size={15} className="text-[#6B7280]" />
                      </span>
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button key={item.label} type="button" onClick={item.onClick} className={className}>
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm ${
                        "danger" in item && item.danger ? "text-[#EF4444]" : "text-[#6B7280]"
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#EF4444] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#DC2626]"
            >
              <Trash2 size={15} />
              Delete Product
            </button>
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}
