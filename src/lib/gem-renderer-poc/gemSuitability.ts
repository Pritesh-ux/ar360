/**
 * Gem suitability gate — production-facing validation (POC V5).
 * Does not mutate GLB bytes. Does not silently repair meshes.
 */
import type { MeshPrimitiveReport } from "./analyzeGemGeometry";
import { GEM_POC_MAX_TRIANGLES } from "./GemMeshAdapter";

export type GemSupportStatus =
  | "SUPPORTED"
  | "SUPPORTED_WITH_WARNING"
  | "UNSUPPORTED";

export type GemSuitabilityResult = {
  status: GemSupportStatus;
  meshName: string;
  primitiveIndex: number;
  triangleCount: number;
  reasons: string[];
  warnings: string[];
  /** Human-readable rejection / caution summary. */
  summary: string;
  checks: {
    triangleCountOk: boolean;
    degeneratesOk: boolean;
    windingOk: boolean;
    normalsOk: boolean;
    manifoldOk: boolean;
    selfIntersectionOk: boolean;
    scaleOk: boolean;
    materialHintOk: boolean;
  };
};

const METAL_NAME = /gold|metal|band|ring|setting|shank|prong/i;
const GEM_NAME = /gem|stone|diamond|crystal|jewel|brilliant/i;

/**
 * Evaluate a single mesh primitive for GemRenderer eligibility.
 */
export function evaluateGemSuitability(
  p: MeshPrimitiveReport,
): GemSuitabilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const triangleCountOk =
    p.triangleCount > 0 && p.triangleCount <= GEM_POC_MAX_TRIANGLES;
  if (p.triangleCount <= 0) reasons.push("Zero triangles");
  if (p.triangleCount > GEM_POC_MAX_TRIANGLES) {
    reasons.push(
      `Triangle count ${p.triangleCount} exceeds hard cap ${GEM_POC_MAX_TRIANGLES}`,
    );
  }

  const degenRatio =
    p.triangleCount > 0 ? p.degenerateTriangles / p.triangleCount : 1;
  const degeneratesOk = degenRatio <= 0.02;
  if (!degeneratesOk) {
    reasons.push(
      `${p.degenerateTriangles} degenerate triangles (${(degenRatio * 100).toFixed(1)}%)`,
    );
  } else if (p.degenerateTriangles > 0) {
    warnings.push(`${p.degenerateTriangles} degenerate triangle(s)`);
  }

  const windingOk = !p.windingInconsistent && p.windingOutwardRatio >= 0.85;
  if (!windingOk) {
    reasons.push(
      `Inconsistent winding (outward ${(p.windingOutwardRatio * 100).toFixed(0)}%)`,
    );
  }

  const normalsOk = p.hasNormals || p.triangleCount > 0;
  if (!p.hasNormals) {
    warnings.push("No authored normals — facet normals derived from triangles");
  }

  const manifoldOk = (p.weldedOpenEdges ?? 0) === 0;
  if (!manifoldOk) {
    reasons.push(
      `${p.weldedOpenEdges} welded open edges — shell is not closed (ray exits unreliable)`,
    );
  } else if (p.openEdges > 0) {
    warnings.push(
      `${p.openEdges} topological open edges (common with split-vertex hard facets)`,
    );
  }

  const selfIntersectionOk = p.selfIntersectionHits <= 3;
  if (p.selfIntersectionHits > 3) {
    reasons.push(
      `Self-intersection sample hits ${p.selfIntersectionHits}/${p.selfIntersectionSamples}`,
    );
  } else if (p.selfIntersectionHits > 0) {
    warnings.push(
      `Possible self-intersection (${p.selfIntersectionHits} sample hits)`,
    );
  }

  const maxDim = Math.max(...p.dimensions, 0);
  const scaleOk = maxDim > 1e-8 && Number.isFinite(maxDim);
  if (!scaleOk) reasons.push("Degenerate / non-finite bounding box scale");

  const name = p.meshName || "";
  const looksMetal = METAL_NAME.test(name) && !GEM_NAME.test(name);
  const materialHintOk = !looksMetal;
  if (looksMetal) {
    reasons.push(
      `Mesh name "${name}" looks like metal/setting — not a gem optics candidate`,
    );
  }

  if (p.suitability === "poor") {
    for (const prob of p.problems) {
      if (!reasons.includes(prob) && !warnings.includes(prob)) {
        // escalate poor analyzer suitability
        if (/degenerate|winding|non-manifold|welded open|exceeds/i.test(prob)) {
          if (!reasons.some((r) => r.includes(prob.slice(0, 24)))) {
            reasons.push(prob);
          }
        } else {
          warnings.push(prob);
        }
      }
    }
  }

  let status: GemSupportStatus = "SUPPORTED";
  if (
    !triangleCountOk ||
    !degeneratesOk ||
    !windingOk ||
    !manifoldOk ||
    !selfIntersectionOk ||
    !scaleOk ||
    !materialHintOk
  ) {
    status = "UNSUPPORTED";
  } else if (warnings.length > 0 || p.suitability === "partial") {
    status = "SUPPORTED_WITH_WARNING";
  }

  const summary =
    status === "SUPPORTED"
      ? `SUPPORTED — ${p.meshName} (${p.triangleCount} tris)`
      : status === "SUPPORTED_WITH_WARNING"
        ? `SUPPORTED_WITH_WARNING — ${warnings[0] || "see warnings"}`
        : `UNSUPPORTED — ${reasons[0] || "failed suitability checks"}`;

  return {
    status,
    meshName: p.meshName,
    primitiveIndex: p.primitiveIndex,
    triangleCount: p.triangleCount,
    reasons,
    warnings,
    summary,
    checks: {
      triangleCountOk,
      degeneratesOk,
      windingOk,
      normalsOk,
      manifoldOk,
      selfIntersectionOk,
      scaleOk,
      materialHintOk,
    },
  };
}
