/** Helpers for Material Inspector → model-viewer / Three MeshPhysicalMaterial. */

import {
  applyGemstoneOpticalApproximation,
  disableGemstoneOpticalApproximation,
  probeGemstoneMaterial,
  publishGemProbe,
} from "@/lib/materials/gemstone-optics-approx";

/**
 * Inspector / glTF UI uses 0 to mean "attenuation off". Three.js interprets
 * attenuationDistance 0 as zero mean-free-path (full absorb → black gems).
 */
export function resolveAttenuationDistanceForThree(
  uiValue: number | null | undefined,
): number | null {
  if (uiValue == null || !Number.isFinite(Number(uiValue))) return null;
  const n = Number(uiValue);
  if (n <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(1e-4, n);
}

/**
 * Thin jewelry shells ghost / vanish above ~0.4 transmission in model-viewer
 * (HDRI isn’t sampled as an opaque backdrop). Soft-cap so high Inspector
 * values still keep facets visible; thick glass keeps the raw value.
 */
export function resolveWebTransmissionFactor(
  uiTransmission: number,
  options?: { thinWall?: boolean },
): number {
  const t = Math.min(1, Math.max(0, Number(uiTransmission) || 0));
  if (!options?.thinWall || t <= 0) return t;
  return Math.min(0.42, t);
}

/**
 * Faceted gemstones need enough transmission to reveal pavilion facets through
 * the crown (reference look), but colored stones stay optically dense via
 * attenuation — not via zero transmission (that becomes plastic).
 */
export function resolveGemstoneTransmissionFactor(
  uiTransmission: number,
  gemstoneType?: string | null,
): number {
  const t = Math.min(1, Math.max(0, Number(uiTransmission) || 0));
  if (t <= 0) return 0;
  const colored =
    gemstoneType === "ruby" ||
    gemstoneType === "sapphire" ||
    gemstoneType === "emerald" ||
    gemstoneType === "amethyst";
  // Enough to see internal facet lattice; attenuation kills background bleed.
  return Math.min(colored ? 0.28 : 0.7, t);
}

/**
 * Authored gemstone thickness is a *scale factor reference* (preset neutral = 0.55),
 * not an absolute world-unit depth. Absolute depth comes from mesh bounds.
 */
export function resolveGemstoneThicknessFactor(
  uiThickness: number | null | undefined,
): number | null {
  if (uiThickness == null || !Number.isFinite(Number(uiThickness))) return null;
  return Math.min(5, Math.max(0, Number(uiThickness)));
}

/** Presets author attenuation as if optical thickness ≈ this reference. */
export const GEMSTONE_ATTENUATION_REFERENCE_THICKNESS = 0.55;

/**
 * Scale UI attenuationDistance to the real gem mesh optical thickness.
 *
 * Without this, mm-scale jewelry stones keep absolute distances like 0.045 while
 * runtime thickness is ~0.005 → almost no Beer–Lambert absorption → pink plastic.
 * UI 0 still means OFF → Infinity (existing contract).
 *
 * Colored gems also clamp mean-free-path ≤ ~35% of thickness so the stone stays
 * optically dense (dark internals) instead of clear see-through glass.
 */
export function resolveGemstoneAttenuationDistanceForThree(
  uiDistance: number | null | undefined,
  runtimeThickness: number,
  gemstoneType?: string | null,
): number | null {
  if (uiDistance == null || !Number.isFinite(Number(uiDistance))) return null;
  const ui = Number(uiDistance);
  if (ui <= 0) return Number.POSITIVE_INFINITY;
  const thickness = Math.max(
    1e-5,
    Number(runtimeThickness) || GEMSTONE_ATTENUATION_REFERENCE_THICKNESS,
  );
  let scaled = ui * (thickness / GEMSTONE_ATTENUATION_REFERENCE_THICKNESS);
  const colored =
    gemstoneType === "ruby" ||
    gemstoneType === "sapphire" ||
    gemstoneType === "emerald" ||
    gemstoneType === "amethyst";
  if (colored) {
    scaled = Math.min(scaled, thickness * 0.28);
  }
  return Math.max(1e-5, scaled);
}

function collectCorrelatedMaterialSets(material: any): Set<any>[] {
  const sets: Set<any>[] = [];
  if (!material) return sets;
  try {
    for (const key of Object.getOwnPropertySymbols(material)) {
      const value = (material as any)[key];
      if (value instanceof Set) sets.push(value);
    }
  } catch {
    // Optional
  }
  try {
    for (const key of Object.keys(material)) {
      const value = (material as any)[key];
      if (value instanceof Set) sets.push(value);
    }
  } catch {
    // Optional
  }
  return sets;
}

/** model-viewer exposes Three mats via named symbols — do not rely on Set-only discovery. */
function collectNamedThreeMaterialRefs(material: any): any[] {
  const out: any[] = [];
  if (!material) return out;
  const wanted = new Set([
    "threeMaterial",
    "threeMaterials",
    "backingThreeMaterial",
    "backingThreeMaterials",
    "correlatedObjects",
    "correlatedSceneGraph",
    "threeGLTF",
  ]);
  try {
    for (const key of Object.getOwnPropertySymbols(material)) {
      const desc = String((key as any).description || "");
      if (!wanted.has(desc)) continue;
      const value = (material as any)[key];
      if (value instanceof Set) {
        for (const item of value) out.push(item);
      } else if (Array.isArray(value)) {
        for (const item of value) out.push(item);
      } else if (value) {
        out.push(value);
      }
    }
  } catch {
    // Optional
  }
  return out;
}

function collectViewerSceneRoots(viewer: any): any[] {
  const roots: any[] = [];
  if (!viewer) return roots;
  try {
    for (const key of Object.getOwnPropertySymbols(viewer)) {
      const value = viewer[key];
      if (value && typeof value === "object" && typeof value.traverse === "function") {
        roots.push(value);
      }
    }
  } catch {
    // Optional
  }
  try {
    const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
      (symbol) => symbol.description === "scene",
    );
    const scene = sceneSymbol ? (viewer as any)[sceneSymbol] : null;
    if (scene?.target?.traverse) roots.push(scene.target);
    if (scene?.traverse) roots.push(scene);
  } catch {
    // Optional
  }
  return roots;
}

