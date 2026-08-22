"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import CopyPasteContextTarget from "./CopyPasteContextTarget";
import AppImage from "@/components/shared/AppImage";
import {
  CLEAR_MATERIAL_TEXTURE,
  isClearedMaterialTexture,
} from "@/lib/materials/diamond-look";
import QrCodePreview, {
  downloadQrPng as downloadBrandedQrPng,
  downloadQrSvg as downloadBrandedQrSvg,
  type QrPreviewItem,
} from "@/components/user-panel/QrCodePreview";
import {
  buildEmbedIframeCode,
  getCanonicalPublicViewerUrl,
} from "@/lib/user-panel/public-viewer";
import { AR360_QR_CENTER_LOGO_PATH, AR360_QR_CENTER_LOGO_SIZE } from "@/lib/growth/qr-logo-shared";
import { ChevronDown, Code2, Copy, Download, Eye, EyeOff, ExternalLink, FileCode2, FileImage, Globe2, Image as ImageIcon, Link2, MonitorSmartphone, Pencil, Play, QrCode, Smartphone, Trash2, Upload } from "lucide-react";
import QRCode from "qrcode";
import { getRangeStyle } from "./utils";
import StudioColorPicker from "./StudioColorPicker";

/** Same branded QR used by poster hover + Preview & Share (AR360 center logo). */
function buildEditorBrandedQrItem(destinationUrl: string, id: string): QrPreviewItem {
  return {
    id,
    productId: "editor",
    destinationUrl,
    foregroundColor: "#111827",
    backgroundColor: "#FFFFFF",
    patternStyle: "square",
    cornerStyle: "square",
    logoUrl: AR360_QR_CENTER_LOGO_PATH,
    logoSize: AR360_QR_CENTER_LOGO_SIZE,
    frameEnabled: false,
    frameStyle: "simple",
    frameColor: "#111827",
    frameText: "SCAN ME",
  };
}

export function TopTool({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      title={label}
      className={`editor-panel-tab relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 transition-colors duration-150 ${
        active
          ? "bg-[#EEF9E0] text-[#102000]"
          : "bg-transparent text-[#374151] hover:bg-[#F1F3F4] hover:text-[#111416]"
      }`}
    >
      <span className="grid place-items-center [&_svg]:stroke-[2.25]">{icon}</span>
      <span className="max-w-full truncate text-[10px] font-bold leading-none tracking-wide">
        {label}
      </span>
    </button>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#ECECEC] py-3">
      <span className="text-[13px] font-medium text-[#525252]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`editor-toggle h-8 w-14 rounded-full transition ${checked ? "is-on" : ""}`}
        aria-pressed={checked}
      >
        <div className={`h-6 w-6 rounded-full transition m-1 ${checked ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );
}

export function MaterialSection({
  title,
  children,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled accordion open state (Material Inspector). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openUncontrolled, setOpenUncontrolled] = useState(defaultOpen);
  const controlled = openControlled !== undefined;
  const open = controlled ? Boolean(openControlled) : openUncontrolled;

  function toggle() {
    const next = !open;
    if (!controlled) setOpenUncontrolled(next);
    onOpenChange?.(next);
  }

  return (
    <section className="editor-material-section editor-section-block">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="editor-material-trigger flex min-h-[52px] w-full items-center justify-between bg-white px-4 text-left"
      >
        <span className="editor-material-title text-[14px] font-semibold leading-tight text-[#111111]">
          {title}
        </span>
        <ChevronDown
          size={18}
          className={`editor-material-chevron shrink-0 text-[#737373] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="editor-material-body space-y-4 bg-[#FAFAFA] p-4 text-[#111111]">{children}</div>
      )}
    </section>
  );
}

