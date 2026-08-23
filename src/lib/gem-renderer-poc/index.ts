export {
  GemRenderer,
  type PerfSampleResult,
  type BvhCompareResult,
  type StudyRow,
} from "./GemRenderer";
export { GemMaterial } from "./GemMaterial";
export { GemEnvironment } from "./GemEnvironment";
export {
  adaptMeshToGem,
  GEM_POC_MAX_TRIANGLES,
  type PackedGemMesh,
} from "./GemMeshAdapter";
export {
  TECHNIQUE_META,
  createGemDiamondMaterial,
} from "./GemDiamondShader";
export {
  createBrilliantCutGeometry,
  countInwardFacetNormals,
} from "./createBrilliantCut";
export {
  createHighFacetBrilliantGeometry,
  createEmeraldCutGeometry,
  createMalformedGemGeometry,
} from "./createCutVariants";
export { buildGemBvh, disposeGemBvh } from "./GemBvh";
export {
  analyzeObject3D,
  primitiveKey,
  type GlbGeometryReport,
  type MeshPrimitiveReport,
} from "./analyzeGemGeometry";
export {
  evaluateGemSuitability,
  type GemSupportStatus,
  type GemSuitabilityResult,
} from "./gemSuitability";
export {
  DIAMOND_PHYSICAL_DEFAULTS,
  QUALITY_DESKTOP_MEDIUM,
  QUALITY_MOBILE_LOW,
  QUALITY_REFERENCE,
  splitContractsFromLegacy,
  type PhysicalGemParams,
  type RenderQualityParams,
  type GemMaterialInput,
  type GemEnvironmentParams,
} from "./gemMaterialContract";
export {
  GEM_HDRI_NOTES,
  type Ar360EnvironmentSource,
  type GemEnvironmentContract,
} from "./gemHdriContract";
export {
  describeScaleThicknessBehavior,
  computeViewFitScale,
  GEM_VIEW_FIT_TARGET,
} from "./scaleThickness";
export { DeviceDebugLog, type DeviceDebugSnapshot } from "./deviceDebugLog";
export { PERFORMANCE_BUDGETS } from "./performanceBudgets";
export { probeDeviceCapabilities } from "./deviceCapabilities";
export { AutoQualityController } from "./autoQualityController";
export {
  TEST_ASSET_CATALOG,
  STORAGE_ALLOWLIST,
  type TestAssetSpec,
} from "./testAssetCatalog";
export {
  CALIBRATION_PRESETS,
  DISPERSION_PRESETS,
  VISUAL_VIEWS,
  type CalibrationSceneId,
  type VisualViewId,
} from "./presets";
export {
  PRODUCTION_PRESETS,
  BOUNCE_STUDY_COUNTS,
  paramsForQualityTier,
  type ProductionPresetId,
} from "./qualityPresets";
export {
  DEFAULT_GEM_POC_PARAMS,
  REFERENCE_DIAMOND_PARAMS,
  DEFAULT_BVH_TRIANGLE_THRESHOLD,
  resolveAccelEffective,
  pickAutoQualityTier,
  samplesForParams,
  wavelengthsForParams,
  type GemPocParams,
  type GemPocDiagnostics,
  type GemQualityMode,
  type GemDebugMode,
  type AccelMode,
  type QualityTier,
  type WavelengthMode,
} from "./types";

