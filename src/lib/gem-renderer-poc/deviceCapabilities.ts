/**
 * Runtime WebGL / device capability probe (POC V5).
 * No user-agent device blacklists.
 */
export type DeviceCapabilityReport = {
  webglVersion: "WebGL2" | "WebGL1" | "none";
  maxTextureSize: number;
  maxRenderbufferSize: number;
  floatTextures: boolean;
  gpuVendor: string;
  gpuRenderer: string;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  canvasPixels: number;
};

export function probeDeviceCapabilities(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null,
  canvasPixels: number,
): DeviceCapabilityReport {
  const isWebGL2 =
    typeof WebGL2RenderingContext !== "undefined" &&
    gl instanceof WebGL2RenderingContext;

  let maxTextureSize = 0;
  let maxRenderbufferSize = 0;
  let floatTextures = false;
  let gpuVendor = "unknown";
  let gpuRenderer = "unknown";

  if (gl) {
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 0;
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      gpuVendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "unknown");
      gpuRenderer = String(
        gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "unknown",
      );
    }
    floatTextures = Boolean(
      gl.getExtension("OES_texture_float") ||
        gl.getExtension("EXT_color_buffer_float") ||
        isWebGL2,
    );
  }

  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { deviceMemory?: number })
      : null;

  return {
    webglVersion: !gl ? "none" : isWebGL2 ? "WebGL2" : "WebGL1",
    maxTextureSize,
    maxRenderbufferSize,
    floatTextures,
    gpuVendor,
    gpuRenderer,
    hardwareConcurrency: nav?.hardwareConcurrency ?? 4,
    deviceMemoryGb: nav?.deviceMemory ?? null,
    canvasPixels,
  };
}