export function MaterialColorRow({
  label,
  value,
  onChange,
  onReset,
  tooltip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-semibold text-[#525252]" title={tooltip || label}>
        {label}
      </span>
      <div className="flex items-center gap-3">
        <StudioColorPicker value={value} onChange={onChange} onReset={onReset} title={tooltip || label} />
        <button type="button" onClick={onReset} className="editor-ghost-action" title="Reset">
          Reset
        </button>
      </div>
    </div>
  );
}

export function TextureContextTarget({
  children,
  className,
  getCopy,
  onPaste,
}: {
  children: ReactNode;
  className?: string;
  getCopy: () => { value: string; extras?: Record<string, unknown> } | null;
  onPaste: (payload: { value: string; extras?: Record<string, unknown> }) => void;
}) {
  return (
    <CopyPasteContextTarget
      className={className}
      channel="texture"
      getCopy={getCopy}
      onPaste={onPaste}
    >
      {children}
    </CopyPasteContextTarget>
  );
}

export function MaterialTextureRow({
  label,
  value,
  onChange,
  onReset,
  tooltip,
  copyExtras,
  onPasteExtras,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  onReset?: () => void;
  tooltip?: string;
  copyExtras?: Record<string, unknown>;
  onPasteExtras?: (extras: Record<string, unknown>) => void;
}) {
  function handleTexture(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange?.(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeTexture() {
    // Empty string means "leave the baked GLB map". Remove must unpin.
    onChange?.(CLEAR_MATERIAL_TEXTURE);
  }

  // `__clear__` is an unpin sentinel, not a URL — never render as <img src>.
  const previewSrc =
    value && !isClearedMaterialTexture(value) ? value : "";
  const hasTexture = Boolean(previewSrc);
  // Empty UI still needs Remove: previous bump/normal can remain on the Three mesh.
  const canRemove = hasTexture || !isClearedMaterialTexture(value);

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-semibold text-[#525252]" title={tooltip || label}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <TextureContextTarget
          getCopy={() => (hasTexture ? { value: previewSrc, extras: copyExtras } : null)}
          onPaste={(payload) => {
            onChange?.(payload.value);
            if (payload.extras) onPasteExtras?.(payload.extras);
          }}
        >
          <label
            className="studio-texture-swatch relative grid h-14 w-14 cursor-pointer place-items-center overflow-hidden rounded-md border-2 border-[#6B7280] bg-[#F3F4F6] shadow-sm"
            title={hasTexture ? "Right-click to copy / paste" : "Upload texture · right-click to paste"}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleTexture(file);
                e.currentTarget.value = "";
              }}
            />
            {hasTexture ? (
              <AppImage src={previewSrc} className="h-full w-full object-cover" alt="texture" />
            ) : (
              <>
                <span className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-red-500/70" />
                <span className="absolute left-0 top-0 h-[1px] w-[90px] origin-left rotate-45 bg-red-500" />
              </>
            )}
          </label>
        </TextureContextTarget>
        <button
          type="button"
          onClick={removeTexture}
          className="editor-ghost-action"
          title="Remove texture"
          disabled={!canRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function MaterialSliderRow({
  label,
  value,
  onChange,
  onReset,
  min = 0,
  max = 1,
  step = 0.05,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
}) {
  function clamp(next: number) {
    if (!Number.isFinite(next)) return min;
    return Math.min(max, Math.max(min, next));
  }

  function commit(next: number) {
    onChange(clamp(next));
  }

  return (
    <div>
      <label className="text-[13px] font-semibold text-[#525252]" title={tooltip || label}>
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => commit(Number(e.target.value))}
          className="editor-range min-w-0 flex-1"
          style={getRangeStyle(value, min, max)}
          title={tooltip || label}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(3))}
          onChange={(e) => commit(Number(e.target.value))}
          className="editor-value-pill h-10 w-[4.5rem] rounded-lg border border-[#E5E7EB] bg-white text-center text-[12px] font-bold text-[#111111] outline-none"
          title={tooltip || label}
        />
        <button type="button" onClick={onReset} className="editor-ghost-action shrink-0" title="Reset">
          Reset
        </button>
      </div>
    </div>
  );
}

export function MaterialSignedSliderRow({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onReset?: () => void;
}) {
  return (
    <div>
      <label className="text-[13px] font-semibold text-[#525252]">{label}</label>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          min="-0.5"
          max="0.5"
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="editor-range flex-1"
          style={getRangeStyle(value, -0.5, 0.5)}
        />
        <div className="editor-value-pill grid h-10 w-16 place-items-center rounded-lg font-bold">
          {value.toFixed(2)}
        </div>
        <button type="button" onClick={onReset} className="editor-ghost-action" title="Reset">
          Reset
        </button>
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  open = true,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(open);

  return (
    <section className="editor-panel-section editor-section-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center justify-between bg-white px-4 text-left"
      >
        <span className="text-[14px] font-semibold leading-tight text-[#111111]">{title}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[#737373] transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <div className="space-y-4 bg-[#FAFAFA] px-4 pb-4 pt-2 text-[#111111]">{children}</div>}
    </section>
  );
}

export function ExportRow({
  icon,
  title,
  value,
  hoverQrUrl,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  /** When set, hover shows a scannable QR for this destination */
  hoverQrUrl?: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!hoverQrUrl) return;
    let cancelled = false;
    void QRCode.toDataURL(hoverQrUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#FFFFFF" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [hoverQrUrl]);

  function copyValue() {
    void navigator.clipboard.writeText(value);
  }

  return (
    <div
      className="editor-export-row relative flex min-h-[52px] items-center gap-3 py-2"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#6B7280] [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#6B7280]">{title}</p>
      <button
        type="button"
        onClick={copyValue}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#9CA3AF] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
        title="Copy"
        aria-label={`Copy ${title}`}
      >
        <Copy size={16} />
      </button>
      <a
        href={value.startsWith("http") || value.startsWith("/") ? value : undefined}
        target="_blank"
        rel="noreferrer"
        className="grid h-8 w-8 place-items-center rounded-lg text-[#9CA3AF] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
        title="Open"
        aria-label={`Open ${title}`}
      >
        <Link2 size={16} />
      </a>
      <button
        type="button"
        onClick={copyValue}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#9CA3AF] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
        title="Copy link"
        aria-label={`Copy ${title} link`}
      >
        <Code2 size={16} />
      </button>

      {hover && hoverQrUrl && qrDataUrl ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[200px] rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_12px_32px_rgba(17,24,39,0.12)]">
          <AppImage src={qrDataUrl} alt={`${title} QR`} className="h-auto w-full rounded-xl" />
          <p className="mt-2 text-center text-[11px] font-semibold text-[#6B7280]">
            Scan with phone to open product
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ShareActionButton({
  label,
  icon,
  onClick,
  href,
  active,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Soft highlight when a toggle action is on (e.g. preview open). */
  active?: boolean;
}) {
  const className = `grid h-8 w-8 place-items-center rounded-lg transition ${
    active
      ? "bg-[#EEF9E0] text-[#102000]"
      : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
  }`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        title={label}
        aria-label={label}
      >
        {icon}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={active ? true : undefined}
    >
      {icon}
    </button>
  );
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function downloadRemoteFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    downloadDataUrl(objectUrl, filename);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open in a new tab when blob download is blocked.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Camera-tab Preview & Share — icon actions with tooltips. */
export function PreviewSharePanel({
  publicId,
  publicOrigin,
  posterUrl,
  productSlug,
  onCustomizePoster,
  onToast,
}: {
  publicId: string;
  publicOrigin: string;
  posterUrl: string;
  productSlug: string;
  onCustomizePoster: () => void;
  onToast: (message: string) => void;
}) {
  const id = String(publicId || "").trim();
  const viewerUrl = getCanonicalPublicViewerUrl(id, publicOrigin);
  const embedCode = buildEmbedIframeCode(id, publicOrigin);
  const qrUrl = `${viewerUrl}?source=qr&landing=1`;
  const iosUrl = `${viewerUrl}?ar=ios`;
  const androidUrl = `${viewerUrl}?ar=android`;
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const fileBase = productSlug.replace(/[^\w.-]+/g, "-") || "product";
  const qrItem = useMemo(
    () => buildEditorBrandedQrItem(qrUrl, `share-qr-${id || "product"}`),
    [qrUrl, id],
  );

  async function handleCopy(label: string, value: string) {
    const ok = await copyText(value);
    onToast(ok ? `${label} copied` : `Could not copy ${label.toLowerCase()}`);
  }

  async function downloadQrPng() {
    try {
      await downloadBrandedQrPng(qrItem, `${fileBase}-qr.png`);
      onToast("QR PNG downloaded");
    } catch {
      onToast("QR PNG download failed — open Preview first");
    }
  }

  async function downloadQrSvgFile() {
    try {
      await downloadBrandedQrSvg(qrItem, `${fileBase}-qr.svg`);
      onToast("QR SVG downloaded");
    } catch {
      onToast("QR SVG download failed — open Preview first");
    }
  }

  return (
    <div className="mt-1 divide-y divide-[#ECECEC]">
      {/* Universal Link */}
      <section className="py-3.5 first:pt-1">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#6B7280]">
            <Globe2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="min-w-0 truncate text-[13px] font-semibold text-[#111827]">
                Universal Link
              </h4>
              <div className="flex shrink-0 items-center gap-0.5">
                <ShareActionButton
                  label="Copy link"
                  icon={<Copy size={16} />}
                  onClick={() => void handleCopy("Link", viewerUrl)}
                />
                <ShareActionButton
                  label="Open"
                  icon={<ExternalLink size={16} />}
                  href={viewerUrl}
                />
                <ShareActionButton
                  label="Copy embed code"
                  icon={<Code2 size={16} />}
                  onClick={() => void handleCopy("Embed code", embedCode)}
                />
              </div>
            </div>
            <p
              className="mt-2 truncate rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5 font-mono text-[11px] text-[#374151]"
              title={viewerUrl}
            >
              {viewerUrl}
            </p>
          </div>
        </div>
      </section>

      {/* QR Code */}
      <section className="py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#6B7280]">
            <QrCode size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="min-w-0 truncate text-[13px] font-semibold text-[#111827]">QR Code</h4>
              <div className="flex shrink-0 items-center gap-0.5">
                <ShareActionButton
                  label={qrPreviewOpen ? "Hide preview" : "Preview QR"}
                  icon={qrPreviewOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                  active={qrPreviewOpen}
                  onClick={() => setQrPreviewOpen((v) => !v)}
                />
                <ShareActionButton
                  label="Download PNG"
                  icon={<FileImage size={16} />}
                  onClick={() => void downloadQrPng()}
                />
                <ShareActionButton
                  label="Download SVG"
                  icon={<FileCode2 size={16} />}
                  onClick={() => void downloadQrSvgFile()}
                />
              </div>
            </div>
            {/* Keep branded SVG mounted so download works even when preview is closed. */}
            <div
              className={
                qrPreviewOpen
                  ? "mt-3 w-[168px] rounded-xl border border-[#E5E7EB] bg-white p-2.5 shadow-sm"
                  : "pointer-events-none absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden opacity-0"
              }
              aria-hidden={!qrPreviewOpen}
            >
              <QrCodePreview item={qrItem} size={qrPreviewOpen ? 168 : 390} />
            </div>
          </div>
        </div>
      </section>

      {/* iPhone Quick Look */}
      <section className="py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#6B7280]">
            <Smartphone size={18} />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <h4 className="min-w-0 truncate text-[13px] font-semibold text-[#111827]">
              iPhone (Quick Look)
            </h4>
            <div className="flex shrink-0 items-center gap-0.5">
              <ShareActionButton label="Test on iPhone" icon={<Play size={16} />} href={iosUrl} />
              <ShareActionButton
                label="Copy link"
                icon={<Copy size={16} />}
                onClick={() => void handleCopy("iPhone link", iosUrl)}
              />
              <ShareActionButton
                label="Developer code"
                icon={<Code2 size={16} />}
                onClick={() =>
                  void handleCopy(
                    "Developer code",
                    `<!-- AR360 iOS Quick Look -->\n<a rel="ar" href="${iosUrl}">View in AR</a>`,
                  )
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Android Scene Viewer */}
      <section className="py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#6B7280]">
            <MonitorSmartphone size={18} />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <h4 className="min-w-0 truncate text-[13px] font-semibold text-[#111827]">
              Android (Scene Viewer)
            </h4>
            <div className="flex shrink-0 items-center gap-0.5">
              <ShareActionButton label="Test on Android" icon={<Play size={16} />} href={androidUrl} />
              <ShareActionButton
                label="Copy link"
                icon={<Copy size={16} />}
                onClick={() => void handleCopy("Android link", androidUrl)}
              />
              <ShareActionButton
                label="Developer code"
                icon={<Code2 size={16} />}
                onClick={() =>
                  void handleCopy(
                    "Developer code",
                    `<!-- AR360 Android Scene Viewer -->\n<a href="${androidUrl}">View in AR</a>`,
                  )
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Marketing Poster */}
      <section className="py-3.5 last:pb-1">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#6B7280]">
            <ImageIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="min-w-0 truncate text-[13px] font-semibold text-[#111827]">
                Marketing Poster
              </h4>
              <div className="flex shrink-0 items-center gap-0.5">
                <ShareActionButton
                  label={posterPreviewOpen ? "Hide preview" : "Preview poster"}
                  icon={posterPreviewOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                  active={posterPreviewOpen}
                  onClick={() => setPosterPreviewOpen((v) => !v)}
                />
                <ShareActionButton
                  label="Download poster"
                  icon={<Download size={16} />}
                  onClick={() => {
                    if (!posterUrl) {
                      onToast("Generate poster first");
                      return;
                    }
                    void downloadRemoteFile(posterUrl, `${fileBase}-poster.png`).then(() =>
                      onToast("Poster downloaded"),
                    );
                  }}
                />
                <ShareActionButton
                  label="Customize poster"
                  icon={<Pencil size={16} />}
                  onClick={onCustomizePoster}
                />
              </div>
            </div>
            {posterPreviewOpen && posterUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
                <AppImage src={posterUrl} alt="Marketing poster" className="h-auto w-full object-contain" />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function PosterQrThumb({
  posterUrl,
  qrDestination,
}: {
  posterUrl: string;
  qrDestination: string;
}) {
  const [hover, setHover] = useState(false);
  const qrItem = useMemo(
    () => buildEditorBrandedQrItem(qrDestination, `poster-thumb-${qrDestination}`),
    [qrDestination],
  );

  return (
    <div
      className="editor-poster-preview group relative mt-4 aspect-square w-full overflow-hidden rounded-xl border border-[#C8CDD4] bg-white"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="absolute inset-0 p-3">
        <AppImage src={posterUrl} alt="Poster" className="h-full w-full object-contain" />
      </div>
      {hover ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/94 p-4 backdrop-blur-[2px]">
          <QrCodePreview item={qrItem} size={140} />
          <p className="mt-2 text-center text-[12px] font-semibold text-[#6B7280]">
            Hover scan — open on your phone
          </p>
        </div>
      ) : (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#9CA3AF] opacity-0 transition group-hover:opacity-100">
          Hover for QR
        </p>
      )}
    </div>
  );
}

export function EnvironmentLibrary({
  value,
  onChange,
  onHdrUpload,
  onRemoveHdr,
}: {
  value: string;
  onChange: (value: string) => void;
  onHdrUpload: (file: File) => void | Promise<void>;
  onRemoveHdr: () => void;
}) {
  const environments = [
    { id: "default", name: "Default", desc: "Model Viewer Default Lighting", bg: "bg-gradient-to-br from-slate-100 to-slate-400" },
    { id: "/hdr/neutral.hdr", name: "Neutral", desc: "Clean studio light", bg: "from-slate-100 via-white to-slate-300" },
    { id: "/hdr/studio.hdr", name: "Studio", desc: "Soft product studio", bg: "from-white via-cyan-100 to-slate-300" },
    { id: "/hdr/warehouse.hdr", name: "Warehouse", desc: "Industrial soft HDR", bg: "from-stone-300 via-stone-500 to-stone-800" },
    { id: "/hdr/outdoor.hdr", name: "Outdoor", desc: "Natural daylight", bg: "from-sky-200 via-emerald-200 to-teal-500" },
    { id: "/hdr/sunset.hdr", name: "Sunset", desc: "Warm evening tone", bg: "from-orange-200 via-rose-300 to-purple-600" },
    { id: "/hdr/night.hdr", name: "Night", desc: "Dark premium light", bg: "from-slate-950 via-indigo-900 to-cyan-700" },
  ];

  const isCustomHdr =
    value.startsWith("blob:") ||
    value.startsWith("data:") ||
    /environment\.hdr(\?|$)/i.test(value) ||
    (value.includes("/api/assets/") && /\.hdr(\?|$)/i.test(value));

  const selectValue = isCustomHdr
    ? "custom"
    : value === "neutral"
      ? "/hdr/neutral.hdr"
      : value;

  return (
    <div className="editor-control-card rounded-[16px] border border-[#ECECEC] bg-white p-4">
      <div className="mb-3">
        <h4 className="text-[14px] font-semibold text-[#111111]">Environment Library</h4>
        <p className="mt-1 text-[12px] leading-relaxed text-[#737373]">Choose a premium lighting setup for your 3D model.</p>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selectValue}
          onChange={(e) => {
            const val = e.target.value;
            if (val !== "custom") {
              onChange(val);
            }
          }}
          className="h-10 flex-1 rounded-lg border border-[#ECECEC] bg-white px-3 text-[13px] font-bold text-[#111111] outline-none transition focus:border-[#B8FF3C]"
        >
          {isCustomHdr && <option value="custom">Custom HDR (Uploaded)</option>}
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>

        <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#ECECEC] bg-[#FAFAFA] text-[#737373] transition hover:border-[#B8FF3C] hover:text-[#5FA800]" title="Upload Custom HDR">
          <input
            type="file"
            accept=".hdr"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onHdrUpload(file);
              e.currentTarget.value = "";
            }}
          />
          <Upload size={16} />
        </label>

        {isCustomHdr && (
          <button
            type="button"
            onClick={onRemoveHdr}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
            title="Remove Custom HDR"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {isCustomHdr && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-emerald-700">
          Custom Radiance HDR is active. Use exposure to control lighting.
        </p>
      )}
    </div>
  );
}
