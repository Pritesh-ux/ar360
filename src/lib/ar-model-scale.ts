/**
 * glTF / AR (model-viewer, Scene Viewer, Quick Look) treat 1 unit = 1 meter.
 * Many CAD / Blender exports are authored in cm or mm, so products look
 * building-sized in AR. Infer a uniform scale to bring them to real size.
 */

export type ArModelUnit = "auto" | "m" | "cm" | "mm";

const UNIT_SCALE: Record<Exclude<ArModelUnit, "auto">, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
};

/** Feet → meters. SketchUp / architectural GLBs often author rooms in feet. */
const FEET_TO_METERS = 0.3048;

/** Largest axis length from model-viewer getDimensions() (values as meters). */
export function maxModelDimension(dimensions?: { x?: number; y?: number; z?: number } | null) {
  if (!dimensions) return 0;
  return Math.max(
    Number(dimensions.x || 0),
    Number(dimensions.y || 0),
    Number(dimensions.z || 0),
  );
}

export function minModelDimension(dimensions?: { x?: number; y?: number; z?: number } | null) {
  if (!dimensions) return 0;
  const axes = [dimensions.x, dimensions.y, dimensions.z]
    .map((n) => Number(n || 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!axes.length) return 0;
  return Math.min(...axes);
}

/**
 * Heuristic when product has no explicit unit.
 * glTF / AR treat 1 unit = 1 meter. A 9ft bathroom is ~2.7m — or ~9 units if
 * the file was exported in feet. The old "> 3.5 → cm" rule turned that room
 * into a ~9cm dollhouse (100× too small).
 *
 * - > 100 units              → millimeters (150mm lock, 1800mm cabinet)
 * - > 12 units               → centimeters (15cm lock, 80cm chair, 250cm sofa)
 * - all axes about 5–20      → feet (9ft-tall interior, not 9cm and not 9m)
 * - otherwise                → already meters (2–6m rooms, furniture, jewelry)
 */
export function inferArModelScaleFromMaxDimension(maxDim: number, minDim = 0): number {
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  if (maxDim > 100) return UNIT_SCALE.mm;
  if (maxDim > 12) return UNIT_SCALE.cm;

  const shortest = Number.isFinite(minDim) && minDim > 0 ? minDim : maxDim;
  if (shortest >= 5 && maxDim <= 20) return FEET_TO_METERS;

  return UNIT_SCALE.m;
}

export function resolveArModelScale(input: {
  unit?: ArModelUnit | null;
  /** Explicit override (takes precedence over unit when > 0). */
  scale?: number | null;
  maxDimension?: number | null;
  minDimension?: number | null;
}): number {
  const explicit = Number(input.scale);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const unit = input.unit || "auto";
  if (unit !== "auto" && UNIT_SCALE[unit]) {
    return UNIT_SCALE[unit];
  }

  return inferArModelScaleFromMaxDimension(
    Number(input.maxDimension || 0),
    Number(input.minDimension || 0),
  );
}

/** model-viewer `scale` attribute value */
export function formatModelViewerScale(scale: number): string {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const v = Number(s.toPrecision(6));
  return `${v} ${v} ${v}`;
}
