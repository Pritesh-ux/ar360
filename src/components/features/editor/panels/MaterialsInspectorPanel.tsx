"use client";

import { useState } from "react";
import {
  MaterialColorRow,
  MaterialSection,
  MaterialSliderRow,
  MaterialTextureRow,
  ToggleRow,
} from "@/components/features/editor/EditorUi";
import { isClearedMaterialTexture } from "@/lib/materials/diamond-look";
import {
  DISPERSION_MAX,
  GEMSTONE_TYPES,
  applyGemstonePreset,
  applyStandardMaterialCategory,
  clampDispersion,
  isGemstoneType,
  resolveMaterialCategory,
} from "@/lib/materials/gemstone-presets";
import BaseColorMapPlacement from "@/components/features/editor/panels/BaseColorMapPlacement";
import TextureTransformControls from "@/components/features/editor/panels/TextureTransformControls";
import type { TextureTransform } from "@/lib/materials/texture-transform";
import type { GemstoneType, MaterialSetting } from "@/components/features/editor/types";
import type { ViewerMaterial } from "@/components/shared/ModelViewer";

export type MaterialInspectorSection =
  | "surface"
  | "reflection"
  | "clearcoat"
  | "refraction"
  | "detail"
  | "advanced"
  | "gemstone";

type Props = {
  materials: ViewerMaterial[];
  selectedMaterialIndex: number;
  onSelectMaterial: (index: number) => void;
  setting: MaterialSetting;
  nativeSetting?: MaterialSetting;
  onChange: (partial: Partial<MaterialSetting>) => void;
};

