const DEFAULT_ENVIRONMENT = "default";

/** Reject browser-only / oversized HDR payloads that break model-viewer on reopen. */
export function isUnusableEnvironmentImage(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return true;
  // Extremely long values are almost always corrupted data-URLs pasted into JSON.
  if (raw.length > 2048) return true;
  return false;
}

export function sanitizeEnvironmentImage(
  value?: string | null,
  fallback: string = DEFAULT_ENVIRONMENT,
) {
  const raw = String(value || "").trim();
  if (!raw || raw === "default") return fallback;
  if (isUnusableEnvironmentImage(raw)) return fallback;
  if (raw === "neutral") return fallback;
  return raw;
}