/**
 * Also walk the live scene so we patch the exact Mesh.material instances
 * model-viewer is drawing. Matches by identity OR mv material correlation
 * (Object.values / name) — critical when correlated Set discovery is empty.
 */
export function collectThreeMaterialsFromViewerScene(
  viewer: any,
  mvMaterial?: any,
  known: any[] = [],
): any[] {
  const found: any[] = [];
  const knownSet = new Set(known.filter(Boolean));
  const push = (item: any) => {
    if (!item || typeof item !== "object") return;
    if (found.includes(item)) return;
    if (
      (item.isMeshPhysicalMaterial || item.isMeshStandardMaterial) &&
      typeof item.uuid === "string"
    ) {
      found.push(item);
    }
  };

  const matchesMv = (threeMat: any) => {
    if (!mvMaterial) return false;
    if (knownSet.has(threeMat)) return true;
    try {
      for (const value of Object.values(mvMaterial)) {
        if (value === threeMat) return true;
        if (Array.isArray(value) && value.includes(threeMat)) return true;
        if (value instanceof Set && value.has(threeMat)) return true;
      }
    } catch {
      // ignore
    }
    try {
      for (const key of Object.getOwnPropertySymbols(mvMaterial)) {
        const value = (mvMaterial as any)[key];
        if (value === threeMat) return true;
        if (Array.isArray(value) && value.includes(threeMat)) return true;
        if (value instanceof Set && value.has(threeMat)) return true;
      }
    } catch {
      // ignore
    }
    const threeName = String(threeMat.name || "").trim().toLowerCase();
    const mvName = String(mvMaterial.name || "").trim().toLowerCase();
    return Boolean(threeName && mvName && threeName === mvName);
  };

  for (const root of collectViewerSceneRoots(viewer)) {
    try {
      root.traverse?.((child: any) => {
        if (!child?.isMesh) return;
        const mats = Array.isArray(child?.material)
          ? child.material
          : child?.material
            ? [child.material]
            : [];
        for (const mat of mats) {
          if (knownSet.size > 0 && knownSet.has(mat)) {
            push(mat);
            continue;
          }
          if (matchesMv(mat)) push(mat);
        }
      });
    } catch {
      // Optional
    }
  }
  return found;
}

/**
 * Promote MeshStandardMaterial → Physical **in place** (same object identity).
 * Creating `new MeshPhysicalMaterial()` from the app's `three` import and swapping
 * mesh materials can leave model-viewer's correlated Standard mats in place —
 * Transmission then writes a dead property and dark stone slots vanish.
 */