function num(value: number | undefined, fallback: number) {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function hasMap(value?: string) {
  const raw = String(value || "").trim();
  return Boolean(raw) && !isClearedMaterialTexture(raw);
}

function gemstoneLabel(type: GemstoneType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function setTransform(
  onChange: (partial: Partial<MaterialSetting>) => void,
  key:
    | "baseColorMapTransform"
    | "metallicRoughnessMapTransform"
    | "normalMapTransform"
    | "emissiveMapTransform"
    | "occlusionMapTransform"
    | "bumpMapTransform",
  next: TextureTransform,
) {
  onChange({ [key]: next } as Partial<MaterialSetting>);
}

export default function MaterialsInspectorPanel({
  materials,
  selectedMaterialIndex,
  onSelectMaterial,
  setting,
  nativeSetting,
  onChange,
}: Props) {
  const [openSection, setOpenSection] = useState<MaterialInspectorSection | null>("surface");
  const category = resolveMaterialCategory(setting);
  const isGemstone = category === "gemstone";
  const activeGemstone: GemstoneType = isGemstoneType(setting.gemstoneType)
    ? setting.gemstoneType
    : "diamond";

  function toggleSection(section: MaterialInspectorSection, nextOpen?: boolean) {
    setOpenSection((prev) => {
      if (typeof nextOpen === "boolean") {
        return nextOpen ? section : prev === section ? null : prev;
      }
      return prev === section ? null : section;
    });
  }

  function resetField<K extends keyof MaterialSetting>(key: K, fallback: MaterialSetting[K]) {
    const next = nativeSetting?.[key];
    onChange({ [key]: next !== undefined ? next : fallback } as Partial<MaterialSetting>);
  }

  function handleCategoryChange(next: "standard" | "gemstone") {
    if (next === "gemstone") {
      onChange(applyGemstonePreset(setting, activeGemstone));
      setOpenSection("gemstone");
      return;
    }
    onChange(applyStandardMaterialCategory(setting));
    setOpenSection("surface");
  }

  function handleGemstoneTypeChange(next: GemstoneType) {
    onChange(applyGemstonePreset(setting, next));
    setOpenSection("gemstone");
  }

  return (
    <div className="editor-materials-inspector">
      <label className="block text-xs font-bold text-slate-400">Selected material</label>
      <select
        className="h-11 w-full rounded-lg border border-[#ECECEC] bg-white px-4 text-sm font-bold text-[#111111] outline-none"
        value={selectedMaterialIndex}
        onChange={(e) => onSelectMaterial(Number(e.target.value))}
      >
        {materials.map((mat) => (
          <option key={mat.index} value={mat.index}>
            ID-{mat.index} — {mat.name || "Material"}
          </option>
        ))}
      </select>

      {isGemstone &&
      /fallback/i.test(
        String(
          materials.find((mat) => mat.index === selectedMaterialIndex)?.name || "",
        ),
      ) ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium leading-snug text-amber-900">
          This GLB slot is named fallback — metal and the center stone often share it.
          Diamond will apply to the whole ring. For CAD-like sparkle, pick a stone-only
          material if the dropdown has one (Diamond / Gem / Stone).
        </p>
      ) : null}

      <label className="mt-3 block text-xs font-bold text-slate-400">Material Type</label>
      <select
        className="h-11 w-full rounded-lg border border-[#ECECEC] bg-white px-4 text-sm font-bold text-[#111111] outline-none"
        value={category}
        onChange={(e) =>
          handleCategoryChange(e.target.value === "gemstone" ? "gemstone" : "standard")
        }
      >
        <option value="standard">Standard</option>
        <option value="gemstone">Gemstone</option>
      </select>

      {isGemstone ? (
        <MaterialSection
          title="Gemstone"
          open={openSection === "gemstone"}
          onOpenChange={(next) => toggleSection("gemstone", next)}
        >
          <label className="block text-xs font-bold text-slate-400">Gemstone</label>
          <select
            className="h-11 w-full rounded-lg border border-[#ECECEC] bg-white px-4 text-sm font-bold text-[#111111] outline-none"
            value={activeGemstone}
            onChange={(e) => handleGemstoneTypeChange(e.target.value as GemstoneType)}
          >
            {GEMSTONE_TYPES.map((gem) => (
              <option key={gem} value={gem}>
                {gemstoneLabel(gem)}
              </option>
            ))}
          </select>
          <MaterialColorRow
            label="Base Color"
            tooltip="Gem body / facet tint"
            value={setting.baseColor || "#ffffff"}
            onChange={(v) => onChange({ baseColor: v })}
            onReset={() => resetField("baseColor", "#ffffff")}
          />
          <MaterialSliderRow
            label="Roughness"
            tooltip="Keep near 0 for polished facets"
            value={num(setting.roughness, 0.01)}
            onChange={(v) => onChange({ roughness: v })}
            onReset={() => resetField("roughness", 0.01)}
            min={0}
            max={0.5}
            step={0.01}
          />
          <MaterialSliderRow
            label="Transmission"
            tooltip="Dielectric transmission (jewelry soft-capped on thin shells)"
            value={num(setting.transmission, 1)}
            onChange={(v) => onChange({ transmission: v, opacity: 1, alphaMode: "OPAQUE" })}
            onReset={() => resetField("transmission", 1)}
            min={0}
            max={1}
            step={0.01}
          />
          <MaterialSliderRow
            label="IOR"
            tooltip="Index of refraction (diamond ≈ 2.42)"
            value={num(setting.ior, 2.417)}
            onChange={(v) => onChange({ ior: v })}
            onReset={() => resetField("ior", 2.417)}
            min={1}
            max={3.5}
            step={0.001}
          />
          <MaterialSliderRow
            label="Thickness"
            tooltip="Optical path for refraction / absorption"
            value={num(setting.thickness, 0.3)}
            onChange={(v) => onChange({ thickness: v })}
            onReset={() => resetField("thickness", 0.3)}
            min={0}
            max={2}
            step={0.01}
          />
          <MaterialColorRow
            label="Attenuation Color"
            tooltip="Volume absorption tint"
            value={setting.attenuationColor || "#ffffff"}
            onChange={(v) => onChange({ attenuationColor: v })}
            onReset={() => resetField("attenuationColor", "#ffffff")}
          />
          <MaterialSliderRow
            label="Attenuation Distance"
            tooltip="0 = off (Infinity). Colored gems use low values."
            value={num(setting.attenuationDistance, 0)}
            onChange={(v) => onChange({ attenuationDistance: v })}
            onReset={() => resetField("attenuationDistance", 0)}
            min={0}
            max={100}
            step={0.01}
          />
          <MaterialSliderRow
            label="Dispersion"
            tooltip="Subtle spectral fire (MeshPhysicalMaterial.dispersion)"
            value={clampDispersion(setting.dispersion)}
            onChange={(v) => onChange({ dispersion: clampDispersion(v) })}
            onReset={() =>
              onChange({
                dispersion: clampDispersion(
                  applyGemstonePreset(setting, activeGemstone).dispersion,
                ),
              })
            }
            min={0}
            max={DISPERSION_MAX}
            step={0.001}
          />
        </MaterialSection>
      ) : null}

      <MaterialSection
        title="Surface"
        open={openSection === "surface"}
        onOpenChange={(next) => toggleSection("surface", next)}
      >
        {!isGemstone ? (
          <>
            <MaterialColorRow
              label="Base Color"
              tooltip="Albedo / base color of the material"
              value={setting.baseColor || "#ffffff"}
              onChange={(v) => onChange({ baseColor: v })}
              onReset={() => resetField("baseColor", "#ffffff")}
            />
            <MaterialSliderRow
              label="Opacity"
              tooltip="0 = invisible, 1 = fully opaque (baseColor alpha)"
              value={num(setting.opacity, 1)}
              onChange={(v) =>
                onChange({
                  opacity: v,
                  alphaMode:
                    num(setting.transmission, 0) > 0.02
                      ? "OPAQUE"
                      : v < 0.999
                        ? "BLEND"
                        : setting.alphaMode || "OPAQUE",
                })
              }
              onReset={() =>
                onChange({
                  opacity: nativeSetting?.opacity ?? 1,
                  alphaMode: nativeSetting?.alphaMode || "OPAQUE",
                })
              }
              min={0}
              max={1}
              step={0.01}
            />
            <MaterialSliderRow
              label="Metalness"
              tooltip="0 = non-metal, 1 = pure metal"
              value={num(setting.metalness, 0)}
              onChange={(v) => onChange({ metalness: v })}
              onReset={() => resetField("metalness", 0)}
              min={0}
              max={1}
              step={0.01}
            />
            <MaterialSliderRow
              label="Roughness"
              tooltip="0 = mirror finish, 1 = matte"
              value={num(setting.roughness, 0.5)}
              onChange={(v) => onChange({ roughness: v })}
              onReset={() => resetField("roughness", 0.5)}
              min={0}
              max={1}
              step={0.01}
            />
          </>
        ) : (
          <p className="text-xs text-slate-500">
            Gemstone surface controls are in the Gemstone section. Metalness stays at 0 for
            dielectric refraction.
          </p>
        )}
        <MaterialSliderRow
          label="Specular Intensity"
          tooltip="Highlight brightness (KHR specular)"
          value={num(setting.specularIntensity, 1)}
          onChange={(v) => onChange({ specularIntensity: v })}
          onReset={() => resetField("specularIntensity", 1)}
          min={0}
          max={1}
          step={0.01}
        />
        <MaterialColorRow
          label="Specular Color"
          tooltip="Tint of specular highlights"
          value={setting.specularColor || "#ffffff"}
          onChange={(v) => onChange({ specularColor: v })}
          onReset={() => resetField("specularColor", "#ffffff")}
        />
        {!isGemstone ? (
          <>
            <MaterialTextureRow
              label="Base Color Map"
              tooltip="Right-click texture to copy / paste onto another variant"
              value={setting.baseColorTexture}
              copyExtras={{
                baseColor: "#ffffff",
                baseColorTexCoord: setting.baseColorTexCoord,
                baseColorTexOffsetU: setting.baseColorTexOffsetU,
                baseColorTexOffsetV: setting.baseColorTexOffsetV,
                baseColorTexScaleU: setting.baseColorTexScaleU,
                baseColorTexScaleV: setting.baseColorTexScaleV,
                baseColorTexRotation: setting.baseColorTexRotation,
                baseColorTexFlipU: setting.baseColorTexFlipU,
                baseColorTexFlipV: setting.baseColorTexFlipV,
              }}
              onPasteExtras={(extras) => onChange(extras as Partial<MaterialSetting>)}
              onChange={(v) =>
                onChange(
                  v
                    ? {
                        baseColorTexture: v,
                        baseColor: "#ffffff",
                        ...(Number(setting.metalness ?? 0) >= 0.9 ? { metalness: 0 } : {}),
                      }
                    : { baseColorTexture: v },
                )
              }
            />
            {hasMap(setting.baseColorTexture) ? (
              <>
                <TextureTransformControls
                  value={setting.baseColorMapTransform}
                  onChange={(next) => setTransform(onChange, "baseColorMapTransform", next)}
                />
                <BaseColorMapPlacement setting={setting} onChange={onChange} />
              </>
            ) : null}
            <MaterialTextureRow
              label="Metallic Roughness Map"
              tooltip="Optional metallic-roughness texture"
              value={setting.metallicRoughnessTexture}
              onChange={(v) => onChange({ metallicRoughnessTexture: v })}
            />
            {hasMap(setting.metallicRoughnessTexture) ? (
              <TextureTransformControls
                value={setting.metallicRoughnessMapTransform}
                onChange={(next) =>
                  setTransform(onChange, "metallicRoughnessMapTransform", next)
                }
              />
            ) : null}
          </>
        ) : null}
      </MaterialSection>

      <MaterialSection
        title="Reflection"
        open={openSection === "reflection"}
        onOpenChange={(next) => toggleSection("reflection", next)}
      >
        <MaterialSliderRow
          label="Reflection Intensity"
          tooltip="Multiplies environment reflection strength"
          value={num(setting.reflectionIntensity, 1)}
          onChange={(v) => onChange({ reflectionIntensity: v })}
          onReset={() => resetField("reflectionIntensity", 1)}
          min={0}
          max={2}
          step={0.01}
        />
        <MaterialSliderRow
          label="Environment Reflection"
          tooltip="Maps to envMapIntensity"
          value={num(setting.envMapIntensity, 1)}
          onChange={(v) => onChange({ envMapIntensity: v })}
          onReset={() => resetField("envMapIntensity", 1)}
          min={0}
          max={2}
          step={0.01}
        />
        <MaterialSliderRow
          label="Reflection Blur"
          tooltip="Approximates softer env reflections via roughness floor"
          value={num(setting.reflectionBlur, 0)}
          onChange={(v) => onChange({ reflectionBlur: v })}
          onReset={() => resetField("reflectionBlur", 0)}
          min={0}
          max={1}
          step={0.01}
        />
        <MaterialColorRow
          label="Reflection Color"
          tooltip="Tints reflected light and glossy highlights"
          value={setting.reflectionTint || "#ffffff"}
          onChange={(v) => onChange({ reflectionTint: v })}
          onReset={() => resetField("reflectionTint", "#ffffff")}
        />
        <MaterialSliderRow
          label="Fresnel Strength"
          tooltip="Scales specularIntensity for edge highlights (approx)"
          value={num(setting.fresnelStrength, 1)}
          onChange={(v) => onChange({ fresnelStrength: v })}
          onReset={() => resetField("fresnelStrength", 1)}
          min={0}
          max={2}
          step={0.01}
        />
        <MaterialSliderRow
          label="Fresnel IOR"
          tooltip="Same IOR as Refraction — controls Fresnel / dielectric F0"
          value={num(setting.ior, 1.5)}
          onChange={(v) => onChange({ ior: v })}
          onReset={() => resetField("ior", 1.5)}
          min={1}
          max={3.5}
          step={0.01}
        />
      </MaterialSection>

      <MaterialSection
        title="Clear Coat"
        open={openSection === "clearcoat"}
        onOpenChange={(next) => toggleSection("clearcoat", next)}
      >
        <MaterialSliderRow
          label="Clear Coat"
          tooltip="Second polished reflective layer (jewelry, paint, plastic)"
          value={num(setting.clearcoat, 0)}
          onChange={(v) => onChange({ clearcoat: v })}
          onReset={() => resetField("clearcoat", 0)}
          min={0}
          max={1}
          step={0.01}
        />
        <MaterialSliderRow
          label="Clear Coat Roughness"
          tooltip="Roughness of the clear coat layer"
          value={num(setting.clearcoatRoughness, 0)}
          onChange={(v) => onChange({ clearcoatRoughness: v })}
          onReset={() => resetField("clearcoatRoughness", 0)}
          min={0}
          max={1}
          step={0.01}
        />
      </MaterialSection>

      {!isGemstone ? (
        <MaterialSection
          title="Refraction"
          open={openSection === "refraction"}
          onOpenChange={(next) => toggleSection("refraction", next)}
        >
          <MaterialSliderRow
            label="Transmission"
            tooltip="0 = opaque, 1 = fully transmitting (glass / gem)"
            value={num(setting.transmission, 0)}
            onChange={(v) => onChange({ transmission: v })}
            onReset={() => resetField("transmission", 0)}
            min={0}
            max={1}
            step={0.01}
          />
          <MaterialSliderRow
            label="IOR"
            tooltip="Index of refraction (glass ~1.5, diamond ~2.42)"
            value={num(setting.ior, 1.5)}
            onChange={(v) => onChange({ ior: v })}
            onReset={() => resetField("ior", 1.5)}
            min={1}
            max={3.5}
            step={0.01}
          />
          <MaterialSliderRow
            label="Thickness"
            tooltip="Volume thickness for internal light travel"
            value={num(setting.thickness, 0)}
            onChange={(v) => onChange({ thickness: v })}
            onReset={() => resetField("thickness", 0)}
            min={0}
            max={2}
            step={0.01}
          />
          <MaterialColorRow
            label="Attenuation Color"
            tooltip="Absorption tint through the volume"
            value={setting.attenuationColor || "#ffffff"}
            onChange={(v) => onChange({ attenuationColor: v })}
            onReset={() => resetField("attenuationColor", "#ffffff")}
          />
          <MaterialSliderRow
            label="Attenuation Distance"
            tooltip="Distance over which attenuation color is applied (0 = off)"
            value={num(setting.attenuationDistance, 0)}
            onChange={(v) => onChange({ attenuationDistance: v })}
            onReset={() => resetField("attenuationDistance", 0)}
            min={0}
            max={5}
            step={0.01}
          />
        </MaterialSection>
      ) : null}

      <MaterialSection
        title="Surface Detail"
        open={openSection === "detail"}
        onOpenChange={(next) => toggleSection("detail", next)}
      >
        <MaterialTextureRow
          label="Normal Map"
          tooltip="Micro-surface normals"
          value={setting.normalTexture}
          onChange={(v) => onChange({ normalTexture: v })}
        />
        {hasMap(setting.normalTexture) ? (
          <TextureTransformControls
            value={setting.normalMapTransform}
            onChange={(next) => setTransform(onChange, "normalMapTransform", next)}
          />
        ) : null}
        <MaterialSliderRow
          label="Normal Strength"
          tooltip="normalScale on MeshPhysicalMaterial"
          value={num(setting.normalScale, 1)}
          onChange={(v) => onChange({ normalScale: v })}
          onReset={() => resetField("normalScale", 1)}
          min={0}
          max={2}
          step={0.01}
        />
        <MaterialTextureRow
          label="AO Map"
          tooltip="Ambient occlusion map"
          value={setting.occlusionTexture}
          onChange={(v) => onChange({ occlusionTexture: v })}
        />
        {hasMap(setting.occlusionTexture) ? (
          <TextureTransformControls
            value={setting.occlusionMapTransform}
            onChange={(next) => setTransform(onChange, "occlusionMapTransform", next)}
          />
        ) : null}
        <MaterialSliderRow
          label="AO Strength"
          tooltip="aoMapIntensity"
          value={num(setting.occlusionStrength, 1)}
          onChange={(v) => onChange({ occlusionStrength: v })}
          onReset={() => resetField("occlusionStrength", 1)}
          min={0}
          max={1}
          step={0.01}
        />
        <MaterialTextureRow
          label="Bump Map"
          tooltip="Height bump map (Three.js bumpMap)"
          value={setting.bumpTexture}
          onChange={(v) => onChange({ bumpTexture: v })}
        />
        {hasMap(setting.bumpTexture) ? (
          <TextureTransformControls
            value={setting.bumpMapTransform}
            onChange={(next) => setTransform(onChange, "bumpMapTransform", next)}
          />
        ) : null}
        <MaterialSliderRow
          label="Bump Strength"
          tooltip="bumpScale"
          value={num(setting.bumpScale, 1)}
          onChange={(v) => onChange({ bumpScale: v })}
          onReset={() => resetField("bumpScale", 1)}
          min={0}
          max={2}
          step={0.01}
        />
        <MaterialSliderRow
          label="Soft Texture"
          tooltip="Blur the bump map so surface detail looks softer (0–100%)"
          value={Math.round(num(setting.bumpSoftness, 0) * 100)}
          onChange={(v) => onChange({ bumpSoftness: Math.max(0, Math.min(1, v / 100)) })}
          onReset={() => resetField("bumpSoftness", 0)}
          min={0}
          max={100}
          step={1}
        />
      </MaterialSection>

      <MaterialSection
        title="Advanced"
        open={openSection === "advanced"}
        onOpenChange={(next) => toggleSection("advanced", next)}
      >
        <ToggleRow
          label="Double Sided"
          checked={Boolean(setting.doubleSided)}
          onChange={(v) => onChange({ doubleSided: v })}
        />
        <ToggleRow
          label="Depth Write"
          checked={setting.depthWrite !== false}
          onChange={(v) => onChange({ depthWrite: v })}
        />
        <ToggleRow
          label="Depth Test"
          checked={setting.depthTest !== false}
          onChange={(v) => onChange({ depthTest: v })}
        />
        <ToggleRow
          label="Cast Shadow"
          checked={setting.castShadow !== false}
          onChange={(v) => onChange({ castShadow: v })}
        />
        <ToggleRow
          label="Receive Shadow"
          checked={setting.receiveShadow !== false}
          onChange={(v) => onChange({ receiveShadow: v })}
        />
        <MaterialSliderRow
          label="Render Order"
          tooltip="Higher draws later"
          value={num(setting.renderOrder, 0)}
          onChange={(v) => onChange({ renderOrder: Math.round(v) })}
          onReset={() => resetField("renderOrder", 0)}
          min={-10}
          max={10}
          step={1}
        />
        <MaterialTextureRow
          label="Emissive Map"
          tooltip="Optional emissive texture"
          value={setting.emissiveTexture}
          onChange={(v) => onChange({ emissiveTexture: v })}
        />
        {hasMap(setting.emissiveTexture) ? (
          <TextureTransformControls
            value={setting.emissiveMapTransform}
            onChange={(next) => setTransform(onChange, "emissiveMapTransform", next)}
          />
        ) : null}
        <MaterialColorRow
          label="Emissive Color"
          tooltip="Self-illumination color"
          value={setting.emissiveColor || "#000000"}
          onChange={(v) => onChange({ emissiveColor: v })}
          onReset={() => resetField("emissiveColor", "#000000")}
        />
      </MaterialSection>
    </div>
  );
}
