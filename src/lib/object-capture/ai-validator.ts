/**
 * Compatibility entry point for the former validator service.
 * Analysis is now persisted through the customer-scoped production service.
 */
export { analyzeCaptureJob, getCaptureAnalysis } from "./production-service";
export type { QualityResult as QualitySummary } from "./quality-score";
