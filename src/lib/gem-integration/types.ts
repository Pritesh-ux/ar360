import type { GemSuitabilityResult } from "@/lib/gem-renderer-poc/gemSuitability";

/** Lightweight catalog row — no GLB bytes, no GPU handles. */
export type ProductAssetMetadata = {
  productId: string;
  modelUrl: string;
  thumbnailUrl?: string;
  title?: string;
  variantIds?: string[];
  gemSuitabilityHint?: "unknown" | "supported" | "unsupported";
  gemMeshKeys?: string[];
};

export type ActiveProductKey = {
  productId: string;
  variantId?: string;
  modelUrl: string;
};

export type GemCandidateMesh = {
  meshKey: string;
  meshName: string;
  primitiveIndex: number;
  materialIndex: number | null;
  suitability: GemSuitabilityResult;
};

/** Overlay lifecycle — diagnostics only; never gates pixel visibility on luminance. */
export type GemOverlayPhase =
  | "idle"
  | "off"
  | "detected"
  | "loading"
  | "active"
  | "fallback"
  | "error";

export type GemBridgeState =
  | { mode: "idle"; phase: "idle" | "off" }
  | { mode: "loading"; productId: string; phase: "loading" }
  | {
      mode: "active";
      productId: string;
      phase: "active";
      candidates: GemCandidateMesh[];
      primaryKey: string;
      primaryMeshName: string;
      cameraSyncOk: boolean;
    }
  | { mode: "fallback"; productId: string; phase: "fallback"; reason: string }
  | { mode: "error"; productId: string; phase: "error"; message: string };

export type GemIntegrationDiagnostics = {
  bridgeState: GemBridgeState;
  cacheEntries: number;
  queuePending: number;
  queueActive: number;
  warmProductId: string | null;
};
