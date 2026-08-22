import type { MaterialSetting } from "@/components/features/editor/types";

function channelToHex(value: number) {
  const clamped = Math.max(0, Math.min(255, Math.round(value * 255)));
  return clamped.toString(16).padStart(2, "0");
}

export function rgb01ToHex(r: number, g: number, b: number) {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function texturePreviewUri(textureInfo: any): string | undefined {
  if (!textureInfo) return undefined;
  try {
    const tex = textureInfo.texture ?? textureInfo.getTexture?.();
    if (!tex) return undefined;
    const source = tex.source;
    const uri =
      (typeof source?.uri === "string" && source.uri) ||
      (typeof source?.getURI === "function" && source.getURI()) ||
      (typeof tex.name === "string" && tex.name) ||
      "";
    if (typeof uri === "string" && uri.trim() && uri !== "undefined") {
      return uri.trim();
    }
    if (source && typeof source === "object") {
      for (const key of Object.getOwnPropertySymbols(source)) {
        const value = source[key];
        if (value && typeof value === "object") {
          if (typeof value.src === "string" && value.src) return value.src;
          if (value.image && typeof value.image.src === "string" && value.image.src) {
            return value.image.src;
          }
        }
      }
    }
  } catch {
    // Optional
  }
  return undefined;
}

export function snapshotNativeMaterialsFromViewer(viewer: any): Record<number, MaterialSetting> {
  const materials = viewer.model?.materials || [];
  const settings: Record<number, MaterialSetting> = {};

  materials.forEach((material: any, index: number) => {
    const pbr = material.pbrMetallicRoughness;

    if (!pbr) return;

    const base = pbr.baseColorFactor || [1, 1, 1, 1];
    const emissive = material.emissiveFactor || [0, 0, 0];

    let alphaMode: MaterialSetting["alphaMode"] = "OPAQUE";
    try {
      const raw =
        typeof material.getAlphaMode === "function"
          ? material.getAlphaMode()
          : material.alphaMode;
      const normalized = String(raw || "OPAQUE").toUpperCase();
      if (normalized === "BLEND" || normalized === "MASK" || normalized === "OPAQUE") {
        alphaMode = normalized;
      }
    } catch {
      // Optional
    }

    let transmission = 0;
    try {
      if (typeof material.transmissionFactor === "number") {
        transmission = clamp01(Number(material.transmissionFactor));
      } else {
        const factor =
          typeof material.transmission?.getTransmissionFactor === "function"
            ? material.transmission.getTransmissionFactor()
            : material.transmission?.transmissionFactor;
        if (factor != null && Number.isFinite(Number(factor))) {
          transmission = clamp01(Number(factor));
        }
      }
    } catch {
      // Optional KHR_materials_transmission
    }

    let ior = 1.5;
    try {
      if (typeof material.ior === "number") ior = safeNumber(material.ior, 1.5);
      else if (typeof material.getIor === "function") ior = safeNumber(material.getIor(), 1.5);
    } catch {
      // Optional
    }

    let thickness = 0;
    try {
      if (typeof material.thicknessFactor === "number") {
        thickness = Math.max(0, safeNumber(material.thicknessFactor, 0));
      } else if (typeof material.getThicknessFactor === "function") {
        thickness = Math.max(0, safeNumber(material.getThicknessFactor(), 0));
      }
    } catch {
      // Optional
    }

    let attenuationDistance = 0;
    let attenuationColor = "#ffffff";
    try {
      if (typeof material.attenuationDistance === "number") {
        attenuationDistance = Math.max(0, safeNumber(material.attenuationDistance, 0));
      } else if (typeof material.getAttenuationDistance === "function") {
        attenuationDistance = Math.max(0, safeNumber(material.getAttenuationDistance(), 0));
      }
      const ac =
        typeof material.getAttenuationColor === "function"
          ? material.getAttenuationColor()
          : material.attenuationColor;
      if (Array.isArray(ac) && ac.length >= 3) {
        attenuationColor = rgb01ToHex(ac[0], ac[1], ac[2]);
      }
    } catch {
      // Optional
    }

    let specularIntensity = 1;
    let specularColor = "#ffffff";
    try {
      if (typeof material.specularFactor === "number") {
        specularIntensity = clamp01(safeNumber(material.specularFactor, 1));
      } else if (typeof material.getSpecularFactor === "function") {
        specularIntensity = clamp01(safeNumber(material.getSpecularFactor(), 1));
      }
      const sc =
        typeof material.getSpecularColorFactor === "function"
          ? material.getSpecularColorFactor()
          : material.specularColorFactor;
      if (Array.isArray(sc) && sc.length >= 3) {
        specularColor = rgb01ToHex(sc[0], sc[1], sc[2]);
      }
    } catch {
      // Optional
    }

    let clearcoat = 0;
    let clearcoatRoughness = 0;
    try {
      if (typeof material.clearcoatFactor === "number") {
        clearcoat = clamp01(safeNumber(material.clearcoatFactor, 0));
      } else if (typeof material.getClearcoatFactor === "function") {
        clearcoat = clamp01(safeNumber(material.getClearcoatFactor(), 0));
      }
      if (typeof material.clearcoatRoughnessFactor === "number") {
        clearcoatRoughness = clamp01(safeNumber(material.clearcoatRoughnessFactor, 0));
      } else if (typeof material.getClearcoatRoughnessFactor === "function") {
        clearcoatRoughness = clamp01(safeNumber(material.getClearcoatRoughnessFactor(), 0));
      }
    } catch {
      // Optional
    }

    let doubleSided = false;
    try {
      if (typeof material.getDoubleSided === "function") {
        doubleSided = Boolean(material.getDoubleSided());
      } else if (typeof material.doubleSided === "boolean") {
        doubleSided = material.doubleSided;
      }
    } catch {
      // Optional
    }

    const opacity =
      base[3] != null && Number.isFinite(Number(base[3]))
        ? clamp01(Number(base[3]))
        : 1;

    settings[index] = {
      baseColor: rgb01ToHex(base[0] ?? 1, base[1] ?? 1, base[2] ?? 1),
      metalness: safeNumber(pbr.metallicFactor, 0),
      roughness: safeNumber(pbr.roughnessFactor, 0.5),
      emissiveColor: rgb01ToHex(emissive[0] ?? 0, emissive[1] ?? 0, emissive[2] ?? 0),
      baseColorTexture: texturePreviewUri(pbr.baseColorTexture),
      metallicRoughnessTexture: texturePreviewUri(pbr.metallicRoughnessTexture),
      normalTexture: texturePreviewUri(material.normalTexture),
      emissiveTexture: texturePreviewUri(material.emissiveTexture),
      occlusionTexture: texturePreviewUri(material.occlusionTexture),
      occlusionStrength: 1,
      opacity,
      alphaMode,
      transmission,
      ior,
      thickness,
      attenuationDistance,
      attenuationColor,
      specularIntensity,
      specularColor,
      envMapIntensity: 1,
      reflectionIntensity: 1,
      reflectionBlur: 0,
      reflectionTint: "#ffffff",
      fresnelStrength: 1,
      clearcoat,
      clearcoatRoughness,
      normalScale: 1,
      bumpScale: 1,
      bumpSoftness: 0,
      doubleSided,
      depthWrite: alphaMode !== "BLEND",
      depthTest: true,
      castShadow: true,
      receiveShadow: true,
      renderOrder: 0,
    };
  });

  return settings;
}

export function normalizeMaterialSettingsKeys(
  settings?: Record<number | string, MaterialSetting> | null,
): Record<number, MaterialSetting> {
  if (!settings) return {};

  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [Number(key), value]),
  ) as Record<number, MaterialSetting>;
}

const TEXTURE_KEYS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "emissiveTexture",
  "occlusionTexture",
  "bumpTexture",
] as const;

/** Blob/data URIs from GLTFLoader are session-only — do not persist them. */
export function stripEphemeralTextureUris(
  settings: Record<number, MaterialSetting>,
): Record<number, MaterialSetting> {
  const next: Record<number, MaterialSetting> = {};
  for (const [key, setting] of Object.entries(settings)) {
    const copy = { ...setting };
    for (const field of TEXTURE_KEYS) {
      const uri = String(copy[field] || "");
      if (uri.startsWith("blob:") || uri.startsWith("data:")) {
        delete copy[field];
      }
    }
    next[Number(key)] = copy;
  }
  return next;
}
