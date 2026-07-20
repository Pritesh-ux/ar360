/**
 * lib/object-capture/image-analysis.ts
 *
 * Mock image analysis algorithms for Object Capture AI validation.
 */

export async function analyzeBlurScore(imagePath: string, index: number): Promise<number> {
  // Return a mock blur score where lower is sharper (e.g. 0-100)
  // Simulate 1 out of 30 images being blurry
  if (index > 0 && index % 28 === 0) {
    return 65; // Blurry threshold is > 50
  }
  return Math.floor(Math.random() * 15) + 5; // Clean, sharp image (5-20)
}

export async function analyzeBrightness(imagePath: string, index: number): Promise<number> {
  // Returns mock brightness level 0-100 (ideal is 50-85)
  // Simulate occasional dark images
  if (index > 0 && index % 35 === 0) {
    return 25; // Too dark
  }
  return Math.floor(Math.random() * 20) + 68; // Balanced lighting (68-88)
}

export async function checkDuplicate(
  imageUrl: string,
  index: number
): Promise<string | null> {
  // Returns another image url if a duplicate is detected
  // Simulate occasional duplicate image
  if (index > 0 && index % 42 === 0) {
    return `duplicate-trigger-at-${index}`;
  }
  return null;
}

export function inferAngleLabel(index: number, total: number): string {
  const ratio = total <= 1 ? 0 : index / total;
  if (ratio < 0.17) return "Front";
  if (ratio < 0.34) return "Left";
  if (ratio < 0.51) return "Back";
  if (ratio < 0.68) return "Right";
  if (ratio < 0.84) return "Top";
  return "Bottom";
}
