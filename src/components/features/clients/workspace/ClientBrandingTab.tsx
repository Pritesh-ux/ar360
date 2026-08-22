"use client";

import { useState, type FormEvent } from "react";
import { Trash2, Upload } from "lucide-react";
import ViewerBrandMark from "@/components/features/viewer/ViewerBrandMark";
import type { ClientWorkspaceClient } from "@/lib/user-panel/client-workspace";
import { CLIENT_ACCENT } from "@/lib/user-panel/client-workspace";
import { onBrandForeground } from "@/lib/branding/contrast";
import {
  DEFAULT_LOGO_DESIGN,
  mergeLogoDesignIntoBrandingJson,
  type LogoDesign,
  type LogoShape,
  type LogoSizeStep,
} from "@/lib/branding/logo-design";

const SHAPES: Array<{ id: LogoShape; label: string; hint: string }> = [
  { id: "circle", label: "Circle", hint: "Full round" },
  { id: "rounded", label: "Rounded square", hint: "Soft corners" },
  { id: "square", label: "Square", hint: "Sharp corners" },
];

function ShapeGlyph({ shape }: { shape: LogoShape }) {
  const radius =
    shape === "circle" ? "50%" : shape === "rounded" ? "8px" : "0px";
  return (
    <span
      className="grid h-10 w-10 place-items-center bg-[#111111]"
      style={{ borderRadius: radius }}
    >
      <span
        className="h-4 w-4 bg-white"
        style={{ borderRadius: radius }}
      />
    </span>
  );
}

