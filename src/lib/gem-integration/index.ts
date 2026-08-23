export { globalAssetLoadQueue, AssetLoadQueue } from "./assetLoadQueue";
export { BoundedResourceCache } from "./boundedResourceCache";
export { isGemRendererIntegrationEnabled } from "./featureFlags";
export {
  hintGemFromMeshNames,
  analyzeGemCandidatesFromGlbScene,
  pickPrimaryGemCandidate,
  suitabilitySummary,
} from "./gemDetection";
export {
  attachGemBridge,
  deactivateGemProduct,
  disposeAllGemSessions,
  getGemBridgeState,
  getGemIntegrationDiagnostics,
  isGemRendererActiveForProduct,
  subscribeGemBridge,
  syncGemEnvironment,
} from "./gemModelViewerBridge";
export { buildAr360EnvironmentSource, resolveGemEnvironmentUrl } from "./environmentBridge";
export { getViewerThreeCamera } from "./gemCameraSync";
export type {
  ActiveProductKey,
  GemBridgeState,
  GemCandidateMesh,
  GemIntegrationDiagnostics,
  ProductAssetMetadata,
} from "./types";
