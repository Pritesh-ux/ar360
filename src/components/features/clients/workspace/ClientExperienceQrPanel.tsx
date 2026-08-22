"use client";

import { useMemo } from "react";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import QrCodePreview, {
  downloadQrPng,
  downloadQrSvg,
  type QrPreviewItem,
} from "@/components/user-panel/QrCodePreview";
import {
  AR360_QR_CENTER_LOGO_PATH,
  CUSTOM_QR_CENTER_LOGO_SIZE,
} from "@/lib/growth/qr-logo-shared";
import type { ClientWorkspaceClient, ClientWorkspaceProduct } from "@/lib/user-panel/client-workspace";
import { CLIENT_ACCENT } from "@/lib/user-panel/client-workspace";
import {
  resolveClientExperienceUrl,
} from "@/lib/user-panel/client-experience-url";

type Props = {
  client: ClientWorkspaceClient;
  products: ClientWorkspaceProduct[];
};

function safeFilename(name: string): string {
  const base = String(name || "client")
    .trim()
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "client";
}

export default function ClientExperienceQrPanel({ client, products }: Props) {
  const experienceUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    return resolveClientExperienceUrl(window.location.origin, client.client_uid);
  }, [client.client_uid]);

  const previewItem = useMemo((): QrPreviewItem | null => {
    if (!experienceUrl) return null;
    const qrId = `client-${client.client_uid}`;
    const logoUrl = String(client.logo_url || "").trim() || AR360_QR_CENTER_LOGO_PATH;
    return {
      id: qrId,
      productId: client.client_uid,
      destinationUrl: experienceUrl,
      foregroundColor: "#111111",
      backgroundColor: "#ffffff",
      patternStyle: "square",
      cornerStyle: "square",
      logoUrl,
      logoSize: logoUrl === AR360_QR_CENTER_LOGO_PATH ? 0.22 : CUSTOM_QR_CENTER_LOGO_SIZE,
      frameEnabled: false,
      frameStyle: "simple",
      frameColor: "#111111",
      frameText: client.name || "Scan to view",
    };
  }, [client, experienceUrl]);

  if (!previewItem || !experienceUrl) return null;

  const fileBase = safeFilename(client.name || client.client_uid);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(experienceUrl!);
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-[16px] border border-[#E2E4DC] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[#111111]">
            <QrCode size={18} className="shrink-0 text-[#5FA800]" />
            <h2 className="text-[15px] font-bold tracking-tight">Client experience QR</h2>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-[#737373]">
            One QR for the full client showroom — this company link stays the same even if a
            product is removed. Catalog, branding, and assigned products
            ({products.length} product{products.length === 1 ? "" : "s"}).
          </p>
          <p className="mt-2 truncate text-[11px] font-medium text-[#9CA3AF]" title={experienceUrl}>
            {experienceUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-3 text-xs font-semibold text-[#525252] hover:bg-[#FAFAFA]"
            >
              <Copy size={14} /> Copy link
            </button>
            <a
              href={experienceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-3 text-xs font-semibold text-[#525252] hover:bg-[#FAFAFA]"
            >
              <ExternalLink size={14} /> Open experience
            </a>
            <button
              type="button"
              onClick={() => downloadQrPng(previewItem, `${fileBase}-experience-qr.png`)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-3 text-xs font-semibold text-[#525252] hover:bg-[#FAFAFA]"
            >
              <Download size={14} /> PNG
            </button>
            <button
              type="button"
              onClick={() => downloadQrSvg(previewItem, `${fileBase}-experience-qr.svg`)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black text-[#102000]"
              style={{ backgroundColor: CLIENT_ACCENT }}
            >
              <Download size={14} /> SVG
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-3">
            <QrCodePreview item={previewItem} size={168} />
          </div>
          <p className="text-[10px] font-medium text-[#9CA3AF]">Scan opens full client catalog</p>
        </div>
      </div>
    </section>
  );
}
