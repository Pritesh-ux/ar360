/**
 * V5 DEVICE DEBUG — structured pipeline log for iPhone Safari / WebGL diagnosis.
 * POC only. Does not change rendering algorithms.
 */

export type PipelineStageId =
  | "boot"
  | "webgl_context"
  | "webgl_caps"
  | "shader_create"
  | "shader_compile"
  | "shader_link"
  | "hdri_fetch"
  | "hdri_decode"
  | "asset_fetch"
  | "glb_parse"
  | "gem_extract"
  | "suitability"
  | "mesh_pack"
  | "framebuffer"
  | "first_render"
  | "draw_calls"
  | "webgl_errors"
  | "pixel_probe";

export type StageStatus = "pending" | "ok" | "warn" | "fail" | "skip";

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  status: StageStatus;
  detail: string;
  updatedAt: number;
};

export type DeviceDebugSnapshot = {
  updatedAt: number;
  failureStage: PipelineStageId | null;
  failureDetail: string | null;
  stages: PipelineStage[];
  events: string[];
  caps: Record<string, string | number | boolean | null>;
  shader: {
    gemCompileOk: boolean | null;
    gemLinkOk: boolean | null;
    gemVertLog: string;
    gemFragLog: string;
    gemProgramLog: string;
    blitCompileOk: boolean | null;
    blitLinkOk: boolean | null;
    blitFragLog: string;
  };
  asset: {
    url: string;
    httpStatus: number | null;
    bytes: number | null;
    parseOk: boolean | null;
    meshCount: number | null;
    selectedMesh: string | null;
    suitability: string | null;
  };
  render: {
    drawCalls: number;
    firstRenderAt: number | null;
    lastGlError: string;
    framebufferStatus: string;
    canvasCss: string;
    canvasBuffer: string;
    pixelCenterRGBA: string;
    envMapReady: boolean;
    triangleTexReady: boolean;
    triangleCount: number;
  };
};

const STAGE_ORDER: { id: PipelineStageId; label: string }[] = [
  { id: "boot", label: "Boot" },
  { id: "webgl_context", label: "WebGL context" },
  { id: "webgl_caps", label: "WebGL caps / iOS checks" },
  { id: "shader_create", label: "Shader create" },
  { id: "shader_compile", label: "Shader compile" },
  { id: "shader_link", label: "Program link" },
  { id: "hdri_fetch", label: "HDRI fetch" },
  { id: "hdri_decode", label: "HDRI decode" },
  { id: "asset_fetch", label: "Asset fetch" },
  { id: "glb_parse", label: "GLB parse" },
  { id: "gem_extract", label: "Gem extraction" },
  { id: "suitability", label: "Suitability" },
  { id: "mesh_pack", label: "Mesh pack / float tex" },
  { id: "framebuffer", label: "Framebuffer" },
  { id: "first_render", label: "First render call" },
  { id: "draw_calls", label: "Draw calls" },
  { id: "webgl_errors", label: "WebGL errors" },
  { id: "pixel_probe", label: "Visible pixels" },
];

function glErrorName(gl: WebGLRenderingContext, err: number): string {
  const map: Record<number, string> = {
    [gl.NO_ERROR]: "NO_ERROR",
    [gl.INVALID_ENUM]: "INVALID_ENUM",
    [gl.INVALID_VALUE]: "INVALID_VALUE",
    [gl.INVALID_OPERATION]: "INVALID_OPERATION",
    [gl.INVALID_FRAMEBUFFER_OPERATION]: "INVALID_FRAMEBUFFER_OPERATION",
    [gl.OUT_OF_MEMORY]: "OUT_OF_MEMORY",
    [gl.CONTEXT_LOST_WEBGL]: "CONTEXT_LOST_WEBGL",
  };
  return map[err] || `0x${err.toString(16)}`;
}

export function drainGlErrors(gl: WebGLRenderingContext | null): string[] {
  if (!gl) return ["no-gl"];
  const out: string[] = [];
  for (let i = 0; i < 16; i++) {
    const e = gl.getError();
    if (e === gl.NO_ERROR) break;
    out.push(glErrorName(gl, e));
  }
  return out;
}

