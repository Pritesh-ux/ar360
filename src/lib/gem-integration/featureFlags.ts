/**
 * Gem Renderer integration feature gate — staging / explicit opt-in only.
 * Default OFF in production customer Canvas.
 */

/** True when GemRenderer may attach to ModelViewer (never default-on in prod). */
export function isGemRendererIntegrationEnabled(): boolean {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_GEM_RENDERER_INTEGRATION === "1";
  }
  if (process.env.NEXT_PUBLIC_GEM_RENDERER_INTEGRATION === "1") return true;
  // Staging host auto-enable for validation builds only.
  try {
    const host = window.location.hostname.toLowerCase();
    if (host === "staging.ar360studio.com" || host.startsWith("staging.")) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