export default function ClientBrandingTab({
  client,
  logoDesign,
  onLogoDesignChange,
  saving,
  onSave,
  onUploadLogo,
  onRemoveLogo,
}: {
  client: ClientWorkspaceClient;
  logoDesign: LogoDesign;
  onLogoDesignChange: (design: LogoDesign) => void;
  saving?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onUploadLogo: (file: File) => Promise<void>;
  onRemoveLogo?: () => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState(client.company_name || "");
  const [viewerTitle, setViewerTitle] = useState(client.viewer_title || "");
  const [brandPrimary, setBrandPrimary] = useState(client.brand_primary || CLIENT_ACCENT);
  const [poweredByLabel, setPoweredByLabel] = useState(client.powered_by_label || "");
  const [busyLogo, setBusyLogo] = useState(false);

  function patchDesign(partial: Partial<LogoDesign>) {
    onLogoDesignChange({ ...logoDesign, ...partial });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSave({
      companyName: companyName.trim(),
      viewerTitle: viewerTitle.trim(),
      brandPrimary,
      poweredByLabel: poweredByLabel.trim(),
      viewerCatalogEnabled: true,
      brandingJson: mergeLogoDesignIntoBrandingJson(client.branding_json, logoDesign),
    });
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mx-auto max-w-2xl space-y-6 rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h3 className="text-[15px] font-extrabold text-[#111111]">Client branding</h3>
        <p className="mt-1 text-xs font-medium text-[#737373]">
          This logo and title appear automatically in Viewer, AR, Share and QR landing when links use
          this client.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]">
              <Upload size={15} />
              {busyLogo ? "Uploading…" : client.logo_url ? "Replace logo" : "Upload company logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusyLogo(true);
                  void onUploadLogo(file).finally(() => setBusyLogo(false));
                  e.target.value = "";
                }}
              />
            </label>
            {client.logo_url && onRemoveLogo ? (
              <button
                type="button"
                disabled={busyLogo}
                onClick={() => {
                  setBusyLogo(true);
                  void onRemoveLogo().finally(() => setBusyLogo(false));
                }}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#737373] hover:bg-[#FAFAFA] hover:text-[#B42318] disabled:opacity-50"
              >
                <Trash2 size={15} />
                Remove logo
              </button>
            ) : null}
          </div>
          <p className="text-[11px] font-medium leading-relaxed text-[#737373]">
            PNG with a transparent background works best. Shape, padding and ring apply on Viewer,
            catalog, header and this preview.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#ECECEC] bg-white p-4 shadow-sm">
          <div className="grid h-[132px] w-full place-items-center rounded-xl bg-[linear-gradient(45deg,#ececec_25%,transparent_25%),linear-gradient(-45deg,#ececec_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ececec_75%),linear-gradient(-45deg,transparent_75%,#ececec_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0]">
            {client.logo_url ? (
              <ViewerBrandMark src={client.logo_url} size={96} design={logoDesign} />
            ) : (
              <span className="text-xs font-bold text-[#A3A3A3]">No logo</span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#A3A3A3]">Live preview</span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-sm">
        <h4 className="border-b border-[#ECECEC] pb-3 text-[14px] font-bold text-[#111111]">
          Logo design
        </h4>

        <p className="mb-2 mt-4 text-xs font-semibold text-[#525252]">Frame shape</p>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((item) => {
            const active = logoDesign.shape === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => patchDesign({ shape: item.id })}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition ${
                  active
                    ? "border-[#84D400] bg-[#EEF9E0] text-[#111111]"
                    : "border-[#ECECEC] bg-[#FAFAFA] text-[#737373] hover:bg-white"
                }`}
              >
                <ShapeGlyph shape={item.id} />
                <span className="text-[11px] font-extrabold leading-tight">{item.label}</span>
                <span className="text-[9px] font-medium text-[#A3A3A3]">{item.hint}</span>
              </button>
            );
          })}
        </div>

        <p className="mb-2 mt-5 text-xs font-semibold text-[#525252]">Logo size</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "sm" as const, label: "Small" },
            { id: "md" as const, label: "Medium" },
            { id: "lg" as const, label: "Large" },
          ] satisfies Array<{ id: LogoSizeStep; label: string }>).map((item) => {
            const active = logoDesign.sizeStep === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => patchDesign({ sizeStep: item.id })}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border py-3 transition ${
                  active
                    ? "border-[#84D400] bg-[#EEF9E0] text-[#111111]"
                    : "border-[#ECECEC] bg-[#FAFAFA] text-[#737373] hover:bg-white"
                }`}
              >
                <span
                  className="rounded-md bg-[#111111]"
                  style={{
                    width: item.id === "sm" ? 14 : item.id === "md" ? 20 : 28,
                    height: item.id === "sm" ? 14 : item.id === "md" ? 20 : 28,
                  }}
                />
                <span className="text-[11px] font-extrabold">{item.label}</span>
              </button>
            );
          })}
        </div>

        <label className="mt-5 block text-xs font-semibold text-[#525252]">
          Padding
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={24}
              value={logoDesign.paddingPct}
              onChange={(e) => patchDesign({ paddingPct: Number(e.target.value) })}
              className="w-full accent-[#84D400]"
            />
            <span className="w-10 shrink-0 text-right text-[11px] font-bold text-[#111111]">
              {logoDesign.paddingPct}%
            </span>
          </div>
        </label>

        <div className="mt-5 grid gap-4 border-t border-[#ECECEC] pt-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-[#525252]">
            Logo background
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-[#ECECEC] bg-white"
                value={
                  logoDesign.background === "transparent" ? "#FFFFFF" : logoDesign.background
                }
                onChange={(e) => patchDesign({ background: e.target.value.toUpperCase() })}
              />
              <input
                type="text"
                value={logoDesign.background === "transparent" ? "NONE" : logoDesign.background}
                onChange={(e) => {
                  const v = e.target.value.trim().toUpperCase();
                  patchDesign({ background: v === "NONE" || v === "TRANSPARENT" ? "transparent" : v });
                }}
                className="h-10 min-w-0 flex-1 rounded-lg border border-[#ECECEC] bg-white px-2.5 text-xs font-bold uppercase text-[#111111] outline-none focus:border-[#84D400]"
              />
            </div>
            <button
              type="button"
              onClick={() => patchDesign({ background: "transparent" })}
              className={`mt-2 h-9 w-full rounded-lg border text-[11px] font-bold ${
                logoDesign.background === "transparent"
                  ? "border-[#84D400] bg-[#EEF9E0] text-[#111111]"
                  : "border-[#ECECEC] bg-white text-[#737373]"
              }`}
            >
              Transparent
            </button>
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#525252]">Border ring</span>
              <button
                type="button"
                role="switch"
                aria-checked={logoDesign.ring}
                onClick={() => patchDesign({ ring: !logoDesign.ring })}
                className={`relative h-6 w-11 rounded-full transition ${
                  logoDesign.ring ? "bg-[#84D400]" : "bg-[#D4D4D8]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    logoDesign.ring ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="mt-1 text-[10px] font-medium text-[#A3A3A3]">
              Optional outline around the logo frame. Off by default.
            </p>
            {logoDesign.ring ? (
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-semibold text-[#525252]">
                  Ring color
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-[#ECECEC] bg-white"
                      value={logoDesign.ringColor}
                      onChange={(e) => patchDesign({ ringColor: e.target.value.toUpperCase() })}
                    />
                    <input
                      type="text"
                      value={logoDesign.ringColor}
                      onChange={(e) => patchDesign({ ringColor: e.target.value.toUpperCase() })}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#ECECEC] bg-white px-2.5 text-xs font-bold uppercase text-[#111111] outline-none focus:border-[#84D400]"
                    />
                  </div>
                </label>
                <label className="block text-xs font-semibold text-[#525252]">
                  Ring thickness
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={logoDesign.ringWidth}
                      onChange={(e) => patchDesign({ ringWidth: Number(e.target.value) })}
                      className="w-full accent-[#84D400]"
                    />
                    <span className="w-8 shrink-0 text-right text-[11px] font-bold text-[#111111]">
                      {logoDesign.ringWidth}px
                    </span>
                  </div>
                </label>
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onLogoDesignChange(DEFAULT_LOGO_DESIGN)}
          className="mt-4 text-[11px] font-bold text-[#737373] hover:text-[#111111]"
        >
          Reset logo design
        </button>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
          Company name
        </span>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className={INPUT}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
          Viewer title
        </span>
        <input
          value={viewerTitle}
          onChange={(e) => setViewerTitle(e.target.value)}
          placeholder="Shown in AR / Viewer header"
          className={INPUT}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
          Primary color (optional)
        </span>
        <p className="mb-2 text-[11px] font-medium leading-relaxed text-[#737373]">
          Colors Share, View in AR, and other viewer accent buttons. Button text switches to white or dark automatically so it stays readable on black or bright colors.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={brandPrimary || CLIENT_ACCENT}
            onChange={(e) => setBrandPrimary(e.target.value)}
            className="h-11 w-14 rounded-xl border border-[#ECECEC] bg-white p-1"
          />
          <input
            value={brandPrimary}
            onChange={(e) => setBrandPrimary(e.target.value)}
            className={INPUT}
          />
          <span
            className="grid h-11 shrink-0 place-items-center rounded-2xl px-3 text-[11px] font-bold"
            style={{
              backgroundColor: brandPrimary || CLIENT_ACCENT,
              color: onBrandForeground(brandPrimary || CLIENT_ACCENT),
            }}
          >
            Button
          </span>
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
          White-label name
        </span>
        <p className="mb-2 text-[11px] font-medium leading-relaxed text-[#737373]">
          Replaces AR360 in “Powered by …” on this client’s viewer. Leave empty to use workspace branding.
        </p>
        <input
          value={poweredByLabel}
          onChange={(e) => setPoweredByLabel(e.target.value)}
          maxLength={80}
          placeholder="Company name"
          className={INPUT}
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-[#102000] disabled:opacity-60"
        style={{ backgroundColor: CLIENT_ACCENT }}
      >
        {saving ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}

const INPUT =
  "h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]";
