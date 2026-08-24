/**
 * Client-safe model-viewer transmission helpers (no Node / gltf-transform).
 */

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Ensure model-viewer material APIs write transmission (activates Physical path). */
export function ensureModelViewerKhrTransmission(material: any, factor: number): boolean {
  const next = clamp01(Number(factor) || 0);
  try {
    if (typeof material?.setTransmissionFactor === "function") {
      material.setTransmissionFactor(next);
      return true;
    }
    if (typeof material?.transmission?.setTransmissionFactor === "function") {
      material.transmission.setTransmissionFactor(next);
      return true;
    }
    if (material && "transmissionFactor" in material) {
      material.transmissionFactor = next;
      return true;
    }
  } catch {
    // Optional — Three backing path still applies transmission.
  }
  return false;
}
