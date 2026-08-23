import { analyzeObject3D, primitiveKey } from "@/lib/gem-renderer-poc/analyzeGemGeometry";
import {
  evaluateGemSuitability,
  type GemSuitabilityResult,
} from "@/lib/gem-renderer-poc/gemSuitability";
import type { GemCandidateMesh } from "./types";

const GEM_NAME = /gem|stone|diamond|crystal|jewel|brilliant|solitaire|pav[eé]/i;
const METAL_NAME = /gold|metal|band|ring|shank|prong|bezel/i;

/** Fast hint before GLB parse — metadata / naming only. */
export function hintGemFromMeshNames(meshNames: string[]): boolean {
  return meshNames.some((n) => GEM_NAME.test(n) && !METAL_NAME.test(n));
}

/** Map material index from mesh name overlap (best-effort). */
function guessMaterialIndex(
  meshName: string,
  materialIndexByName: Map<string, number>,
): number | null {
  for (const [name, idx] of materialIndexByName) {
    if (meshName.includes(name) || name.includes(meshName)) return idx;
  }
  return null;
}

/**
 * Full suitability pass — only after active GLB is loaded (never at catalog startup).
 */
export function analyzeGemCandidatesFromGlbScene(
  scene: import("three").Object3D,
  label: string,
  options?: {
    gemMeshHints?: string[];
    materialNames?: string[];
  },
): GemCandidateMesh[] {
  const report = analyzeObject3D(scene, label);
  const materialIndexByName = new Map<string, number>();
  (options?.materialNames || []).forEach((name, i) => {
    if (name) materialIndexByName.set(name, i);
  });

  const hints = new Set(options?.gemMeshHints || []);
  const out: GemCandidateMesh[] = [];

  for (const prim of report.primitives) {
    const key = primitiveKey(prim);
    const nameHint =
      hints.has(prim.meshName) ||
      GEM_NAME.test(prim.meshName) ||
      hintGemFromMeshNames([prim.meshName]);
    if (!nameHint && METAL_NAME.test(prim.meshName)) continue;

    const suitability = evaluateGemSuitability(prim);
    if (suitability.status === "UNSUPPORTED") continue;

    out.push({
      meshKey: key,
      meshName: prim.meshName,
      primitiveIndex: prim.primitiveIndex,
      materialIndex: guessMaterialIndex(prim.meshName, materialIndexByName),
      suitability,
    });
  }

  // Prefer smallest supported gem (center stone) then name match
  out.sort((a, b) => {
    const aCenter = /gem|diamond|center|main|solitaire/i.test(a.meshName) ? 1 : 0;
    const bCenter = /gem|diamond|center|main|solitaire/i.test(b.meshName) ? 1 : 0;
    if (aCenter !== bCenter) return bCenter - aCenter;
    return a.suitability.triangleCount - b.suitability.triangleCount;
  });

  return out;
}

export function pickPrimaryGemCandidate(
  candidates: GemCandidateMesh[],
): GemCandidateMesh | null {
  return candidates[0] ?? null;
}

export function suitabilitySummary(
  results: GemSuitabilityResult[],
): "supported" | "unsupported" | "unknown" {
  if (results.some((r) => r.status !== "UNSUPPORTED")) return "supported";
  if (results.length > 0) return "unsupported";
  return "unknown";
}
