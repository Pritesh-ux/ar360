"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Code2, Copy, Link2, Trash2, Upload } from "lucide-react";
import QRCode from "qrcode";
import { getRangeStyle } from "./utils";
import StudioColorPicker from "./StudioColorPicker";

export function TopTool({
  icon,
  active,
  onClick,
}: {
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`editor-panel-tab relative grid h-10 flex-1 place-items-center rounded-[10px] transition-colors duration-150 ${
        active
          ? "bg-[#F4F5F5] text-[#111416]"
          : "bg-transparent text-[#5F666A] hover:bg-[#F1F3F4] hover:text-[#111416]"
      }`}
    >
      {icon}
      {active ? (
        <span className="absolute inset-x-2 -bottom-[7px] mx-auto h-[2px] w-6 rounded-full bg-[#C8FF46]" />
      ) : null}
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
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="editor-material-section editor-section-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-semibold text-[#525252]">{label}</span>
      <div className="flex items-center gap-3">
        <StudioColorPicker value={value} onChange={onChange} onReset={onReset} title={label} />
        <button type="button" onClick={onReset} className="editor-ghost-action" title="Reset">
          Reset
        </button>
      </div>
    </div>
  );
}

export function MaterialTextureRow({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  onReset?: () => void;
}) {
  function handleTexture(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange?.(reader.result as string);
    reader.readAsDataURL(file);
  }

  function resetTexture() {
    onChange?.("");
    onReset?.();
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-semibold text-[#525252]">{label}</span>
      <div className="flex items-center gap-3">
        <label className="studio-texture-swatch relative grid h-14 w-14 cursor-pointer place-items-center overflow-hidden rounded-md border-2 border-[#6B7280] bg-[#F3F4F6] shadow-sm">
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
          {value ? (
            <img src={value} className="h-full w-full object-cover" alt="texture" />
          ) : (
            <>
              <span className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-red-500/70" />
              <span className="absolute left-0 top-0 h-[1px] w-[90px] origin-left rotate-45 bg-red-500" />
            </>
          )}
        </label>
        <button type="button" onClick={resetTexture} className="editor-ghost-action" title="Remove texture">
          Reset
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="text-[13px] font-semibold text-[#525252]">{label}</label>
      <div className="flex items-center gap-3 mt-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="editor-range flex-1"
          style={getRangeStyle(value, min, max)}
        />
        <div className="editor-value-pill grid h-10 w-16 place-items-center rounded-lg font-bold">
          {Number(value.toFixed(2))}
        </div>
        <button type="button" onClick={onReset} className="editor-ghost-action" title="Reset">
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
          <img src={qrDataUrl} alt={`${title} QR`} className="h-auto w-full rounded-xl" />
          <p className="mt-2 text-center text-[11px] font-semibold text-[#6B7280]">
            Scan with phone to open product
          </p>
        </div>
      ) : null}
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
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(qrDestination, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#FFFFFF" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [qrDestination]);

  return (
    <div
      className="editor-poster-preview group relative mt-4 aspect-square w-full overflow-hidden rounded-xl border border-[#C8CDD4] bg-white"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="absolute inset-0 p-3">
        <img src={posterUrl} alt="Poster" className="h-full w-full object-contain" />
      </div>
      {hover && qrDataUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/94 p-4 backdrop-blur-[2px]">
          <img src={qrDataUrl} alt="Product QR" className="h-[140px] w-[140px] rounded-xl border border-[#E5E7EB]" />
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

  const isCustomHdr = value.startsWith("blob:") || value.startsWith("data:");

  return (
    <div className="editor-control-card rounded-[16px] border border-[#ECECEC] bg-white p-4">
      <div className="mb-3">
        <h4 className="text-[14px] font-semibold text-[#111111]">Environment Library</h4>
        <p className="mt-1 text-[12px] leading-relaxed text-[#737373]">Choose a premium lighting setup for your 3D model.</p>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={isCustomHdr ? "custom" : value}
          onChange={(e) => {
            const val = e.target.value;
            if (val !== "custom") {
              onChange(val);
            }
          }}
          className="h-10 flex-1 rounded-lg border border-[#ECECEC] bg-white px-3 text-[13px] font-bold text-[#111111] outline-none transition focus:border-[#84D400]"
        >
          {isCustomHdr && <option value="custom">Custom HDR (Uploaded)</option>}
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>

        <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#ECECEC] bg-[#FAFAFA] text-[#737373] transition hover:border-[#84D400] hover:text-[#84D400]" title="Upload Custom HDR">
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