export class DeviceDebugLog {
  private stages = new Map<PipelineStageId, PipelineStage>();
  private events: string[] = [];
  private listeners = new Set<() => void>();
  caps: Record<string, string | number | boolean | null> = {};
  shader = {
    gemCompileOk: null as boolean | null,
    gemLinkOk: null as boolean | null,
    gemVertLog: "",
    gemFragLog: "",
    gemProgramLog: "",
    blitCompileOk: null as boolean | null,
    blitLinkOk: null as boolean | null,
    blitFragLog: "",
  };
  asset = {
    url: "",
    httpStatus: null as number | null,
    bytes: null as number | null,
    parseOk: null as boolean | null,
    meshCount: null as number | null,
    selectedMesh: null as string | null,
    suitability: null as string | null,
  };
  render = {
    drawCalls: 0,
    firstRenderAt: null as number | null,
    lastGlError: "—",
    framebufferStatus: "—",
    canvasCss: "—",
    canvasBuffer: "—",
    pixelCenterRGBA: "—",
    envMapReady: false,
    triangleTexReady: false,
    triangleCount: 0,
  };

  constructor() {
    for (const s of STAGE_ORDER) {
      this.stages.set(s.id, {
        id: s.id,
        label: s.label,
        status: "pending",
        detail: "…",
        updatedAt: Date.now(),
      });
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  }

  log(msg: string) {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    this.events.unshift(line);
    if (this.events.length > 80) this.events.length = 80;
    console.info(`[GemV5Debug] ${msg}`);
    this.emit();
  }

  setStage(id: PipelineStageId, status: StageStatus, detail: string) {
    const prev = this.stages.get(id);
    this.stages.set(id, {
      id,
      label: prev?.label || id,
      status,
      detail: detail.slice(0, 500),
      updatedAt: Date.now(),
    });
    this.log(`${id}: ${status} — ${detail.slice(0, 160)}`);
    this.emit();
  }

  snapshot(): DeviceDebugSnapshot {
    const stages = STAGE_ORDER.map(
      (s) =>
        this.stages.get(s.id) || {
          id: s.id,
          label: s.label,
          status: "pending" as const,
          detail: "…",
          updatedAt: 0,
        },
    );
    const fail = stages.find((s) => s.status === "fail");
    return {
      updatedAt: Date.now(),
      failureStage: fail?.id ?? null,
      failureDetail: fail?.detail ?? null,
      stages,
      events: [...this.events],
      caps: { ...this.caps },
      shader: { ...this.shader },
      asset: { ...this.asset },
      render: { ...this.render },
    };
  }
}

/** Probe iPhone-relevant WebGL2 / float / HDR capabilities. */
export function fillIosRelevantCaps(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null,
  into: Record<string, string | number | boolean | null>,
) {
  if (!gl) {
    into.webgl = "none";
    return;
  }
  const is2 =
    typeof WebGL2RenderingContext !== "undefined" &&
    gl instanceof WebGL2RenderingContext;
  into.webgl = is2 ? "WebGL2" : "WebGL1";
  into.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  into.maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
  into.maxFragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
  into.maxVaryings = gl.getParameter(gl.MAX_VARYING_VECTORS);
  into.vendor = String(gl.getParameter(gl.VENDOR) || "");
  into.renderer = String(gl.getParameter(gl.RENDERER) || "");
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  if (dbg) {
    into.unmaskedVendor = String(
      gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "",
    );
    into.unmaskedRenderer = String(
      gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "",
    );
  }
  into.EXT_color_buffer_float = Boolean(
    gl.getExtension("EXT_color_buffer_float"),
  );
  into.EXT_color_buffer_half_float = Boolean(
    gl.getExtension("EXT_color_buffer_half_float"),
  );
  into.OES_texture_float_linear = Boolean(
    gl.getExtension("OES_texture_float_linear"),
  );
  into.OES_texture_half_float_linear = Boolean(
    gl.getExtension("OES_texture_half_float_linear"),
  );

  // highp fragment precision
  const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  into.fragHighp = Boolean(hp && hp.precision > 0);
  into.fragHighpRangeMin = hp?.rangeMin ?? null;
  into.fragHighpRangeMax = hp?.rangeMax ?? null;
  into.fragHighpPrecision = hp?.precision ?? null;

  // Float RGBA texture upload probe (triangle atlas path)
  try {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const data = new Float32Array([1, 0, 0, 1]);
    if (is2) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        (gl as WebGL2RenderingContext).RGBA32F,
        1,
        1,
        0,
        gl.RGBA,
        gl.FLOAT,
        data,
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.FLOAT,
        data,
      );
    }
    const errs = drainGlErrors(gl);
    into.floatRgbaTexUpload = errs.length === 0 ? "ok" : errs.join(",");
    gl.deleteTexture(tex);
  } catch (e) {
    into.floatRgbaTexUpload = e instanceof Error ? e.message : "fail";
  }

  into.userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : "";
  into.isIPhone = /iPhone|iPad|iPod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );
  into.expectedGlsl = "GLSL3 (#version 300 es)";
  into.notes =
    "Check fragHighp, floatRgbaTexUpload, EXT_color_buffer_float, OES_texture_float_linear for iOS black-canvas causes";
}

