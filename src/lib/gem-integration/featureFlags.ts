/**
 * Gem Renderer integration feature gate.
 *
 * Production: OFF unless NEXT_PUBLIC_GEM_RENDERER_INTEGRATION=1
 * Staging: ON when hostname starts with "staging." (even if flag unset)
 * Local: ON when NEXT_PUBLIC_GEM_RENDERER_INTEGRATION=1
 */

export type GemIntegrationFlagInput = {
  /** Override for tests — client hostname when on dashboard. */
  hostname?: string;
  /** Override env flag (default reads process.env). */
  envFlag?: string | undefined;
};

function readHostname(input?: GemIntegrationFlagInput): string {
  if (input?.hostname != null) return String(input.hostname).trim().toLowerCase();
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname.trim().toLowerCase();
  }
  return "";
}

function readEnvFlag(input?: GemIntegrationFlagInput): string | undefined {
  if (input?.envFlag !== undefined) return input.envFlag;
  return process.env.NEXT_PUBLIC_GEM_RENDERER_INTEGRATION;
}

/** True when GemRenderer may attach to ModelViewer canvas. */
export function isGemRendererIntegrationEnabled(input?: GemIntegrationFlagInput): boolean {
  const envFlag = readEnvFlag(input);
  if (envFlag === "1") return true;

  const host = readHostname(input);
  if (host.startsWith("staging.")) return true;

  return false;
}

/** Dev/staging diagnostics overlay — never customer-facing production UI. */
export function isGemRendererDebugOverlayEnabled(input?: GemIntegrationFlagInput): boolean {
  if (process.env.NEXT_PUBLIC_GEM_RENDERER_DEBUG === "1") return true;
  if (process.env.NODE_ENV === "development") return true;
  const host = readHostname(input);
  return host.startsWith("staging.") || host === "localhost" || host === "127.0.0.1";
}
