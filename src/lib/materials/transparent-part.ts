import type { MaterialSetting } from "@/components/features/editor/types";

/** Names that usually mean glass / liquid / see-through / gem parts in product GLBs. */
const TRANSPARENT_OR_GEM_NAME_RE =
  /glass|water|liquid|fluid|transparent|translucent|\bclear\b|acrylic|lens|optics|see[\s_-]?through|ice|crystal|bottle[\s_-]?glass|goggle|visor|window|gem|diamond|jewel|zircon|sapphire|ruby|emerald|brilliant|facet|solitaire|pav[eé]|stone|cubic|tourize|amethyst|opal|pearl|beryl|topaz/i;

/** Strong metal names — never treat as gem/glass from look heuristics alone. */
const SOLID_METAL_NAME_RE =
  /gold|silver|platinum|steel|iron|copper|brass|bronze|metal|chrome|aluminium|aluminum|titanium|band|shank|prong|bezel|ring[\s_-]?body/i;

export type TransparentPartInput = {
  name?: string | null;
  /** Extra mesh / node names tied to this material (or product scene hints). */
  relatedNames?: Array<string | null | undefined> | null;
  opacity?: number | null;
  alphaMode?: string | null;
  transmission?: number | null;
  metalness?: number | null;
  roughness?: number | null;
  /** Hex like #rrggbb or #rgb */
  baseColor?: string | null;
};

function parseHexLuminance(hex: string | null | undefined): number | null {
  const raw = String(hex || "").trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function nameBagLooksGemOrGlass(value: string | null | undefined): boolean {
  return TRANSPARENT_OR_GEM_NAME_RE.test(String(value || ""));
}

function anyNameLooksGemOrGlass(input: TransparentPartInput): boolean {
  if (nameBagLooksGemOrGlass(input.name)) return true;
  for (const related of input.relatedNames || []) {
    if (nameBagLooksGemOrGlass(related)) return true;
  }
  return false;
}

function anyNameLooksSolidMetal(input: TransparentPartInput): boolean {
  if (SOLID_METAL_NAME_RE.test(String(input.name || ""))) return true;
  for (const related of input.relatedNames || []) {
    if (SOLID_METAL_NAME_RE.test(String(related || ""))) return true;
  }
  return false;
}

/**
 * PBR look that usually means clear / gemstone rather than painted plastic or metal.
 * Intentionally strict so a single white “fallback” matte material is not auto-flagged.
 */
export function looksLikeGemOrGlassMaterial(input: TransparentPartInput): boolean {
  if (anyNameLooksSolidMetal(input)) return false;

  const metalness =
    input.metalness != null && Number.isFinite(Number(input.metalness))
      ? Number(input.metalness)
      : null;
  const roughness =
    input.roughness != null && Number.isFinite(Number(input.roughness))
      ? Number(input.roughness)
      : null;
  const luminance = parseHexLuminance(input.baseColor);

  if (metalness != null && metalness >= 0.65) return false;

  const transmission =
    input.transmission != null && Number.isFinite(Number(input.transmission))
      ? Number(input.transmission)
      : 0;
  if (transmission > 0.02) {
    return metalness == null || metalness < 0.55;
  }

  const alphaMode = String(input.alphaMode || "OPAQUE").toUpperCase();
  if (alphaMode === "BLEND" || alphaMode === "MASK") {
    return metalness == null || metalness < 0.55;
  }

  // Name / related mesh already said gem — allow modest PBR wiggle room.
  if (anyNameLooksGemOrGlass(input)) {
    if (metalness != null && metalness >= 0.7) return false;
    if (roughness != null && roughness > 0.55) return false;
    return true;
  }

  // Look-only: very shiny, non-metal, light color (typical stone export without "Diamond" name).
  if (metalness == null || roughness == null || luminance == null) return false;
  return metalness <= 0.28 && roughness <= 0.18 && luminance >= 0.62;
}

/**
 * True when this GLB material is meant to be (or already is) see-through / gem-like —
 * glass, water, diamond, clear plastic, etc. Solid metal/paint slots return false.
 */
export function isTransparentMaterialPart(input: TransparentPartInput): boolean {
  const alphaMode = String(input.alphaMode || "OPAQUE").toUpperCase();
  if (alphaMode === "BLEND" || alphaMode === "MASK") {
    return !anyNameLooksSolidMetal(input) || looksLikeGemOrGlassMaterial(input);
  }

  const opacity =
    input.opacity != null && Number.isFinite(Number(input.opacity))
      ? Number(input.opacity)
      : 1;
  if (opacity < 0.999) {
    return !anyNameLooksSolidMetal(input) || looksLikeGemOrGlassMaterial(input);
  }

  const transmission =
    input.transmission != null && Number.isFinite(Number(input.transmission))
      ? Number(input.transmission)
      : 0;
  if (transmission > 0.001) {
    return !anyNameLooksSolidMetal(input) || looksLikeGemOrGlassMaterial(input);
  }

  if (anyNameLooksGemOrGlass(input)) {
    return looksLikeGemOrGlassMaterial(input) || !anyNameLooksSolidMetal(input);
  }

  return looksLikeGemOrGlassMaterial(input);
}

/** Inspector is authoritative: do not strip user refraction/opacity overrides. */
export function stripTransparencyOverridesForOpaqueSlot(
  setting: MaterialSetting,
  // Signature kept for call-site compatibility (ModelViewer / ProductDetailClient).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  native?: MaterialSetting | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  materialName?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  relatedNames?: Array<string | null | undefined> | null,
): MaterialSetting {
  return setting;
}

/** Mesh / node names that look like stone or glass parts (for editor guidance). */
export function listGemOrGlassNameHints(names: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = String(raw || "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    if (!nameBagLooksGemOrGlass(name)) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.slice(0, 8);
}
