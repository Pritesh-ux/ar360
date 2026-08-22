"use client";

import { MaterialSliderRow } from "@/components/features/editor/EditorUi";
import type { TextureFitMode, TextureTransform } from "@/lib/materials/texture-transform";
import { normalizeTextureTransform } from "@/lib/materials/texture-transform";

type Props = {
  value?: TextureTransform | null;
  onChange: (next: TextureTransform) => void;
};

const FITS: { id: TextureFitMode; label: string; title: string }[] = [
  { id: "original", label: "Original", title: "Keep image aspect, tile" },
  { id: "square", label: "Square", title: "Stretch to UV square" },
  { id: "fit", label: "Fit", title: "Contain whole image in UV" },
];

export default function TextureTransformControls({ value, onChange }: Props) {
  const t = normalizeTextureTransform(value);

  function patch(partial: Partial<TextureTransform>) {
    onChange({ ...t, ...partial });
  }

  return (
    <div className="mb-3 mt-1 space-y-2 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2.5">
      <div>
        <p className="text-[12px] font-semibold text-[#525252]">Fit</p>
        <div className="mt-1.5 flex gap-1">
          {FITS.map((fit) => {
            const active = t.fit === fit.id;
            return (
              <button
                key={fit.id}
                type="button"
                title={fit.title}
                onClick={() => patch({ fit: fit.id })}
                className={active ? "editor-fit-chip is-active" : "editor-fit-chip"}
                aria-pressed={active}
              >
                {fit.label}
              </button>
            );
          })}
        </div>
      </div>
      <MaterialSliderRow
        label="Scale"
        tooltip="How large the texture tiles on the surface"
        value={t.scale}
        onChange={(v) => patch({ scale: v })}
        onReset={() => patch({ scale: 1 })}
        min={0.1}
        max={8}
        step={0.01}
      />
      <MaterialSliderRow
        label="Rotation"
        tooltip="Rotate this map in degrees"
        value={t.rotation}
        onChange={(v) => patch({ rotation: v })}
        onReset={() => patch({ rotation: 0 })}
        min={-180}
        max={180}
        step={1}
      />
    </div>
  );
}
