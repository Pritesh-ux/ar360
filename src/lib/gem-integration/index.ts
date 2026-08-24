export { globalAssetLoadQueue, AssetLoadQueue } from "./assetLoadQueue";
export { BoundedResourceCache } from "./boundedResourceCache";
export { isGemRendererIntegrationEnabled, isGemRendererDebugOverlayEnabled } from "./featureFlags";
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
  getGemPrimaryMaterialIndex,
  getGemIntegrationDiagnostics,
  getGemUiRendererDiagnostic,
  isGemRendererActiveForProduct,
  isGemRendererOverlayReady,
  isGemPrimaryMeshHidden,
  getGemIntegrationDebugOverlay,
  shouldDeferGemSlotToRenderer,
  shouldSkipPbrGemForMaterialSlot,
  subscribeGemBridge,
  syncGemEnvironment,
  syncGemMaterialFromSettings,
} from "./gemModelViewerBridge";
export {
  buildGemUiRendererDiagnostic,
  formatGemContractSummary,
  isGemRendererEligibleGemstone,
  mapMaterialSettingToGemPhysicalParams,
  materialSettingGemSignature,
  resolveGemEnvironmentIntensity,
  resolvePrimaryGemMaterialSetting,
  shouldUseGemRendererForSetting,
} from "./gemMaterialSync";
export {
  applyIntegrationMaterialParams,
  applyIntegrationQualityShell,
  INTEGRATION_REFERENCE_CALIBRATION,
  pickIntegrationQualityTier,
  resolveIntegrationEnvironmentIntensity,
  resolveIntegrationExposure,
} from "./integrationPipeline";
export { buildAr360EnvironmentSource, resolveGemEnvironmentUrl } from "./environmentBridge";
export { getViewerThreeCamera } from "./gemCameraSync";
export type {
  ActiveProductKey,
  GemBridgeState,
  GemCandidateMesh,
  GemIntegrationDiagnostics,
  ProductAssetMetadata,
} from "./types";
