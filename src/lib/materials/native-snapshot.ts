import type { MaterialSetting } from "@/components/features/editor/types";

function channelToHex(value: number) {
  const clamped = Math.max(0, Math.min(255, Math.round(value * 255)));
  return clamped.toString(16).padStart(2, "0");
}

export function rgb01ToHex(r: number, g: number, b: number) {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

export function snapshotNativeMaterialsFromViewer(viewer: {
  model?: { materials?: Array<{ pbrMetallicRoughness?: unknown; emissiveFactor?: number[] }> };
}): Record<number, MaterialSetting> {
  const materials = viewer.model?.materials || [];
  const settings: Record<number, MaterialSetting> = {};

  materials.forEach((material, index) => {
    const pbr = material.pbrMetallicRoughness as
      | {
          baseColorFactor?: number[];
          metallicFactor?: number;
          roughnessFactor?: number;
        }
      | undefined;

    if (!pbr) return;

    const base = pbr.baseColorFactor || [1, 1, 1, 1];
    const emissive = material.emissiveFactor || [0, 0, 0];

    settings[index] = {
      baseColor: rgb01ToHex(base[0] ?? 1, base[1] ?? 1, base[2] ?? 1),
      metalness: Number(pbr.metallicFactor ?? 0),
      roughness: Number(pbr.roughnessFactor ?? 0.5),
      emissiveColor: rgb01ToHex(emissive[0] ?? 0, emissive[1] ?? 0, emissive[2] ?? 0),
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
