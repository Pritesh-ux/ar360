"use client";

import { useRef } from "react";
import AppImage from "@/components/shared/AppImage";
import { TextureContextTarget } from "@/components/features/editor/EditorUi";
import { isClearedMaterialTexture } from "@/lib/materials/diamond-look";
import type { MaterialSetting } from "@/components/features/editor/types";

type Props = {
  setting: MaterialSetting;
  onChange: (partial: Partial<MaterialSetting>) => void;
};

function n(value: number | undefined, fallback: number) {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
}

async function logoContentUv(src: string) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image"));
    if (src.startsWith("/api/assets/") || src.startsWith("/Storage/")) {
      void fetch(src, { credentials: "include", cache: "force-cache" })
        .then((res) => {
          if (!res.ok) throw new Error("fetch");
          return res.blob();
        })
        .then((blob) => {
          el.src = URL.createObjectURL(blob);
        })
        .catch(reject);
      return;
    }
    el.crossOrigin = "anonymous";
    el.src = src;
  });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      const ink = data[i] + data[i + 1] + data[i + 2];
      if (a > 12 && ink < 720) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const padX = Math.max(2, (maxX - minX) * 0.06);
  const padY = Math.max(2, (maxY - minY) * 0.06);
  const u0 = Math.max(0, (minX - padX) / w);
  const u1 = Math.min(1, (maxX + padX) / w);
  const vTop = Math.max(0, (minY - padY) / h);
  const vBot = Math.min(1, (maxY + padY) / h);
  return {
    baseColorTexScaleU: Math.max(0.05, u1 - u0),
    baseColorTexScaleV: Math.max(0.05, vBot - vTop),
    baseColorTexOffsetU: u0,
    baseColorTexOffsetV: 1 - vBot,
  };
}

export default function BaseColorMapPlacement({ setting, onChange }: Props) {
  const drag = useRef<{ x: number; y: number; ou: number; ov: number } | null>(null);
  const src = String(setting.baseColorTexture || "").trim();
  if (!src || isClearedMaterialTexture(src)) return null;

  const scaleU = n(setting.baseColorTexScaleU, 1);
  const scaleV = n(setting.baseColorTexScaleV, 1);
  const offU = n(setting.baseColorTexOffsetU, 0);
  const offV = n(setting.baseColorTexOffsetV, 0);
  const rot = n(setting.baseColorTexRotation, 0);

  function bumpSize(factor: number) {
    onChange({
      baseColorTexScaleU: Math.max(0.05, Math.min(4, scaleU * factor)),
      baseColorTexScaleV: Math.max(0.05, Math.min(4, scaleV * factor)),
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] font-semibold text-[#525252]">Logo placement</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-bold text-[#111]"
          onClick={() => {
            void logoContentUv(src).then((uv) => {
              if (uv) onChange(uv);
              else bumpSize(0.55);
            });
          }}
        >
          Fill logo
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-bold text-[#111]"
          onClick={() => bumpSize(0.82)}
        >
          Bigger
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-bold text-[#111]"
          onClick={() => bumpSize(1.22)}
        >
          Smaller
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-bold text-[#111]"
          onClick={() => onChange({ baseColorTexRotation: ((rot + 90 + 540) % 360) - 180 })}
        >
          90°
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-bold text-[#111]"
          onClick={() => onChange({ baseColorTexFlipU: !setting.baseColorTexFlipU })}
        >
          Flip H
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-bold text-[#111]"
          onClick={() => onChange({ baseColorTexFlipV: !setting.baseColorTexFlipV })}
        >
          Flip V
        </button>
      </div>
      <TextureContextTarget
        className="relative h-40 w-full cursor-grab overflow-hidden rounded-lg border border-[#E5E7EB] bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] active:cursor-grabbing"
        getCopy={() => ({
          value: src,
          extras: {
            baseColor: "#ffffff",
            baseColorTexCoord: setting.baseColorTexCoord,
            baseColorTexOffsetU: setting.baseColorTexOffsetU,
            baseColorTexOffsetV: setting.baseColorTexOffsetV,
            baseColorTexScaleU: setting.baseColorTexScaleU,
            baseColorTexScaleV: setting.baseColorTexScaleV,
            baseColorTexRotation: setting.baseColorTexRotation,
            baseColorTexFlipU: setting.baseColorTexFlipU,
            baseColorTexFlipV: setting.baseColorTexFlipV,
          },
        })}
        onPaste={(payload) => {
          onChange({
            baseColorTexture: payload.value,
            ...(payload.extras || {}),
          } as Partial<MaterialSetting>);
        }}
      >
      <div
        className="h-full w-full"
        title="Drag to move · scroll to scale · right-click copy / paste"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ou: offU, ov: offV };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const du = (e.clientX - drag.current.x) / Math.max(1, box.width);
          const dv = (e.clientY - drag.current.y) / Math.max(1, box.height);
          onChange({
            baseColorTexOffsetU: Math.max(-2, Math.min(2, drag.current.ou - du * scaleU)),
            baseColorTexOffsetV: Math.max(-2, Math.min(2, drag.current.ov + dv * scaleV)),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onWheel={(e) => {
          e.preventDefault();
          bumpSize(e.deltaY < 0 ? 0.9 : 1.1);
        }}
      >
        <div
          className="pointer-events-none absolute inset-3"
          style={{
            transform: `translate(${-offU * 100}%, ${offV * 100}%) rotate(${rot}deg) scale(${1 / Math.max(0.05, scaleU)}, ${1 / Math.max(0.05, scaleV)})`,
            transformOrigin: "center center",
          }}
        >
          <AppImage src={src} alt="map" className="h-full w-full object-contain" />
        </div>
      </div>
      </TextureContextTarget>
      <p className="text-[11px] text-slate-500">
        Fill logo = white padding hata ke bada. Bigger / scroll up = size badhao. Texture pe right-click = Copy / Paste.
      </p>
    </div>
  );
}
