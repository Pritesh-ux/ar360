import type { GemSuitabilityResult } from "@/lib/gem-renderer-poc/gemSuitability";

/** Lightweight catalog row — no GLB bytes, no GPU handles. */
export type ProductAssetMetadata = {
  productId: string;
  modelUrl: string;
  thumbnailUrl?: string;
  title?: string;
  variantIds?: string[];
  /** Cached from prior open — optional hint only. */
  gemSuitabilityHint?: "unknown" | "supported" | "unsupported";
  gemMeshKeys?: string[];
};

export type ActiveProductKey = {
  productId: string;
  /** Variant id when known — geometry reuse when same GLB. */
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

export type GemBridgeState =
  | { mode: "idle" }
  | { mode: "loading"; productId: string }
  | { mode: "pbr"; productId: string; reason: string }
  | {
      mode: "gem";
      productId: string;
      candidates: GemCandidateMesh[];
      primaryKey: string;
    }
  | { mode: "error"; productId: string; message: string };

export type GemIntegrationDiagnostics = {
  bridgeState: GemBridgeState;
  cacheEntries: number;
  queuePending: number;
  queueActive: number;
  warmProductId: string | null;
};