function promoteStandardToPhysicalInPlace(mat: any): boolean {
  if (!mat || typeof mat !== "object") return false;
  if (!mat.isMeshStandardMaterial) return false;
  if (mat.isMeshPhysicalMaterial && mat.defines && "PHYSICAL" in mat.defines) {
    return false;
  }

  const Color = mat.color?.constructor;
  const Vector2 = mat.normalScale?.constructor;

  mat.isMeshPhysicalMaterial = true;
  mat.type = "MeshPhysicalMaterial";
  mat.defines = { ...(mat.defines || {}), STANDARD: "", PHYSICAL: "" };

  mat.anisotropy = Number(mat.anisotropy) || 0;
  mat.anisotropyRotation = Number(mat.anisotropyRotation) || 0;
  mat.anisotropyMap = mat.anisotropyMap ?? null;

  mat.clearcoat = Number(mat.clearcoat) || 0;
  mat.clearcoatMap = mat.clearcoatMap ?? null;
  mat.clearcoatRoughness = Number(mat.clearcoatRoughness) || 0;
  mat.clearcoatRoughnessMap = mat.clearcoatRoughnessMap ?? null;
  mat.clearcoatNormalMap = mat.clearcoatNormalMap ?? null;
  mat.clearcoatNormalScale =
    mat.clearcoatNormalScale || (Vector2 ? new Vector2(1, 1) : { x: 1, y: 1 });

  mat.ior = Number.isFinite(Number(mat.ior)) ? Number(mat.ior) : 1.5;
  mat.iridescence = Number(mat.iridescence) || 0;
  mat.iridescenceMap = mat.iridescenceMap ?? null;
  mat.iridescenceIOR = Number.isFinite(Number(mat.iridescenceIOR))
    ? Number(mat.iridescenceIOR)
    : 1.3;
  mat.iridescenceThicknessRange = mat.iridescenceThicknessRange || [100, 400];
  mat.iridescenceThicknessMap = mat.iridescenceThicknessMap ?? null;

  mat.sheen = Number(mat.sheen) || 0;
  mat.sheenColor = mat.sheenColor || (Color ? new Color(0, 0, 0) : { r: 0, g: 0, b: 0 });
  mat.sheenColorMap = mat.sheenColorMap ?? null;
  mat.sheenRoughness = Number.isFinite(Number(mat.sheenRoughness))
    ? Number(mat.sheenRoughness)
    : 1;
  mat.sheenRoughnessMap = mat.sheenRoughnessMap ?? null;

  mat.transmission = Number(mat.transmission) || 0;
  mat.transmissionMap = mat.transmissionMap ?? null;
  mat.thickness = Number(mat.thickness) || 0;
  mat.thicknessMap = mat.thicknessMap ?? null;
  mat.attenuationDistance = Number.isFinite(Number(mat.attenuationDistance))
    ? Number(mat.attenuationDistance)
    : Infinity;
  mat.attenuationColor =
    mat.attenuationColor || (Color ? new Color(1, 1, 1) : { r: 1, g: 1, b: 1 });

  mat.specularIntensity = Number.isFinite(Number(mat.specularIntensity))
    ? Number(mat.specularIntensity)
    : 1;
  mat.specularIntensityMap = mat.specularIntensityMap ?? null;
  mat.specularColor =
    mat.specularColor || (Color ? new Color(1, 1, 1) : { r: 1, g: 1, b: 1 });
  mat.specularColorMap = mat.specularColorMap ?? null;

  mat.dispersion = Number(mat.dispersion) || 0;

  mat.version = (Number(mat.version) || 0) + 1;
  mat.needsUpdate = true;
  return true;
}

/**
 * Apply gemstone dispersion (and related Physical fields already set elsewhere)
 * onto runtime model-viewer backing materials. Safe when the property is absent.
 */
export function applyGemstoneDispersionToBacking(
  material: any,
  dispersion: number | null | undefined,
): boolean {
  if (dispersion == null || !Number.isFinite(Number(dispersion))) return false;
  const next = Math.min(0.5, Math.max(0, Number(dispersion)));
  const backing = getThreeBackingMaterials(material);
  let changed = false;
  for (const threeMat of backing) {
    if (!threeMat || typeof threeMat !== "object") continue;
    if (!("dispersion" in threeMat)) continue;
    if (Math.abs(Number(threeMat.dispersion) - next) <= 0.0001) continue;
    threeMat.dispersion = next;
    threeMat.needsUpdate = true;
    changed = true;
  }
  return changed;
}

