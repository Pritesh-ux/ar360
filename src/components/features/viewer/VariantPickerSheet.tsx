"use client";

import { Check, Palette, X } from "lucide-react";
import AppImage from "@/components/shared/AppImage";
import ViewportPortal from "@/components/shared/ViewportPortal";
import type { ProductVariant } from "./types";
import { getVariantSwatchColor, normalizeViewerAssetUrl } from "./viewer-utils";

type Props = {
  open: boolean;
  variants: ProductVariant[];
  selectedId: string | null;
  pendingId: string | null;
  onSelect: (variantId: string) => void;
  onApply: () => void;
  onClose: () => void;
};

export default function VariantPickerSheet({
  open,
  variants,
  selectedId,
  pendingId,
  onSelect,
  onApply,
  onClose,
}: Props) {
  if (!open || variants.length === 0) return null;
  const activeId = pendingId || selectedId;
  const dirty = Boolean(pendingId && pendingId !== selectedId);

  return (
    <ViewportPortal>
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose variant"
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 flex w-full max-h-[min(86dvh,640px)] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-[420px] sm:rounded-[24px]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F0FBD9] text-[#3F7A00]">
              <Palette size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-black text-slate-950">Choose finish</h2>
              <p className="text-[12px] font-semibold text-slate-500">Tap a thumbnail, then apply</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"
            aria-label="Close variants"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {variants.map((variant) => {
            const selected = activeId === variant.id;
            const swatch = getVariantSwatchColor(variant);
            const poster = normalizeViewerAssetUrl(variant.poster);
            return (
              <button
                key={variant.id}
                type="button"
                title={variant.name || "Variant"}
                aria-label={variant.name || "Variant"}
                aria-pressed={selected}
                onClick={() => onSelect(variant.id)}
                className={`relative aspect-square overflow-hidden rounded-2xl border transition ${
                  selected
                    ? "border-[#84D400] ring-2 ring-[#84D400]/40 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {poster ? (
                  <AppImage src={poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="absolute inset-0"
                    style={{ backgroundColor: swatch }}
                    aria-hidden
                  />
                )}
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#84D400] text-slate-950 shadow">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                ) : null}
              </button>
            );
          })}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-5">
          <button
            type="button"
            onClick={onApply}
            disabled={!activeId}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#84D400] text-[14px] font-bold text-slate-950 disabled:opacity-50"
          >
            {dirty ? "Apply changes" : "Done"}
          </button>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
}
