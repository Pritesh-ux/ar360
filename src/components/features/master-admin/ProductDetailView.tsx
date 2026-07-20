"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Ban,
  Box,
  Edit3,
  ExternalLink,
  Eye,
  ImageIcon,
  QrCode,
  Share2,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import { getProductModelSrc } from "@/lib/modelSource";
import {
  fmtStorageShort,
} from "@/components/features/master-admin/products-utils";

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

function MiniLineChart({ rows }: { rows: { label: string; value: number }[] }) {
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
      <polyline fill="none" stroke="#7AE02E" strokeWidth="2" points={points} />
    </svg>
  );
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

  const metricTiles = [
    { label: "Views", value: analytics.summary.views.toLocaleString("en-IN"), note: "All time" },
    { label: "AR Opens", value: analytics.summary.arOpens.toLocaleString("en-IN"), note: "WebXR launches" },
    { label: "Avg. Session", value: analytics.summary.avgSessionTime, note: "Viewer sessions" },
    { label: "QR Scans", value: analytics.summary.qrScans.toLocaleString("en-IN"), note: "Tracked scans" },
  ];

  function shareViewer() {
    const url = `${window.location.origin}${links.viewer}`;
    void navigator.clipboard?.writeText(url);
    window.alert("Viewer link copied.");
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={links.editor}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700"
        >
          <Edit3 size={14} />
          Open in Editor
        </Link>
        <Link
          href={links.viewer}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700"
        >
          <ExternalLink size={14} />
          Live Viewer
        </Link>
        <Link
          href={links.ar}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700"
        >
          <Smartphone size={14} />
          AR
        </Link>
      </div>

      {clientDelivery ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-violet-700">
              Client deliverable
            </p>
            <p className="text-[14px] font-black text-slate-900">
              Assigned to end-client: {clientDelivery.clientName}
            </p>
            <p className="text-[11px] font-semibold text-slate-600">
              {clientDelivery.clientEmail || "No email"} · Status: {clientDelivery.clientStatus}
            </p>
          </div>
          <Link
            href={`/master-admin/customers/${encodeURIComponent(product.customerUid)}`}
            className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50"
          >
            View customer → Clients tab
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-600">
          <span className="font-bold text-slate-800">Main product library</span> — not assigned to a
          client workspace. When the owner uses Client Management, assigned products move off their
          library into a client deliverable.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <p className="text-[13px] font-black text-slate-900">3D Preview</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {product.status}
                </span>
              </div>
              <div className="relative h-[min(380px,42vh)] min-h-[240px] bg-slate-50">
                {modelSrc ? (
                  <div className="h-full w-full">
                    <ModelViewer
                      src={modelSrc}
                      poster={product.poster}
                      exposure={settings.exposure}
                      environmentImage={settings.environmentImage}
                      backgroundColor={settings.backgroundColor}
                      shadowIntensity={settings.shadowIntensity}
                      autoRotate={settings.autoRotate}
                      cameraControls
                    />
                  </div>
                ) : product.poster ? (
                  <img src={product.poster} alt={product.name} className="h-full w-full object-contain p-6" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[13px] font-semibold text-slate-400">
                    <Box size={24} className="mr-2" />
                    No preview available
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-1 flex-col rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <p className="text-[11px] font-black uppercase text-slate-500">Poster</p>
                <div className="mt-2 min-h-[120px] flex-1 overflow-hidden rounded-xl bg-slate-100">
                  {product.poster ? (
                    <img src={product.poster} alt="Poster" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full min-h-[120px] items-center justify-center text-slate-400">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
              </div>
              <Link
                href={links.viewer}
                target="_blank"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Eye size={14} /> Public viewer
                </span>
                <span className="text-[#4D9A00]">Open →</span>
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3">
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`shrink-0 rounded-t-lg px-3 py-2 text-[12px] font-bold ${
                    tab === item
                      ? "border-b-2 border-[#A6FF2E] bg-[#A6FF2E]/10 text-slate-900"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === "Overview" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {metricTiles.map((tile) => (
                      <div key={tile.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <p className="text-[11px] font-semibold text-slate-500">{tile.label}</p>
                        <p className="mt-1 text-[20px] font-black text-slate-900">{tile.value}</p>
                        <p className="mt-1 text-[10px] font-semibold text-emerald-600">{tile.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <h3 className="text-[14px] font-black text-slate-900">Performance Trend</h3>
                      <MiniLineChart rows={chartRows.length ? chartRows : [{ label: "—", value: 0 }]} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-black text-slate-900">Top Insights</h3>
                      <div className="mt-3 space-y-2">
                        {[
                          ["Top Device", analytics.insights.topDevice],
                          ["Top Country", analytics.insights.topCountry],
                          ["Top Browser", analytics.insights.topBrowser],
                          ["AR Opens via WebXR", analytics.insights.arOpensWebXR.toLocaleString("en-IN")],
                          ["QR Scans", analytics.insights.qrScans.toLocaleString("en-IN")],
                        ].map(([label, value]) => (
                          <div key={label as string} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12px]">
                            <span className="font-semibold text-slate-500">{label}</span>
                            <span className="font-bold text-slate-800">{value}</span>
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
                    <div key={m.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-[13px] font-bold text-slate-900">{m.name}</p>
                      <p className="text-[11px] text-slate-500">Color: {m.baseColor}</p>
                    </div>
                  ))}
                  {materials.length === 0 && <p className="text-[13px] text-slate-400">No materials configured.</p>}
                </div>
              )}

              {tab === "Variants" && (
                <div className="space-y-2">
                  {variants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-[13px] font-bold text-slate-900">{v.name}</p>
                      <span className="text-[11px] font-semibold capitalize text-slate-500">{v.status}</span>
                    </div>
                  ))}
                  {variants.length === 0 && <p className="text-[13px] text-slate-400">No variants configured.</p>}
                </div>
              )}

              {tab === "Lighting" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Environment", settings.environmentImage],
                    ["Exposure", settings.exposure],
                    ["Background", settings.backgroundColor],
                    ["Shadow Intensity", settings.shadowIntensity],
                    ["Auto Rotate", settings.autoRotate ? "Enabled" : "Disabled"],
                    ["Skybox", settings.useSkybox ? "Enabled" : "Disabled"],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[13px]">
                      <span className="font-semibold text-slate-500">{label}: </span>
                      <span className="font-bold text-slate-800">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "Analytics" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <h4 className="text-[12px] font-black uppercase text-slate-500">Devices</h4>
                      <div className="mt-2 space-y-1">
                        {analytics.devices.map((d) => (
                          <div key={d.device} className="flex justify-between text-[12px]">
                            <span className="capitalize text-slate-600">{d.device}</span>
                            <span className="font-bold">{d.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[12px] font-black uppercase text-slate-500">Countries</h4>
                      <div className="mt-2 space-y-1">
                        {analytics.countries.map((c) => (
                          <div key={c.country} className="flex justify-between text-[12px]">
                            <span className="text-slate-600">{c.country || "Unknown"}</span>
                            <span className="font-bold">{c.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[12px] font-black uppercase text-slate-500">Browsers</h4>
                      <div className="mt-2 space-y-1">
                        {analytics.browsers.map((b) => (
                          <div key={b.browser} className="flex justify-between text-[12px]">
                            <span className="text-slate-600">{b.browser}</span>
                            <span className="font-bold">{b.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[12px] font-semibold text-slate-500">
                    Session Time avg: {analytics.summary.avgSessionTime}
                  </p>
                </div>
              )}

              {tab === "QR" && (
                <div className="space-y-3">
                  {product.qrUrl && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <img src={product.qrUrl} alt="QR asset" className="mx-auto h-40 w-40 object-contain" />
                    </div>
                  )}
                  {qrCodes.map((q) => (
                    <div
                      key={q.code}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[13px]"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{q.name}</span>
                        <span className="ml-2 font-mono text-[11px] text-slate-500">{q.code}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {q.scans} scans · {q.createdAt}
                      </span>
                    </div>
                  ))}
                  {!product.qrUrl && qrCodes.length === 0 && (
                    <p className="text-[13px] text-slate-400">No QR codes for this product yet.</p>
                  )}
                </div>
              )}

              {tab === "Embed" && (
                <div className="space-y-3">
                  <p className="text-[13px] font-semibold text-slate-600">Embed URL</p>
                  <code className="block rounded-xl bg-slate-50 p-3 text-[12px] text-slate-700">
                    {typeof window !== "undefined" ? `${window.location.origin}${links.embed}` : links.embed}
                  </code>
                  <Link href={links.embed} target="_blank" className="inline-flex text-[12px] font-bold text-[#4D9A00]">
                    Open embed preview →
                  </Link>
                </div>
              )}

              {tab === "History" && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[12px]">
                    <thead className="text-[11px] font-bold uppercase text-slate-400">
                      <tr className="border-b border-slate-100">
                        <th className="p-2">Action</th>
                        <th className="p-2">Admin</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">IP</th>
                        <th className="p-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id} className="border-b border-slate-50">
                          <td className="p-2 font-bold text-slate-800">{row.action}</td>
                          <td className="p-2 text-slate-600">{row.adminName}</td>
                          <td className="p-2 text-slate-500">{row.createdAt}</td>
                          <td className="p-2 text-slate-500">{row.ip}</td>
                          <td className="p-2 text-slate-600">{row.details}</td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            No history recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "Object Capture" && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
                  <p className="text-[14px] font-black text-slate-800">Object Capture</p>
                  <p className="mt-2 text-[13px] text-slate-500">Capture jobs for this product will appear here.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-slate-900">Product Info</h2>
              <button type="button" className="text-[12px] font-bold text-[#4D9A00]">
                Edit
              </button>
            </div>
            <div className="space-y-2 text-[13px]">
              {clientDelivery ? (
                <div className="mb-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                  <p className="text-[10px] font-black uppercase text-violet-700">Client assignment</p>
                  <p className="mt-1 font-bold text-slate-900">{clientDelivery.clientName}</p>
                  <p className="font-mono text-[10px] text-slate-500">{clientDelivery.clientUid}</p>
                </div>
              ) : null}
              {[
                ["Product ID", product.code],
                ["Name", product.name],
                ["Owner", product.owner],
                ["Company", product.company],
                ["Category", product.category],
                ["Size", product.fileSize],
                ["Format", product.format],
                ["Status", product.status],
                ["Created", product.createdAt],
                ["Updated", product.updatedAt],
                ["Variants", String(product.variantsCount)],
                ["Materials", String(product.materialsCount)],
                ["Storage Used", fmtStorageShort(product.storageMB)],
                ["Total Views", product.views.toLocaleString("en-IN")],
                ["Total AR Opens", product.arViews.toLocaleString("en-IN")],
                ["Total QR Scans", product.qrScans.toLocaleString("en-IN")],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-3 border-b border-slate-50 pb-2">
                  <span className="font-semibold text-slate-500">{label}</span>
                  {label === "Owner" ? (
                    <div className="flex items-center gap-2">
                      <CustomerAvatar name={product.owner} seed={product.customerUid} size="sm" />
                      {product.customerUid ? (
                        <Link
                          href={`/master-admin/customers/${encodeURIComponent(product.customerUid)}`}
                          className="max-w-[140px] truncate text-right font-bold text-[#3D6600] hover:underline"
                        >
                          {value}
                        </Link>
                      ) : (
                        <span className="max-w-[140px] truncate text-right font-bold text-slate-800">{value}</span>
                      )}
                    </div>
                  ) : label === "Company" && product.customerUid ? (
                    <Link
                      href={`/master-admin/customers/${encodeURIComponent(product.customerUid)}`}
                      className="max-w-[58%] truncate text-right font-bold text-[#3D6600] hover:underline"
                    >
                      {value}
                    </Link>
                  ) : (
                    <span className="max-w-[58%] truncate text-right font-bold text-slate-800">{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-black text-slate-900">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: "Open Editor", icon: Edit3, href: links.editor },
                { label: "Publish", icon: Upload, onClick: onPublish },
                { label: "Disable", icon: Ban, onClick: onDisable, danger: true },
                { label: "Regenerate Poster", icon: ImageIcon, onClick: () => window.alert("Coming soon.") },
                { label: "Generate QR", icon: QrCode, href: `/dashboard/qr-center?productId=${encodeURIComponent(product.id)}` },
                { label: "Share", icon: Share2, onClick: shareViewer },
              ].map(({ label, icon: Icon, href, onClick, danger }) =>
                href ? (
                  <Link
                    key={label}
                    href={href}
                    target="_blank"
                    className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ) : (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-[11px] font-bold hover:bg-slate-100 ${
                      danger ? "border-red-100 bg-red-50 text-red-600" : "border-slate-100 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ),
              )}
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-[13px] font-black text-white"
            >
              <Trash2 size={15} />
              Delete Product
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