/**
 * Option B — gemstone env multi-lobe / facet contrast approximation on backing.
 */
export function applyGemstoneOpticalApproximationToBacking(
  material: any,
  params: Parameters<typeof applyGemstoneOpticalApproximation>[1],
  options?: { sceneEnvironment?: any | null; viewer?: any },
): boolean {
  const backing = getThreeBackingMaterials(material, options?.viewer);
  if (!backing.length && typeof console !== "undefined") {
    console.warn(
      "[AR360 gem optics] No Three backing materials found — gem shader cannot attach. Transmission-only glass look will remain.",
    );
  }
  let changed = false;
  for (const threeMat of backing) {
    // Keep Physical transmission for pavilion visibility; density comes from
    // attenuation + optical shader, not from zeroing transmission.
    if ("transmission" in threeMat && params.enabled) {
      const cap =
        params.gemstoneType === "diamond" || params.gemstoneType === "moissanite"
          ? 0.7
          : 0.28;
      const cur = Number(threeMat.transmission) || 0;
      if (cur > cap) {
        threeMat.transmission = cap;
        threeMat.needsUpdate = true;
      }
    }
    // Bind scene environment onto the material when missing so CubeUV path exists.
    try {
      const sceneEnv = options?.sceneEnvironment;
      if (sceneEnv && !threeMat.envMap) {
        threeMat.envMap = sceneEnv;
        threeMat.needsUpdate = true;
      }
    } catch {
      // Optional
    }
    if (applyGemstoneOpticalApproximation(threeMat, params)) changed = true;
    const probe = probeGemstoneMaterial(threeMat, {
      sceneEnvironment: options?.sceneEnvironment,
    });
    (probe as any).backingCount = backing.length;
    publishGemProbe(probe);
  }
  return changed;
}

export function disableGemstoneOpticalApproximationOnBacking(material: any): void {
  for (const threeMat of getThreeBackingMaterials(material)) {
    disableGemstoneOpticalApproximation(threeMat);
  }
}

/**
 * Console helper: re-probe first tagged gemstone backing material.
 */
export function probeGemstoneOpticalBacking(
  material: any,
  options?: { sceneEnvironment?: any | null },
) {
  const backing = getThreeBackingMaterials(material);
  const tagged =
    backing.find(
      (m) =>
        m?.userData?.ar360GemOpticsV5 ||
        m?.userData?.ar360GemOpticsV4 ||
        m?.userData?.ar360GemOpticsV3,
    ) ||
    backing[0] ||
    null;
  if (!tagged) return null;
  const probe = probeGemstoneMaterial(tagged, {
    sceneEnvironment: options?.sceneEnvironment,
  });
  publishGemProbe(probe);
  return probe;
}

/**
 * Jewelry “fire” helper: dispersion + mild iridescence on clear stones.
 * Colored gems keep iridescence off so body color stays dense.
 */
export function applyGemstoneOpticsToBacking(
  material: any,
  options: {
    dispersion?: number | null;
    gemstoneType?: string | null;
    viewer?: any;
  },
): boolean {
  const dispersion = Math.min(0.5, Math.max(0, Number(options.dispersion) || 0));
  const clearFire =
    options.gemstoneType === "diamond" || options.gemstoneType === "moissanite";
  // Spectral flashes like jewelry CAD stills — not RGB glass.
  const iridescence = clearFire ? (options.gemstoneType === "moissanite" ? 0.42 : 0.34) : 0;
  const iridescenceIOR = clearFire ? 1.5 : 1.3;

  const backing = getThreeBackingMaterials(material, options.viewer);
  let changed = false;
  for (const threeMat of backing) {
    if (!threeMat || typeof threeMat !== "object") continue;
    if ("dispersion" in threeMat) {
      if (Math.abs(Number(threeMat.dispersion) - dispersion) > 0.0001) {
        threeMat.dispersion = dispersion;
        changed = true;
      }
    }
    if ("iridescence" in threeMat) {
      if (Math.abs(Number(threeMat.iridescence) - iridescence) > 0.0001) {
        threeMat.iridescence = iridescence;
        changed = true;
      }
    }
    if ("iridescenceIOR" in threeMat && clearFire) {
      threeMat.iridescenceIOR = iridescenceIOR;
      changed = true;
    }
    if (clearFire && Array.isArray(threeMat.iridescenceThicknessRange)) {
      threeMat.iridescenceThicknessRange = [120, 420];
      changed = true;
    }
    if (changed) threeMat.needsUpdate = true;
  }
  return changed;
}

