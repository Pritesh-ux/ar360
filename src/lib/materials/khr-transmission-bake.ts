/**
 * Bake editor materialSettings into glTF KHR optical extensions so native
 * viewers (Scene Viewer / Quick Look via converted USDZ) and model-viewer
 * load MeshPhysicalMaterial with real transmission — not only runtime overrides.
 *
 * Writes:
 * - KHR_materials_transmission
 * - KHR_materials_ior (when ior is set)
 * - KHR_materials_volume (when thickness / attenuation is set)
 */

import { hexToRgb01 } from "@/lib/materials/inspector-apply";

export type KhrTransmissionBakeSetting = {
  transmission?: number | null;
  ior?: number | null;
  thickness?: number | null;
  attenuationDistance?: number | null;
  attenuationColor?: string | null;
  /** When true (gemstone), force dielectric metalness 0 so transmission can show. */
  type?: string | null;
  metalness?: number | null;
  alphaMode?: string | null;
  opacity?: number | null;
};

export type KhrTransmissionBakeResult = {
  buffer: Uint8Array;
  changed: boolean;
  materialsTouched: number;
  extensionsUsed: string[];
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function finiteOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True when any slot needs (or clears) transmission baking. */
export function materialSettingsNeedKhrTransmissionBake(
  settings: Record<string | number, KhrTransmissionBakeSetting | null | undefined> | null | undefined,
): boolean {
  if (!settings || typeof settings !== "object") return false;
  for (const setting of Object.values(settings)) {
    if (!setting || typeof setting !== "object") continue;
    const tx = finiteOrNull(setting.transmission);
    if (tx != null) return true;
    if (finiteOrNull(setting.ior) != null) return true;
    if (finiteOrNull(setting.thickness) != null) return true;
    if (finiteOrNull(setting.attenuationDistance) != null) return true;
  }
  return false;
}

/**
 * Apply KHR_materials_transmission (+ ior/volume) onto materials in a GLB buffer.
 * Index keys in `settings` match model-viewer / editor material slot indices.
 */
export async function bakeKhrTransmissionIntoGlb(
  input: Uint8Array | Buffer,
  settings: Record<string | number, KhrTransmissionBakeSetting | null | undefined>,
): Promise<KhrTransmissionBakeResult> {
  const [{ NodeIO }, { KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsVolume }] =
    await Promise.all([import("@gltf-transform/core"), import("@gltf-transform/extensions")]);

  const io = new NodeIO().registerExtensions([
    KHRMaterialsTransmission,
    KHRMaterialsIOR,
    KHRMaterialsVolume,
  ]);
  const document = await io.readBinary(new Uint8Array(input));
  const root = document.getRoot();
  const materials = root.listMaterials();

  const txExt = document.createExtension(KHRMaterialsTransmission);
  const iorExt = document.createExtension(KHRMaterialsIOR);
  const volExt = document.createExtension(KHRMaterialsVolume);

  let materialsTouched = 0;

  for (const [key, setting] of Object.entries(settings || {})) {
    if (!setting || typeof setting !== "object") continue;
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= materials.length) continue;

    const mat = materials[index];
    const transmission = finiteOrNull(setting.transmission);
    const ior = finiteOrNull(setting.ior);
    const thickness = finiteOrNull(setting.thickness);
    const attenuationDistance = finiteOrNull(setting.attenuationDistance);
    const wantsTransmission = transmission != null && transmission > 0.01;

    let touched = false;

    if (wantsTransmission) {
      const factor = clamp01(transmission!);
      let tx = mat.getExtension("KHR_materials_transmission") as any;
      if (!tx) {
        tx = txExt.createTransmission();
        mat.setExtension("KHR_materials_transmission", tx);
      }
      if (Math.abs(Number(tx.getTransmissionFactor()) - factor) > 0.0001) {
        tx.setTransmissionFactor(factor);
        touched = true;
      } else {
        touched = true; // extension present / ensured
      }

      // Transmission requires opaque alpha in glTF (BLEND fights the extension).
      if (mat.getAlphaMode() !== "OPAQUE") {
        mat.setAlphaMode("OPAQUE");
        touched = true;
      }
      const base = mat.getBaseColorFactor();
      if (base[3] < 0.999) {
        mat.setBaseColorFactor([base[0], base[1], base[2], 1]);
        touched = true;
      }

      // Metals kill dielectric transmission — gemstones must be dielectric.
      if (setting.type === "gemstone" && mat.getMetallicFactor() > 0.001) {
        mat.setMetallicFactor(0);
        touched = true;
      }
    } else if (transmission != null && transmission <= 0.01) {
      if (mat.getExtension("KHR_materials_transmission")) {
        mat.setExtension("KHR_materials_transmission", null);
        touched = true;
      }
    }

    if (ior != null && ior > 1.001) {
      let iorMat = mat.getExtension("KHR_materials_ior") as any;
      if (!iorMat) {
        iorMat = iorExt.createIOR();
        mat.setExtension("KHR_materials_ior", iorMat);
      }
      if (Math.abs(Number(iorMat.getIOR()) - ior) > 0.0001) {
        iorMat.setIOR(ior);
      }
      touched = true;
    }

    const wantsVolume =
      wantsTransmission &&
      ((thickness != null && thickness > 0) ||
        (attenuationDistance != null && attenuationDistance > 0));

    if (wantsVolume) {
      let vol = mat.getExtension("KHR_materials_volume") as any;
      if (!vol) {
        vol = volExt.createVolume();
        mat.setExtension("KHR_materials_volume", vol);
      }
      if (thickness != null && thickness >= 0) {
        vol.setThicknessFactor(Math.max(0, thickness));
      }
      if (attenuationDistance != null && attenuationDistance > 0) {
        vol.setAttenuationDistance(attenuationDistance);
      }
      if (setting.attenuationColor) {
        const rgb = hexToRgb01(String(setting.attenuationColor));
        vol.setAttenuationColor(rgb);
      }
      touched = true;
    } else if (transmission != null && transmission <= 0.01) {
      if (mat.getExtension("KHR_materials_volume")) {
        mat.setExtension("KHR_materials_volume", null);
        touched = true;
      }
    }

    if (touched) materialsTouched += 1;
  }

  // Drop unused extension declarations so the GLB stays clean.
  const stillUsesTx = materials.some((m) => m.getExtension("KHR_materials_transmission"));
  const stillUsesIor = materials.some((m) => m.getExtension("KHR_materials_ior"));
  const stillUsesVol = materials.some((m) => m.getExtension("KHR_materials_volume"));
  if (!stillUsesTx) txExt.dispose();
  if (!stillUsesIor) iorExt.dispose();
  if (!stillUsesVol) volExt.dispose();

  if (materialsTouched === 0) {
    return {
      buffer: new Uint8Array(input),
      changed: false,
      materialsTouched: 0,
      extensionsUsed: root.listExtensionsUsed().map((e) => e.extensionName),
    };
  }

  const output = await io.writeBinary(document);
  return {
    buffer: output,
    changed: true,
    materialsTouched,
    extensionsUsed: root.listExtensionsUsed().map((e) => e.extensionName),
  };
}

/**
 * Ensure model-viewer material APIs write transmission (activates Physical path).
 * Returns true when a transmission setter was invoked.
 * @deprecated Import from khr-transmission-viewer.ts in client code.
 */
export { ensureModelViewerKhrTransmission } from "./khr-transmission-viewer";
