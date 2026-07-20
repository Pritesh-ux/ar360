export const ProductErrorCode = {
  INVALID_GLB: "INVALID_GLB",
  MODEL_CORRUPTED: "MODEL_CORRUPTED",
  TEXTURE_MISSING: "TEXTURE_MISSING",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  SAVE_FAILED: "SAVE_FAILED",
  PUBLISH_FAILED: "PUBLISH_FAILED",
  VIEWER_FAILED: "VIEWER_FAILED",
  VERSION_CONFLICT: "VERSION_CONFLICT",
} as const;

export type ProductErrorCode = (typeof ProductErrorCode)[keyof typeof ProductErrorCode];

const FRIENDLY_MESSAGES: Record<ProductErrorCode, string> = {
  INVALID_GLB: "This file is not a valid GLB model. Please export a .glb from your 3D tool.",
  MODEL_CORRUPTED: "The model file appears damaged or incomplete. Try re-exporting your GLB.",
  TEXTURE_MISSING: "One or more textures referenced by the model are missing inside the file.",
  UPLOAD_FAILED: "Upload failed. Please try again.",
  SAVE_FAILED: "Could not save your changes. Please try again.",
  PUBLISH_FAILED: "Publishing failed. Fix the checklist items and try again.",
  VIEWER_FAILED: "The viewer could not load this product.",
  VERSION_CONFLICT: "This product was updated in another tab. Reload to get the latest version.",
};

export function productErrorResponse(code: ProductErrorCode, message?: string, status = 400) {
  return {
    success: false,
    code,
    error: message || FRIENDLY_MESSAGES[code],
    status,
  };
}

export function friendlyProductError(code: ProductErrorCode, override?: string) {
  return override || FRIENDLY_MESSAGES[code];
}
