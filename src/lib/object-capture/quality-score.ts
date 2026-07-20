/**
 * lib/object-capture/quality-score.ts
 *
 * Overall quality score calculator for Object Capture jobs.
 */

export type QualityScoreInput = {
  photoCount: number;
  blurCount: number;
  duplicateCount: number;
  lowExposureCount: number;
};

export type QualityResult = {
  qualityScore: number;
  coverageScore: number;
  exposureStatus: "Good" | "Needs More Light" | "Needs More Photos" | "Excellent";
  suggestions: string[];
};

export function calculateQualityScore(input: QualityScoreInput): QualityResult {
  const suggestions: string[] = [];
  const { photoCount, blurCount, duplicateCount, lowExposureCount } = input;

  // 1. Coverage Score based on recommended photo count (80)
  const coverageScore = Math.min(100, Math.round((photoCount / 80) * 100));

  // 2. Base Quality Score calculation
  let qualityScore = 70;
  // Reward photo quantity up to 20 points
  qualityScore += Math.min(20, Math.floor(photoCount / 4));
  // Penalize blurry images
  qualityScore -= blurCount * 6;
  // Penalize duplicates
  qualityScore -= duplicateCount * 4;
  // Penalize poorly lit images
  qualityScore -= lowExposureCount * 3;

  // Bound score between 0 and 100
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // 3. Exposure Status Determination
  let exposureStatus: QualityResult["exposureStatus"] = "Good";
  if (photoCount < 20) {
    exposureStatus = "Needs More Photos";
  } else if (lowExposureCount > photoCount * 0.1) {
    exposureStatus = "Needs More Light";
  } else if (qualityScore >= 85) {
    exposureStatus = "Excellent";
  }

  // 4. Generate constructive suggestions
  if (photoCount < 20) {
    suggestions.push("Capture at least 20 photos.");
  }
  if (photoCount < 80) {
    suggestions.push(`Capture ${80 - photoCount} more photos for better coverage.`);
  }
  if (blurCount > 0) {
    suggestions.push(`Retake ${blurCount} blurry images.`);
  }
  if (duplicateCount > 0) {
    suggestions.push(`Remove ${duplicateCount} duplicate images.`);
  }
  if (lowExposureCount > 0) {
    suggestions.push("Ensure consistent and soft lighting for the product.");
  }
  if (coverageScore < 75) {
    suggestions.push("Capture top, bottom, and side angles.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Capture quality looks excellent. Ready for processing.");
  }

  return {
    qualityScore,
    coverageScore,
    exposureStatus,
    suggestions,
  };
}