/**
 * Estimate optical thickness from the actual gem mesh bounds so attenuation /
 * refraction match jewelry GLB scale (mm vs m) without editing geometry.
 */
export function estimateGemOpticalThickness(viewer: any, material: any): number | null {
  const backing = getThreeBackingMaterials(material, viewer);
  if (!backing.length) return null;
  const backingSet = new Set(backing);
  let minAxis = Number.POSITIVE_INFINITY;

  for (const root of collectViewerSceneRoots(viewer)) {
    try {
      root.traverse?.((child: any) => {
        if (!child?.isMesh || !child.geometry) return;
        const mats = Array.isArray(child.material)
          ? child.material
          : child.material
            ? [child.material]
            : [];
        if (!mats.some((m: any) => backingSet.has(m))) return;
        try {
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox?.();
        } catch {
          return;
        }
        const bb = child.geometry.boundingBox;
        if (!bb) return;
        const sx = Math.abs(bb.max.x - bb.min.x) * Math.abs(child.scale?.x ?? 1);
        const sy = Math.abs(bb.max.y - bb.min.y) * Math.abs(child.scale?.y ?? 1);
        const sz = Math.abs(bb.max.z - bb.min.z) * Math.abs(child.scale?.z ?? 1);
        // Prefer parent world scale when present.
        let wx = sx;
        let wy = sy;
        let wz = sz;
        try {
          child.updateWorldMatrix?.(true, false);
          const e = child.matrixWorld?.elements;
          if (e) {
            const scaleX = Math.hypot(e[0], e[1], e[2]) || 1;
            const scaleY = Math.hypot(e[4], e[5], e[6]) || 1;
            const scaleZ = Math.hypot(e[8], e[9], e[10]) || 1;
            wx = Math.abs(bb.max.x - bb.min.x) * scaleX;
            wy = Math.abs(bb.max.y - bb.min.y) * scaleY;
            wz = Math.abs(bb.max.z - bb.min.z) * scaleZ;
          }
        } catch {
          // local scale fallback already set
        }
        const axis = Math.min(wx, wy, wz);
        if (Number.isFinite(axis) && axis > 1e-8) {
          minAxis = Math.min(minAxis, axis);
        }
      });
    } catch {
      // Optional
    }
  }

  if (!Number.isFinite(minAxis) || minAxis === Number.POSITIVE_INFINITY) return null;
  // Optical path through pavilion ≈ majority of smallest stone axis.
  return Math.min(1.35, Math.max(0.01, minAxis * 0.78));
}

/**
 * Combine authored UI thickness (preset reference scale) with mesh bounds.
 * Preset neutral thickness = 0.55 → scale 1.0 against estimated optical depth.
 */
export function resolveGemstoneRuntimeThickness(
  viewer: any,
  material: any,
  uiThickness: number | null | undefined,
): number {
  const authoredRaw = resolveGemstoneThicknessFactor(uiThickness);
  const authored = authoredRaw == null || authoredRaw <= 0 ? 0.55 : authoredRaw;
  const estimated = estimateGemOpticalThickness(viewer, material);
  if (estimated == null) {
    return Math.min(1.4, Math.max(0.02, authored));
  }
  const scale = authored / GEMSTONE_ATTENUATION_REFERENCE_THICKNESS;
  return Math.min(1.5, Math.max(0.01, estimated * Math.max(0.25, scale)));
}

const upgradedMvMaterials = new WeakSet<object>();

