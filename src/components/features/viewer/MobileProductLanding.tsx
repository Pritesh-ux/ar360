"use client";

import { Box, Smartphone } from "lucide-react";
import { normalizeViewerAssetUrl } from "@/components/features/viewer/viewer-utils";

type Props = {
  title: string;
  subtitle?: string;
  description?: string;
  brandName?: string;
  category?: string;
  collection?: string;
  sku?: string;
  poster?: string;
  logo?: string;
  hidePoweredBy?: boolean;
  viewerTheme?: string;
  ctaLabel?: string;
  buttonStyle?: string;
  headerStyle?: string;
  viewerFont?: string;
  onView3D: () => void;
  onViewAR: () => void;
};

function fontFamily(font?: string) {
  if (font === "sans") return 'var(--font-auth-body), "Instrument Sans", system-ui, sans-serif';
  if (font === "serif") return 'Georgia, "Times New Roman", serif';
  if (font === "display") return 'var(--font-auth-display), Outfit, system-ui, sans-serif';
  return "system-ui, -apple-system, Segoe UI, sans-serif";
}

function arButtonClass(style?: string) {
  if (style === "outline") {
    return "border-2 border-[var(--ar-primary)] bg-transparent text-[#111827] hover:bg-[var(--ar-primary-soft)]";
  }
  if (style === "soft") {
    return "border border-transparent bg-[var(--ar-primary-soft)] text-[#111827] hover:bg-[var(--ar-primary)]";
  }
  return "border border-transparent bg-[var(--ar-primary)] text-[#111827] hover:bg-[var(--ar-primary-hover)]";
}

export default function MobileProductLanding({
  title,
  subtitle,
  description,
  brandName,
  category,
  collection,
  sku,
  poster,
  logo,
  hidePoweredBy = false,
  viewerTheme = "default",
  ctaLabel,
  buttonStyle = "filled",
  headerStyle = "glass",
  viewerFont = "system",
  onView3D,
  onViewAR,
}: Props) {
  const dark = viewerTheme === "dark";
  const meta = [
    collection ? { label: "Collection", value: collection } : null,
    sku ? { label: "SKU", value: sku } : null,
    brandName || category ? { label: "Brand", value: brandName || category || "" } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const headerClass =
    headerStyle === "solid"
      ? dark
        ? "border-white/10 bg-[#1C1F22]"
        : "border-[#E5E7EB] bg-white"
      : headerStyle === "minimal"
        ? "border-transparent bg-transparent"
        : dark
          ? "border-white/10 bg-white/10 backdrop-blur-md"
          : "border-[#E5E7EB] bg-white/90 backdrop-blur-md";

  return (
    <main
      data-mobile-viewer-theme={viewerTheme}
      className={`fixed inset-0 z-[60] flex flex-col overflow-y-auto ${
        viewerTheme === "dark" ? "bg-[#17191D] text-white" : "bg-white text-[#111827]"
      }`}
      style={{ fontFamily: fontFamily(viewerFont) }}
    >
      <header
        className={`mx-3 mt-[max(12px,env(safe-area-inset-top))] flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${headerClass}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {logo ? (
            <span className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1">
              <img src={logo} alt="Brand logo" className="h-full w-full object-contain" />
            </span>
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ar-primary)] text-[11px] font-black text-[#111827]">
              AR
            </div>
          )}
          <p className="truncate text-[15px] font-semibold tracking-tight">
            {brandName || "AR360 Studio"}
          </p>
        </div>
        {!hidePoweredBy ? (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              dark
                ? "border-white/15 bg-white/10 text-white/65"
                : "border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]"
            }`}
          >
            Powered by AR360
          </span>
        ) : null}
      </header>

      <div className="mx-4 mt-3 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC]">
        {poster ? (
          <img
            src={normalizeViewerAssetUrl(poster)}
            alt={title}
            className="aspect-[4/3] w-full object-contain bg-white"
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-[#9CA3AF]">
            <Box size={40} />
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pb-4 pt-5">
        <h1
          className={`text-[26px] font-semibold leading-tight tracking-[-0.03em] ${
            dark ? "text-white" : "text-[#111827]"
          }`}
        >
          {title || "3D Product"}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-[14px] font-medium text-[#6B7280]">{subtitle}</p>
        ) : category ? (
          <p className="mt-1.5 text-[14px] font-medium text-[#6B7280]">{category}</p>
        ) : null}

        {description ? (
          <p className="mt-4 text-[14px] leading-6 text-[#6B7280]">{description}</p>
        ) : (
          <p className="mt-4 text-[14px] leading-6 text-[#6B7280]">
            Explore this product in interactive 3D or place it in your space with AR.
          </p>
        )}

        {meta.length > 0 ? (
          <div className="mt-5 space-y-0 border-t border-[#E5E7EB]">
            {meta.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] py-3"
              >
                <span className="text-[13px] font-medium text-[#9CA3AF]">{row.label}</span>
                <span
                  className={`truncate text-[13px] font-semibold ${dark ? "text-white" : "text-[#111827]"}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className={`sticky bottom-0 grid grid-cols-2 gap-3 border-t px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md ${
          dark ? "border-white/15 bg-[#17191D]/95" : "border-[#E5E7EB] bg-white/95"
        }`}
      >
        <button
          type="button"
          onClick={onView3D}
          className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-[var(--ar-primary)] text-[14px] font-semibold transition active:scale-[0.98] ${
            dark ? "bg-white/10 text-white" : "bg-white text-[#111827]"
          }`}
        >
          <Box size={18} />
          View in 3D
        </button>
        <button
          type="button"
          onClick={onViewAR}
          className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition active:scale-[0.98] ${arButtonClass(buttonStyle)} ${
            dark && buttonStyle === "outline" ? "text-white" : ""
          }`}
        >
          <Smartphone size={18} />
          {ctaLabel || "View in AR"}
        </button>
      </div>
    </main>
  );
}