/**
 * Force-compile a ShaderMaterial and extract compile/link logs via Three internals.
 * Three r152+ stores WebGLProgram on materialProperties.currentProgram / .programs Map
 * (not .program).
 */
export function inspectThreeShaderCompile(
  renderer: {
    compile: (scene: unknown, camera: unknown) => void;
    properties: {
      get: (m: unknown) => {
        currentProgram?: {
          program?: WebGLProgram;
          diagnostics?: {
            runnable?: boolean;
            programLog?: string;
            vertexShader?: { log?: string };
            fragmentShader?: { log?: string };
          };
        };
        programs?: Map<
          string,
          {
            program?: WebGLProgram;
            diagnostics?: {
              runnable?: boolean;
              programLog?: string;
              vertexShader?: { log?: string };
              fragmentShader?: { log?: string };
            };
          }
        >;
      };
    };
    getContext: () => WebGLRenderingContext;
  },
  scene: unknown,
  camera: unknown,
  material: unknown,
): {
  compileOk: boolean;
  linkOk: boolean;
  programLog: string;
  vertLog: string;
  fragLog: string;
  glErrors: string[];
} {
  const gl = renderer.getContext();
  drainGlErrors(gl);
  try {
    renderer.compile(scene, camera);
  } catch (e) {
    return {
      compileOk: false,
      linkOk: false,
      programLog: e instanceof Error ? e.message : String(e),
      vertLog: "",
      fragLog: "",
      glErrors: drainGlErrors(gl),
    };
  }
  const props = renderer.properties.get(material);
  let prog = props?.currentProgram ?? null;
  if (!prog && props?.programs && props.programs.size > 0) {
    prog = props.programs.values().next().value ?? null;
  }
  const diag = prog?.diagnostics;
  const glErrors = drainGlErrors(gl);

  let linkOk = true;
  let programLog = "";
  let fragLog = diag?.fragmentShader?.log || "";
  let vertLog = diag?.vertexShader?.log || "";
  let compileOk = true;

  if (prog?.program && gl.isProgram(prog.program)) {
    linkOk = Boolean(gl.getProgramParameter(prog.program, gl.LINK_STATUS));
    programLog = gl.getProgramInfoLog(prog.program) || "";
    const shaders = gl.getAttachedShaders(prog.program) || [];
    for (const sh of shaders) {
      const type = gl.getShaderParameter(sh, gl.SHADER_TYPE);
      const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
      const log = gl.getShaderInfoLog(sh) || "";
      if (type === gl.FRAGMENT_SHADER) {
        if (!ok) compileOk = false;
        if (log) fragLog = log;
      }
      if (type === gl.VERTEX_SHADER) {
        if (!ok) compileOk = false;
        if (log) vertLog = log;
      }
    }
  }
  if (diag) {
    if (diag.runnable === false) {
      compileOk = false;
      linkOk = false;
    }
    if (diag.programLog) programLog = diag.programLog;
    if (diag.fragmentShader?.log) fragLog = diag.fragmentShader.log;
    if (diag.vertexShader?.log) vertLog = diag.vertexShader.log;
  }

  if (!prog?.program) {
    compileOk = false;
    linkOk = false;
    if (!programLog) {
      programLog = "no WebGLProgram after renderer.compile() (check currentProgram/programs)";
    }
  }

  return {
    compileOk,
    linkOk,
    programLog: (programLog || "").slice(0, 800),
    vertLog: (vertLog || "").slice(0, 800),
    fragLog: (fragLog || "").slice(0, 800),
    glErrors,
  };
}

export function framebufferStatusName(
  gl: WebGLRenderingContext,
  status: number,
): string {
  const map: Record<number, string> = {
    [gl.FRAMEBUFFER_COMPLETE]: "FRAMEBUFFER_COMPLETE",
    [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: "INCOMPLETE_ATTACHMENT",
    [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]:
      "INCOMPLETE_MISSING_ATTACHMENT",
    [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: "INCOMPLETE_DIMENSIONS",
    [gl.FRAMEBUFFER_UNSUPPORTED]: "UNSUPPORTED",
  };
  return map[status] || `0x${status.toString(16)}`;
}