/** Walk mv material bags — model-viewer nests Three mats under symbols / Sets. */
function collectDeepThreeMaterials(root: any, depth = 0, seen?: Set<object>): any[] {
  const out: any[] = [];
  if (!root || typeof root !== "object" || depth > 4) return out;
  const visited = seen || new Set<object>();
  if (visited.has(root)) return out;
  visited.add(root);

  const push = (item: any) => {
    if (!item || typeof item !== "object") return;
    if (
      (item.isMeshPhysicalMaterial || item.isMeshStandardMaterial) &&
      typeof item.uuid === "string" &&
      !out.includes(item)
    ) {
      out.push(item);
    }
  };

  push(root);
  if (root instanceof Set || Array.isArray(root)) {
    for (const item of root) {
      push(item);
      if (item && typeof item === "object" && !item.isMeshStandardMaterial) {
        for (const nested of collectDeepThreeMaterials(item, depth + 1, visited)) push(nested);
      }
    }
    return out;
  }

  const keys: Array<string | symbol> = [];
  try {
    keys.push(...Object.getOwnPropertySymbols(root));
  } catch {
    // Optional
  }
  try {
    keys.push(...Object.keys(root));
  } catch {
    // Optional
  }
  for (const key of keys) {
    let value: any;
    try {
      value = root[key];
    } catch {
      continue;
    }
    push(value);
    if (value instanceof Set || Array.isArray(value) || (value && typeof value === "object")) {
      if (value.isTexture || value.isMesh || value.isBufferGeometry) continue;
      for (const nested of collectDeepThreeMaterials(value, depth + 1, visited)) push(nested);
    }
  }
  return out;
}

export function ensurePhysicalBackingForRefraction(material: any, viewer?: any): boolean {
  if (!material) return false;

  const backing = getThreeBackingMaterials(material, viewer);
  if (
    upgradedMvMaterials.has(material) &&
    backing.length &&
    backing.every((m) => m?.isMeshPhysicalMaterial && m?.defines && "PHYSICAL" in m.defines)
  ) {
    return false;
  }

  if (!backing.length) return false;

  let changed = false;
  for (const item of backing) {
    if (promoteStandardToPhysicalInPlace(item)) changed = true;
  }

  upgradedMvMaterials.add(material);
  return changed;
}

export function getThreeBackingMaterials(material: any, viewer?: any): any[] {
  if (!material) return [];

  const found: any[] = [];
  const push = (item: any) => {
    if (!item || typeof item !== "object") return;
    if (found.includes(item)) return;
    if (
      (item.isMeshPhysicalMaterial || item.isMeshStandardMaterial) &&
      typeof item.uuid === "string"
    ) {
      found.push(item);
    }
  };

  for (const set of collectCorrelatedMaterialSets(material)) {
    for (const item of set) push(item);
  }
  for (const item of collectNamedThreeMaterialRefs(material)) push(item);
  for (const item of collectDeepThreeMaterials(material)) push(item);

  try {
    for (const key of Object.getOwnPropertySymbols(material)) {
      const value = (material as any)[key];
      if (value instanceof Set) continue;
      if (Array.isArray(value)) {
        for (const item of value) push(item);
      } else {
        push(value);
      }
    }
  } catch {
    // Optional
  }

  if (viewer) {
    for (const item of collectThreeMaterialsFromViewerScene(
      viewer,
      material,
      found,
    )) {
      push(item);
    }
  }

  return found;
}

export function tintHex(baseHex: string, tintHexValue: string): string {
  const a = hexToRgb01(baseHex);
  const b = hexToRgb01(tintHexValue);
  return rgb01ToHex(a[0] * b[0], a[1] * b[1], a[2] * b[2]);
}

function channelToHex(value: number) {
  const clamped = Math.max(0, Math.min(255, Math.round(value * 255)));
  return clamped.toString(16).padStart(2, "0");
}

export function hexToRgb01(hex: string): [number, number, number] {
  const raw = String(hex || "#ffffff").replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgb01ToHex(r: number, g: number, b: number) {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

export function applyMeshFlagsForMaterial(
  viewer: any,
  materialIndex: number,
  flags: {
    castShadow?: boolean;
    receiveShadow?: boolean;
    renderOrder?: number;
  },
) {
  const mvMat = viewer?.model?.materials?.[materialIndex];
  const threeList = getThreeBackingMaterials(mvMat);
  if (!threeList.length) return;

  for (const root of collectViewerSceneRoots(viewer)) {
    try {
      root.traverse((child: any) => {
        const childMats = Array.isArray(child.material)
          ? child.material
          : child.material
            ? [child.material]
            : [];
        const matched = childMats.some((m: any) => threeList.includes(m));
        if (!matched) return;
        if (flags.castShadow != null) child.castShadow = Boolean(flags.castShadow);
        if (flags.receiveShadow != null) child.receiveShadow = Boolean(flags.receiveShadow);
        if (flags.renderOrder != null && Number.isFinite(Number(flags.renderOrder))) {
          child.renderOrder = Number(flags.renderOrder);
        }
      });
    } catch {
      // Optional
    }
  }
}
