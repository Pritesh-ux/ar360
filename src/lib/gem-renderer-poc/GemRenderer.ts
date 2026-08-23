/**
 * GemRenderer V5 — production-readiness validation POC.
 * Isolated — does not touch ModelViewer.
 */
import {
  AgXToneMapping,
  Box3,
  Clock,
  GLSL3,
  LinearFilter,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  analyzeObject3D,
  primitiveKey,
  type GlbGeometryReport,
  type MeshPrimitiveReport,
} from "./analyzeGemGeometry";
import { AutoQualityController } from "./autoQualityController";
import { createBrilliantCutGeometry } from "./createBrilliantCut";
import {
  createEmeraldCutGeometry,
  createHighFacetBrilliantGeometry,
  createMalformedGemGeometry,
} from "./createCutVariants";
import { probeDeviceCapabilities } from "./deviceCapabilities";
import {
  DeviceDebugLog,
  drainGlErrors,
  fillIosRelevantCaps,
  framebufferStatusName,
  inspectThreeShaderCompile,
} from "./deviceDebugLog";
import { TECHNIQUE_META } from "./GemDiamondShader";
import { GemEnvironment } from "./GemEnvironment";
import type { Ar360EnvironmentSource } from "./gemHdriContract";
import { GemMaterial } from "./GemMaterial";
import {
  evaluateGemSuitability,
  type GemSuitabilityResult,
} from "./gemSuitability";
import {
  adaptMeshToGem,
  disposePackedGem,
  type PackedGemMesh,
} from "./GemMeshAdapter";
import {
  CALIBRATION_PRESETS,
  VISUAL_VIEWS,
  type CalibrationSceneId,
  type VisualViewId,
} from "./presets";
import {
  BOUNCE_STUDY_COUNTS,
  INTERNAL_RES_SCALES,
  PRODUCTION_PRESETS,
  SPP_STUDY_COUNTS,
  paramsForQualityTier,
  type ProductionPresetId,
} from "./qualityPresets";
import { meshWithUniformScale } from "./scaleThickness";
import {
  STORAGE_ALLOWLIST,
  TEST_ASSET_CATALOG,
  type TestAssetSpec,
} from "./testAssetCatalog";
import type {
  GemPocDiagnostics,
  GemPocParams,
  GemQualityMode,
  QualityTier,
  WavelengthMode,
} from "./types";
import {
  REFERENCE_DIAMOND_PARAMS,
  qualityToMaxBounces,
  resolveAccelEffective,
  samplesForParams,
  wavelengthsForParams,
} from "./types";

export type GemRendererOptions = {
  canvas: HTMLCanvasElement;
  environmentUrl?: string;
  onDiagnostics?: (d: GemPocDiagnostics) => void;
  onDeviceDebug?: () => void;
};

export type PerfSampleResult = {
  quality: GemQualityMode;
  fps: number;
  frameTimeMs: number;
  renderWidth: number;
  renderHeight: number;
  samplesPerPixel: number;
  wavelengths: number;
  bounceCount: number;
  triangleCount: number;
  bvhEnabled: boolean;
  triangleTestsPerRay: number;
  bvhNodeCount: number;
  internalResolutionScale?: number;
  accelEffective?: "direct" | "bvh";
  label?: string;
};

export type BvhCompareResult = {
  off: PerfSampleResult;
  on: PerfSampleResult;
};

export type StudyRow = {
  config: string;
  samplesPerPixel: number;
  wavelengths: number;
  bounceCount: number;
  internalRes: number;
  fps: number;
  frameTimeMs: number;
  triangleTestsPerRay: number;
  accelEffective: "direct" | "bvh";
  renderWidth: number;
  renderHeight: number;
  visualQuality: string;
  visualNote: string;
};

type LoadedGlb = {
  label: string;
  scene: import("three").Object3D;
  meshes: Mesh[];
  report: GlbGeometryReport;
  selectedKey: string;
};

function cloneParams(p: GemPocParams): GemPocParams {
  return {
    ...p,
    absorption: [...p.absorption] as [number, number, number],
  };
}

function bounceVisualNote(bounces: number): { score: string; note: string } {
  if (bounces <= 2) {
    return { score: "2/10", note: "Shallow transport; weak TIR / fire" };
  }
  if (bounces === 3) {
    return { score: "4/10", note: "Some internal bounce; still thin" };
  }
  if (bounces === 4) {
    return { score: "6/10", note: "Usable fire starts; mobile candidate" };
  }
  if (bounces === 5) {
    return { score: "7/10", note: "Good contrast; diminishing returns begin" };
  }
  if (bounces === 6) {
    return { score: "8/10", note: "Strong TIR / fire; desktop sweet spot" };
  }
  if (bounces === 8) {
    return {
      score: "8.5/10",
      note: "Marginal gain vs 6; high-quality desktop",
    };
  }
  return { score: "9/10", note: "Reference depth; mostly polish vs 8" };
}

const blitVert = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const blitFrag = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = texture(uTex, vUv);
}
`;

export class GemRenderer {
  private renderer: WebGLRenderer;
  private camera = new PerspectiveCamera(35, 1, 0.05, 100);
  private quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quadScene = new Scene();
  private blitScene = new Scene();
  private controls: OrbitControls;
  private material = new GemMaterial();
  private blitMaterial: ShaderMaterial;
  private env: GemEnvironment;
  private packed: PackedGemMesh | null = null;
  private quad: Mesh;
  private blitQuad: Mesh;
  private gemTarget: WebGLRenderTarget | null = null;
  private clock = new Clock();
  private raf = 0;
  private running = false;
  private gemAngle = 0;
  private gemRotation = new Matrix4();
  private invGemRotation = new Matrix4();
  private params: GemPocParams = cloneParams(REFERENCE_DIAMOND_PARAMS);
  private onDiagnostics?: (d: GemPocDiagnostics) => void;
  private fpsFrames = 0;
  private fpsLast = 0;
  private fps = 0;
  private frameTimeMs = 0;
  private sourceLabel = "procedural-brilliant";
  private disposed = false;
  private ready = false;
  private cameraLocked = false;
  private triangleTestsPerRay = 0;
  private pixelReadBuf = new Uint8Array(4);
  private loadedGlb: LoadedGlb | null = null;
  private lastGeometryReport: GlbGeometryReport | null = null;
  private lastInternalSize = new Vector2(0, 0);
  private invProjection = new Matrix4();
  private invView = new Matrix4();
  private resolution = new Vector2();
  private internalResVec = new Vector2();
  private lastSuitability: GemSuitabilityResult | null = null;
  private fallbackActive = false;
  private fallbackReason: string | null = null;
  private autoQuality = new AutoQualityController();
  private fpsSamples: number[] = [];
  private fpsWindowActive = false;
  private gpuRenderer = "unknown";
  private gpuVendor = "unknown";
  private shaderFailed = false;
  readonly deviceDebug = new DeviceDebugLog();
  private firstRenderLogged = false;
  private firstDrawLogged = false;
  private onDeviceDebug?: () => void;

  constructor(options: GemRendererOptions) {
    this.onDiagnostics = options.onDiagnostics;
    this.onDeviceDebug = options.onDeviceDebug;
    this.deviceDebug.setStage("boot", "ok", "GemRenderer V5 constructing");
    this.deviceDebug.subscribe(() => this.onDeviceDebug?.());

    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = AgXToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor(0x0b0d10, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.debug.checkShaderErrors = true;

    const gl0 = this.renderer.getContext();
    if (!gl0) {
      this.deviceDebug.setStage(
        "webgl_context",
        "fail",
        "getContext() returned null",
      );
    } else {
      const is2 =
        typeof WebGL2RenderingContext !== "undefined" &&
        gl0 instanceof WebGL2RenderingContext;
      this.deviceDebug.setStage(
        "webgl_context",
        is2 ? "ok" : "warn",
        is2 ? "WebGL2 context OK" : "WebGL1 only — GLSL3 gem shader may fail",
      );
      fillIosRelevantCaps(gl0, this.deviceDebug.caps);
      this.deviceDebug.setStage(
        "webgl_caps",
        this.deviceDebug.caps.floatRgbaTexUpload === "ok" ? "ok" : "warn",
        `floatTex=${this.deviceDebug.caps.floatRgbaTexUpload} highp=${String(this.deviceDebug.caps.fragHighp)} EXT_cbf=${String(this.deviceDebug.caps.EXT_color_buffer_float)}`,
      );
      try {
        const caps = probeDeviceCapabilities(gl0, 1);
        this.gpuRenderer = caps.gpuRenderer;
        this.gpuVendor = caps.gpuVendor;
      } catch {
        /* ignore */
      }
    }

    this.env = new GemEnvironment(this.renderer, (p) => {
      this.setParams({
        environmentIntensity: p.environmentIntensity,
        environmentRotation: p.environmentRotation,
        ...(p.exposure != null ? { exposure: p.exposure } : {}),
      });
    });

    const geom = new PlaneGeometry(2, 2);
    this.quad = new Mesh(geom, this.material.threeMaterial);
    this.quadScene.add(this.quad);

    this.blitMaterial = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: blitVert,
      fragmentShader: blitFrag,
      uniforms: { uTex: { value: null } },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.blitQuad = new Mesh(geom.clone(), this.blitMaterial);
    this.blitScene.add(this.blitQuad);
    this.deviceDebug.setStage(
      "shader_create",
      "ok",
      "Gem + blit ShaderMaterials created (glslVersion=GLSL3)",
    );

    this.camera.position.set(0, 0.45, 3.0);
    this.controls = new OrbitControls(this.camera, options.canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 8;

    this.material.setParams(this.params);
    void this.bootstrap(options.environmentUrl || "/hdr/studio.hdr");
  }

  private async bootstrap(envUrl: string) {
    try {
      await this.loadEnvironment(envUrl);
      this.useProceduralBrilliant();
      this.applyCalibration("reference", false);
      this.probeShaderCompile();
      this.ready = true;
      this.start();
      this.deviceDebug.log("bootstrap complete — render loop starting");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.deviceDebug.setStage("boot", "fail", `bootstrap failed: ${msg}`);
      console.error("[GemRenderer POC V5] bootstrap failed", err);
    }
  }

  /** Force compile gem + blit programs and record logs (iPhone-critical). */
  private probeShaderCompile() {
    const gl = this.renderer.getContext();
    try {
      const gem = inspectThreeShaderCompile(
        this.renderer as never,
        this.quadScene,
        this.quadCamera,
        this.material.threeMaterial,
      );
      this.deviceDebug.shader.gemCompileOk = gem.compileOk;
      this.deviceDebug.shader.gemLinkOk = gem.linkOk;
      this.deviceDebug.shader.gemProgramLog = gem.programLog;
      this.deviceDebug.shader.gemVertLog = gem.vertLog;
      this.deviceDebug.shader.gemFragLog = gem.fragLog;
      this.deviceDebug.setStage(
        "shader_compile",
        gem.compileOk && gem.glErrors.length === 0 ? "ok" : "fail",
        gem.compileOk
          ? `gem compile ok; glErrors=[${gem.glErrors.join(",") || "none"}]`
          : `gem compile FAIL frag=${gem.fragLog.slice(0, 200)} prog=${gem.programLog.slice(0, 200)}`,
      );
      this.deviceDebug.setStage(
        "shader_link",
        gem.linkOk ? "ok" : "fail",
        gem.linkOk
          ? "gem program linked"
          : `gem link FAIL: ${gem.programLog.slice(0, 300)}`,
      );
      if (!gem.compileOk || !gem.linkOk) {
        this.shaderFailed = true;
        this.fallbackActive = true;
        this.fallbackReason = "Shader compile/link failed — see DEVICE DEBUG";
      }

      const blit = inspectThreeShaderCompile(
        this.renderer as never,
        this.blitScene,
        this.quadCamera,
        this.blitMaterial,
      );
      this.deviceDebug.shader.blitCompileOk = blit.compileOk;
      this.deviceDebug.shader.blitLinkOk = blit.linkOk;
      this.deviceDebug.shader.blitFragLog = blit.fragLog;

      const fb = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      this.deviceDebug.render.framebufferStatus = framebufferStatusName(gl, fb);
      this.deviceDebug.setStage(
        "framebuffer",
        fb === gl.FRAMEBUFFER_COMPLETE ? "ok" : "fail",
        this.deviceDebug.render.framebufferStatus,
      );

      const errs = drainGlErrors(gl);
      this.deviceDebug.render.lastGlError =
        errs.length > 0 ? errs.join(", ") : "NO_ERROR";
      this.deviceDebug.setStage(
        "webgl_errors",
        errs.length ? "fail" : "ok",
        this.deviceDebug.render.lastGlError,
      );
    } catch (e) {
      this.deviceDebug.setStage(
        "shader_compile",
        "fail",
        e instanceof Error ? e.message : String(e),
      );
      this.shaderFailed = true;
    }
  }

  getDeviceDebugSnapshot() {
    return this.deviceDebug.snapshot();
  }

  getParams() {
    return cloneParams(this.params);
  }

  setParams(partial: Partial<GemPocParams>) {
    this.params = {
      ...this.params,
      ...partial,
      absorption: partial.absorption
        ? ([...partial.absorption] as [number, number, number])
        : this.params.absorption,
    };
    if (partial.wavelengthMode !== undefined) {
      this.params.enableDispersion = partial.wavelengthMode === "rgb3";
    }
    if (
      partial.enableDispersion !== undefined &&
      partial.wavelengthMode === undefined
    ) {
      this.params.wavelengthMode = partial.enableDispersion ? "rgb3" : "off";
    }
    if (partial.enableBvh !== undefined && partial.accelMode === undefined) {
      this.params.accelMode = partial.enableBvh ? "bvh" : "direct";
    }
    this.material.setParams(this.params);
    this.syncAccel();
    this.renderer.toneMappingExposure = 1;
  }

  private syncAccel() {
    const handle = this.packed?.bvh ?? null;
    const effective = resolveAccelEffective(
      this.params.accelMode,
      this.packed?.triangleCount ?? 0,
      this.params.bvhTriangleThreshold,
      Boolean(handle),
    );
    this.params.enableBvh = effective === "bvh";
    if (handle && effective === "bvh") {
      this.material.shader.setBvh(handle.uniforms, true);
    } else {
      this.material.shader.setBvh(handle?.uniforms ?? null, false);
    }
  }

  getAccelEffective(): "direct" | "bvh" {
    return resolveAccelEffective(
      this.params.accelMode,
      this.packed?.triangleCount ?? 0,
      this.params.bvhTriangleThreshold,
      Boolean(this.packed?.bvh),
    );
  }

  async loadEnvironment(url: string) {
    this.deviceDebug.setStage("hdri_fetch", "pending", `GET ${url}`);
    try {
      const head = await fetch(url, { method: "GET" });
      const buf = await head.arrayBuffer();
      this.deviceDebug.setStage(
        "hdri_fetch",
        head.ok ? "ok" : "fail",
        `HTTP ${head.status} · ${buf.byteLength} bytes · ${url}`,
      );
      if (!head.ok) {
        throw new Error(`HDRI HTTP ${head.status}`);
      }
    } catch (e) {
      this.deviceDebug.setStage(
        "hdri_fetch",
        "fail",
        e instanceof Error ? e.message : String(e),
      );
      throw e;
    }
    try {
      const handle = await this.env.load(url);
      this.material.shader.setEnvMap(handle.envMap);
      this.deviceDebug.render.envMapReady = Boolean(handle.envMap);
      const tex = handle.envMap as {
        image?: { width?: number; height?: number; data?: ArrayLike<number> };
        type?: number;
        format?: number;
        minFilter?: number;
        magFilter?: number;
      };
      const img = tex.image;
      this.deviceDebug.caps.hdriTexType = tex.type ?? null;
      this.deviceDebug.caps.hdriTexFormat = tex.format ?? null;
      this.deviceDebug.caps.hdriMinFilter = tex.minFilter ?? null;
      this.deviceDebug.caps.hdriMagFilter = tex.magFilter ?? null;
      this.deviceDebug.setStage(
        "hdri_decode",
        "ok",
        `equirect ${img?.width ?? "?"}x${img?.height ?? "?"} data=${img?.data ? "yes" : "no"} type=${String(tex.type)} fmt=${String(tex.format)}`,
      );
      try {
        this.renderer.initTexture(handle.envMap);
        const gl = this.renderer.getContext();
        const errs = drainGlErrors(gl);
        if (errs.length) {
          this.deviceDebug.setStage(
            "hdri_decode",
            "fail",
            `HDRI upload glErrors=[${errs.join(",")}]`,
          );
        }
      } catch (upErr) {
        this.deviceDebug.setStage(
          "hdri_decode",
          "fail",
          `HDRI initTexture: ${upErr instanceof Error ? upErr.message : String(upErr)}`,
        );
      }
    } catch (e) {
      this.deviceDebug.render.envMapReady = false;
      this.deviceDebug.setStage(
        "hdri_decode",
        "fail",
        e instanceof Error ? e.message : String(e),
      );
      throw e;
    }
  }

  useProceduralBrilliant() {
    this.mountProcedural("brilliant");
  }

  private mountProcedural(
    kind: "brilliant" | "high-facet" | "emerald" | "malformed",
  ) {
    const geometry =
      kind === "high-facet"
        ? createHighFacetBrilliantGeometry()
        : kind === "emerald"
          ? createEmeraldCutGeometry()
          : kind === "malformed"
            ? createMalformedGemGeometry()
            : createBrilliantCutGeometry();
    const mesh = new Mesh(geometry);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = new Vector3();
    box.getSize(size);
    const scale = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
    mesh.scale.setScalar(scale);
    mesh.updateMatrixWorld(true);

    const report = analyzeObject3D(mesh, `procedural-${kind}`);
    this.lastGeometryReport = report;
    const prim = report.primitives[0];
    const suitability = evaluateGemSuitability(prim);
    this.lastSuitability = suitability;
    this.deviceDebug.asset.suitability = suitability.status;
    this.deviceDebug.asset.selectedMesh = `procedural-${kind}`;
    this.deviceDebug.setStage(
      "suitability",
      suitability.status === "UNSUPPORTED" ? "fail" : "ok",
      `${suitability.status} · procedural-${kind} · tris=${suitability.triangleCount}`,
    );

    if (suitability.status === "UNSUPPORTED" && kind !== "malformed") {
      this.fallbackActive = true;
      this.fallbackReason = suitability.summary;
      geometry.dispose();
      throw new Error(suitability.summary);
    }

    // Malformed is loaded only to demonstrate gate — do not pack if unsupported
    if (suitability.status === "UNSUPPORTED") {
      this.fallbackActive = true;
      this.fallbackReason = suitability.summary;
      disposePackedGem(this.packed);
      this.packed = null;
      this.sourceLabel = `REJECTED:${suitability.meshName}`;
      this.loadedGlb = null;
      geometry.dispose();
      this.deviceDebug.setStage("mesh_pack", "skip", "UNSUPPORTED — not packed");
      return;
    }

    this.fallbackActive = false;
    this.fallbackReason = null;
    disposePackedGem(this.packed);
    this.packed = adaptMeshToGem(mesh, `procedural-${kind}`);
    this.sourceLabel = this.packed.sourceLabel;
    this.loadedGlb = null;
    geometry.dispose();
    this.pushTrianglesToShader();
  }

  getGeometryReport() {
    return this.lastGeometryReport;
  }

  getMeshOptions(): MeshPrimitiveReport[] {
    return this.lastGeometryReport?.primitives ?? [];
  }

  getSelectedMeshKey() {
    return this.loadedGlb?.selectedKey ?? "procedural-brilliant";
  }

  async loadGlb(url: string, label = "glb"): Promise<GlbGeometryReport> {
    this.deviceDebug.asset.url = url;
    this.deviceDebug.setStage("asset_fetch", "pending", `GET ${url}`);

    // Explicit fetch diagnostics before GLTFLoader (iPhone network / CORS)
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      this.deviceDebug.asset.httpStatus = res.status;
      this.deviceDebug.asset.bytes = ab.byteLength;
      this.deviceDebug.setStage(
        "asset_fetch",
        res.ok ? "ok" : "fail",
        `HTTP ${res.status} · ${ab.byteLength} bytes · ct=${res.headers.get("content-type") || "?"}`,
      );
      if (!res.ok) {
        throw new Error(`Asset HTTP ${res.status} for ${url}`);
      }
      if (ab.byteLength < 32) {
        this.deviceDebug.setStage(
          "asset_fetch",
          "fail",
          `Response too small (${ab.byteLength} bytes)`,
        );
        throw new Error("GLB response too small");
      }

      this.deviceDebug.setStage("glb_parse", "pending", "GLTFLoader.parse…");
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(ab, "");
      this.deviceDebug.asset.parseOk = true;
      this.deviceDebug.setStage("glb_parse", "ok", `parsed · scenes=${gltf.scenes?.length ?? 0}`);

      gltf.scene.updateMatrixWorld(true);
      const meshes: Mesh[] = [];
      gltf.scene.traverse((obj) => {
        if ((obj as Mesh).isMesh) meshes.push(obj as Mesh);
      });
      this.deviceDebug.asset.meshCount = meshes.length;
      this.deviceDebug.setStage(
        "gem_extract",
        meshes.length > 0 ? "ok" : "fail",
        `meshes=${meshes.length} · names=${meshes.map((m) => m.name || "(unnamed)").join(",")}`,
      );
      if (meshes.length === 0) throw new Error("No mesh found in GLB/GLTF.");

      const report = analyzeObject3D(gltf.scene, label);
      this.lastGeometryReport = report;

      const preferred =
        report.recommendedPrimitiveKeys[0] ||
        primitiveKey(report.primitives[0]);

      this.loadedGlb = {
        label,
        scene: gltf.scene,
        meshes,
        report,
        selectedKey: preferred,
      };

      this.selectMeshPrimitive(preferred);
      return report;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (this.deviceDebug.asset.httpStatus == null) {
        this.deviceDebug.setStage("asset_fetch", "fail", msg);
      } else if (this.deviceDebug.asset.parseOk !== true) {
        this.deviceDebug.asset.parseOk = false;
        this.deviceDebug.setStage("glb_parse", "fail", msg);
      } else {
        this.deviceDebug.setStage("gem_extract", "fail", msg);
      }
      throw e;
    }
  }

  selectMeshPrimitive(key: string) {
    if (!this.loadedGlb) {
      throw new Error("No GLB loaded — load a GLB before selecting a mesh.");
    }
    const idx = Number(key.includes("#") ? key.split("#").pop() : key);
    const mesh = this.loadedGlb.meshes[idx];
    if (!mesh) throw new Error(`Mesh primitive not found: ${key}`);

    this.deviceDebug.asset.selectedMesh = key;
    const reportPrim =
      this.loadedGlb.report.primitives.find(
        (p) => `${p.meshName}#${p.primitiveIndex}` === key,
      ) || this.loadedGlb.report.primitives[idx];
    const suitability = evaluateGemSuitability(reportPrim);
    this.lastSuitability = suitability;
    this.deviceDebug.asset.suitability = suitability.status;
    this.deviceDebug.setStage(
      "suitability",
      suitability.status === "UNSUPPORTED" ? "fail" : "ok",
      `${suitability.status} · tris=${suitability.triangleCount} · ${suitability.summary}`,
    );

    if (suitability.status === "UNSUPPORTED") {
      this.fallbackActive = true;
      this.fallbackReason = suitability.summary;
      disposePackedGem(this.packed);
      this.packed = null;
      this.sourceLabel = `REJECTED:${key}`;
      this.loadedGlb.selectedKey = key;
      this.deviceDebug.setStage("mesh_pack", "skip", "UNSUPPORTED — not packed");
      throw new Error(suitability.summary);
    }

    const view = new Mesh(mesh.geometry);
    mesh.updateWorldMatrix(true, false);
    view.position.setFromMatrixPosition(mesh.matrixWorld);
    view.quaternion.setFromRotationMatrix(mesh.matrixWorld);
    view.scale.setFromMatrixScale(mesh.matrixWorld);
    view.updateMatrixWorld(true);

    const box = new Box3().setFromObject(view);
    const size = box.getSize(new Vector3());
    const scale = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
    view.scale.multiplyScalar(scale);
    view.updateMatrixWorld(true);

    this.fallbackActive = false;
    this.fallbackReason =
      suitability.status === "SUPPORTED_WITH_WARNING"
        ? suitability.warnings[0] || suitability.summary
        : null;

    disposePackedGem(this.packed);
    this.packed = adaptMeshToGem(view, `${this.loadedGlb.label}:${key}`);
    this.sourceLabel = this.packed.sourceLabel;
    this.loadedGlb.selectedKey = key;
    this.pushTrianglesToShader();
  }

  getSuitability() {
    return this.lastSuitability;
  }

  async loadTestAsset(spec: TestAssetSpec): Promise<{
    suitability: GemSuitabilityResult | null;
    label: string;
  }> {
    if (spec.kind === "procedural") {
      this.mountProcedural(spec.procedural || "brilliant");
      return { suitability: this.lastSuitability, label: this.sourceLabel };
    }

    const id =
      Object.entries(STORAGE_ALLOWLIST).find(
        ([, v]) => v === spec.storageKey,
      )?.[0] || "jewelry";
    const url = `/api/experiments/gem-renderer/test-glb?id=${encodeURIComponent(id)}`;
    const report = await this.loadGlb(url, spec.label);
    if (spec.preferMesh) {
      const hit = report.primitives.find((p) =>
        p.meshName.toLowerCase().includes(spec.preferMesh!.toLowerCase()),
      );
      if (hit) {
        const key = `${hit.meshName}#${hit.primitiveIndex}`;
        try {
          this.selectMeshPrimitive(key);
        } catch {
          return {
            suitability: this.lastSuitability,
            label: this.sourceLabel,
          };
        }
      }
    }
    return { suitability: this.lastSuitability, label: this.sourceLabel };
  }

  getTestCatalog() {
    return TEST_ASSET_CATALOG;
  }

  async loadGlbFromFile(file: File): Promise<GlbGeometryReport> {
    const url = URL.createObjectURL(file);
    try {
      return await this.loadGlb(url, file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async tryLoadStorageJewelry(): Promise<GlbGeometryReport> {
    const candidates = [
      "/api/experiments/gem-renderer/test-glb?id=jewelry",
      "/Storage/Customers/CUS-169432/Products/PRD_AE4ZBKQY/model.glb",
    ];
    let lastErr: unknown;
    for (const url of candidates) {
      try {
        return await this.loadGlb(url, "Jewelry.glb (PRD_AE4ZBKQY)");
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Failed to load Jewelry.glb test asset");
  }

  async applyFromAr360Environment(source: Ar360EnvironmentSource) {
    await this.env.applyFromAr360(source);
    if (this.env.handle) {
      this.material.shader.setEnvMap(this.env.handle.envMap);
    }
  }

  async applyCalibration(id: CalibrationSceneId, resetMesh = true) {
    const preset = CALIBRATION_PRESETS[id];
    if (resetMesh) this.useProceduralBrilliant();
    this.setParams(cloneParams(preset.params));
    await this.loadEnvironment(preset.environmentUrl);
    this.setCameraPose(
      preset.camera.position,
      preset.camera.target,
      preset.camera.gemAngle,
    );
    this.cameraLocked = id !== "reference";
    this.controls.enabled = !this.cameraLocked;
  }

  setVisualView(id: VisualViewId, keepCurrentMesh = true) {
    const view = VISUAL_VIEWS[id];
    if (!keepCurrentMesh || !this.loadedGlb) {
      this.useProceduralBrilliant();
    }
    this.setParams({
      debugMode: "beauty",
      autoRotate: false,
    });
    this.setCameraPose(view.position, view.target, view.gemAngle);
    this.cameraLocked = true;
    this.controls.enabled = false;
  }

  applyProductionPreset(id: ProductionPresetId) {
    this.setParams({ ...PRODUCTION_PRESETS[id].params });
  }

  applyQualityTier(tier: QualityTier) {
    if (tier === "auto") {
      const size = new Vector2();
      this.renderer.getSize(size);
      const pr = this.renderer.getPixelRatio();
      const caps = probeDeviceCapabilities(
        this.renderer.getContext(),
        size.x * pr * size.y * pr,
      );
      this.gpuRenderer = caps.gpuRenderer;
      this.gpuVendor = caps.gpuVendor;
      const decision = this.autoQuality.pickInitial({
        caps,
        triangleCount: this.packed?.triangleCount ?? 0,
      });
      this.autoQuality.setEnabled(true);
      this.setParams({
        ...this.autoQuality.paramsForCurrent(),
        qualityTier: "auto",
      });
      return decision.tier;
    }
    this.autoQuality.setEnabled(false);
    this.setParams({ ...paramsForQualityTier(tier), qualityTier: tier });
    return tier;
  }

  /** 15s FPS window for physical-device testing. */
  startFpsWindow() {
    this.fpsSamples = [];
    this.fpsWindowActive = true;
  }

  stopFpsWindow() {
    this.fpsWindowActive = false;
  }

  getFpsWindowStats() {
    if (this.fpsSamples.length === 0) {
      return { min: 0, avg: 0, max: 0, samples: 0 };
    }
    let min = Infinity;
    let max = 0;
    let sum = 0;
    for (const v of this.fpsSamples) {
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
    }
    return {
      min: Math.round(min * 10) / 10,
      avg: Math.round((sum / this.fpsSamples.length) * 10) / 10,
      max: Math.round(max * 10) / 10,
      samples: this.fpsSamples.length,
    };
  }

  /**
   * Scale consistency: same geometry at 0.1× / 1× / 10× source scale,
   * then view-fit (as GemRenderer does). characteristicLength should match.
   */
  runScaleConsistencyStudy(): {
    scale: number;
    characteristicLength: number;
    triangleCount: number;
  }[] {
    const geometry = createBrilliantCutGeometry();
    const base = new Mesh(geometry);
    const rows: {
      scale: number;
      characteristicLength: number;
      triangleCount: number;
    }[] = [];
    for (const s of [0.1, 1, 10]) {
      const m = meshWithUniformScale(base, s);
      m.updateMatrixWorld(true);
      const box = new Box3().setFromObject(m);
      const size = box.getSize(new Vector3());
      const fit = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
      m.scale.multiplyScalar(fit);
      m.updateMatrixWorld(true);
      const packed = adaptMeshToGem(m, `scale-${s}`);
      rows.push({
        scale: s,
        characteristicLength:
          Math.round(packed.characteristicLength * 1000) / 1000,
        triangleCount: packed.triangleCount,
      });
      disposePackedGem(packed);
      m.geometry.dispose();
    }
    geometry.dispose();
    return rows;
  }

  setCameraPose(
    position: [number, number, number],
    target: [number, number, number],
    gemAngle: number,
  ) {
    this.camera.position.set(position[0], position[1], position[2]);
    this.controls.target.set(target[0], target[1], target[2]);
    this.controls.update();
    this.gemAngle = gemAngle;
  }

  unlockCamera() {
    this.cameraLocked = false;
    this.controls.enabled = true;
  }

  private pushTrianglesToShader() {
    if (!this.packed) return;
    const gl = this.renderer.getContext();
    drainGlErrors(gl);
    this.material.shader.setTriangles(
      this.packed.triangleTexture,
      this.packed.triangleCount,
      this.packed.boundsMin,
      this.packed.boundsMax,
      this.packed.characteristicLength,
    );
    // Force texture upload path so float RGBA errors surface now
    try {
      this.renderer.initTexture(this.packed.triangleTexture);
    } catch (e) {
      this.deviceDebug.setStage(
        "mesh_pack",
        "fail",
        `initTexture: ${e instanceof Error ? e.message : String(e)}`,
      );
      this.syncAccel();
      return;
    }
    const errs = drainGlErrors(gl);
    this.deviceDebug.render.triangleTexReady = Boolean(
      this.packed.triangleTexture,
    );
    this.deviceDebug.render.triangleCount = this.packed.triangleCount;
    this.deviceDebug.setStage(
      "mesh_pack",
      errs.length ? "fail" : "ok",
      `tris=${this.packed.triangleCount} floatTex=${this.packed.triangleTexture.type} glErrors=[${errs.join(",") || "none"}]`,
    );
    this.syncAccel();
  }

  setSize(width: number, height: number) {
    if (width < 2 || height < 2) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.resolution.set(width * pr, height * pr);
  }

  private ensureGemTarget(w: number, h: number) {
    if (
      this.gemTarget &&
      this.lastInternalSize.x === w &&
      this.lastInternalSize.y === h
    ) {
      return this.gemTarget;
    }
    this.gemTarget?.dispose();
    this.gemTarget = new WebGLRenderTarget(w, h, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.gemTarget.texture.colorSpace = SRGBColorSpace;
    this.lastInternalSize.set(w, h);
    return this.gemTarget;
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.fpsLast = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame() {
    if (!this.ready) return;
    if (this.shaderFailed) return;

    const t0 = performance.now();
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;
    if (!this.cameraLocked) this.controls.update();

    const canvas = this.renderer.domElement;
    this.deviceDebug.render.canvasCss = `${canvas.clientWidth}x${canvas.clientHeight}`;
    this.deviceDebug.render.canvasBuffer = `${canvas.width}x${canvas.height}`;

    if (!this.packed) {
      // Suitability rejection / fallback — keep page alive with clear color
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      this.frameTimeMs = performance.now() - t0;
      return;
    }

    if (this.params.autoRotate && !this.cameraLocked) {
      this.gemAngle += dt * this.params.autoRotateSpeed;
    }
    this.gemRotation.makeRotationY(this.gemAngle);
    this.invGemRotation.copy(this.gemRotation).invert();

    this.camera.updateMatrixWorld();
    this.invProjection.copy(this.camera.projectionMatrix).invert();
    this.invView.copy(this.camera.matrixWorld);

    const scale = Math.min(
      1,
      Math.max(0.25, this.params.internalResolutionScale || 1),
    );
    const fullW = Math.max(2, Math.floor(this.resolution.x));
    const fullH = Math.max(2, Math.floor(this.resolution.y));
    const iw = Math.max(2, Math.floor(fullW * scale));
    const ih = Math.max(2, Math.floor(fullH * scale));
    this.internalResVec.set(iw, ih);

    this.material.shader.setCamera(
      this.camera.position,
      this.invProjection,
      this.invView,
      this.invGemRotation,
      this.internalResVec,
    );
    this.material.shader.setTime(t);
    this.material.shader.applyParams(this.params);
    this.syncAccel();

    const gl = this.renderer.getContext();
    if (!this.firstRenderLogged) {
      this.firstRenderLogged = true;
      this.deviceDebug.render.firstRenderAt = performance.now();
      this.deviceDebug.setStage(
        "first_render",
        "ok",
        `render ${iw}x${ih} scale=${scale.toFixed(2)} env=${this.deviceDebug.render.envMapReady} tris=${this.packed.triangleCount}`,
      );
      drainGlErrors(gl);
    }

    try {
      if (scale >= 0.999) {
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.quadScene, this.quadCamera);
      } else {
        const target = this.ensureGemTarget(iw, ih);
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
        this.renderer.render(this.quadScene, this.quadCamera);
        this.renderer.setRenderTarget(null);
        this.blitMaterial.uniforms.uTex.value = target.texture;
        this.renderer.render(this.blitScene, this.quadCamera);
      }
    } catch (err) {
      this.shaderFailed = true;
      this.fallbackActive = true;
      this.fallbackReason =
        err instanceof Error ? err.message : "WebGL render failure";
      this.deviceDebug.setStage(
        "first_render",
        "fail",
        this.fallbackReason,
      );
      console.error("[GemRenderer POC V5] render failed — falling back", err);
      return;
    }

    // info.autoReset makes before/after deltas unreliable — count successful frames
    const callsThisFrame = Math.max(1, this.renderer.info.render.calls || 1);
    this.deviceDebug.render.drawCalls += 1;
    if (!this.firstDrawLogged) {
      this.firstDrawLogged = true;
      this.deviceDebug.setStage(
        "draw_calls",
        "ok",
        `frame draws=${callsThisFrame} · framesRendered=${this.deviceDebug.render.drawCalls}`,
      );
    }

    if (this.deviceDebug.render.drawCalls <= 3) {
      const postErrs = drainGlErrors(gl);
      this.deviceDebug.render.lastGlError =
        postErrs.length > 0 ? postErrs.join(", ") : "NO_ERROR";
      if (postErrs.length) {
        this.deviceDebug.setStage(
          "webgl_errors",
          "fail",
          this.deviceDebug.render.lastGlError,
        );
      }
    }

    // Pixel probe once after a couple frames (preserveDrawingBuffer=true)
    if (
      this.deviceDebug.render.drawCalls >= 2 &&
      this.deviceDebug.render.pixelCenterRGBA === "—"
    ) {
      try {
        const px = new Uint8Array(4);
        gl.readPixels(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          px,
        );
        const rgba = `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`;
        this.deviceDebug.render.pixelCenterRGBA = rgba;
        const luminous = px[0] + px[1] + px[2] > 24;
        this.deviceDebug.setStage(
          "pixel_probe",
          luminous ? "ok" : "warn",
          luminous
            ? `center ${rgba} — non-black`
            : `center ${rgba} — near-black (possible silent shader fail)`,
        );
      } catch (e) {
        this.deviceDebug.setStage(
          "pixel_probe",
          "fail",
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    this.frameTimeMs = performance.now() - t0;
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsLast >= 500) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsLast);
      this.fpsFrames = 0;
      this.fpsLast = now;
      if (this.fpsWindowActive) this.fpsSamples.push(this.fps);
      if (this.params.qualityTier === "auto") {
        const adapt = this.autoQuality.maybeAdapt(this.frameTimeMs, now);
        if (adapt) {
          this.setParams({
            ...this.autoQuality.paramsForCurrent(),
            qualityTier: "auto",
          });
        }
      }
      this.sampleTriangleTests();
      this.emitDiagnostics(iw, ih, fullW, fullH);
    }
  }

  private sampleTriangleTests() {
    try {
      const gl = this.renderer.getContext();
      const cw = Math.floor(this.resolution.x);
      const ch = Math.floor(this.resolution.y);
      if (cw < 2 || ch < 2) return;
      gl.readPixels(
        Math.floor(cw / 2),
        Math.floor(ch / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.pixelReadBuf,
      );
      this.triangleTestsPerRay = (this.pixelReadBuf[3] / 255) * 20000;
    } catch {
      const tris = this.packed?.triangleCount ?? 0;
      const bounces = qualityToMaxBounces(
        this.params.quality,
        this.params.internalBounces,
      );
      const waves = wavelengthsForParams(this.params);
      const bvh = this.getAccelEffective() === "bvh";
      this.triangleTestsPerRay = bvh
        ? Math.max(8, Math.log2(Math.max(tris, 2)) * bounces * waves * 4)
        : tris * Math.min(bounces, 8) * waves;
    }
  }

  async measureStudy(
    label: string,
    partial: Partial<GemPocParams>,
    durationMs = 900,
    visualQuality = "—",
    visualNote = "",
  ): Promise<StudyRow> {
    const prev = cloneParams(this.params);
    this.setParams({
      ...partial,
      autoRotate: false,
      debugMode: "beauty",
    });
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    let frames = 0;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 >= durationMs) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const elapsed = Math.max(performance.now() - t0, 1);
    const fps = (frames * 1000) / elapsed;
    const avgFt = elapsed / Math.max(frames, 1);
    this.sampleTriangleTests();

    const scale = Math.min(
      1,
      Math.max(0.25, this.params.internalResolutionScale || 1),
    );
    const fullW = Math.round(this.resolution.x);
    const fullH = Math.round(this.resolution.y);
    const iw = Math.max(2, Math.floor(fullW * scale));
    const ih = Math.max(2, Math.floor(fullH * scale));

    const row: StudyRow = {
      config: label,
      samplesPerPixel: samplesForParams(this.params),
      wavelengths: wavelengthsForParams(this.params),
      bounceCount: qualityToMaxBounces(
        this.params.quality,
        this.params.internalBounces,
      ),
      internalRes: Math.round(scale * 100) / 100,
      fps: Math.round(fps * 10) / 10,
      frameTimeMs: Math.round(avgFt * 100) / 100,
      triangleTestsPerRay: Math.round(this.triangleTestsPerRay),
      accelEffective: this.getAccelEffective(),
      renderWidth: iw,
      renderHeight: ih,
      visualQuality,
      visualNote,
    };

    this.setParams(prev);
    return row;
  }

  async measurePerf(
    quality: GemQualityMode,
    durationMs = 1500,
  ): Promise<PerfSampleResult> {
    const spp = quality === "high" ? 3 : quality === "low" ? 1 : 2;
    const row = await this.measureStudy(
      `quality:${quality}`,
      {
        quality,
        samplesPerPixel: spp,
        accelMode: this.params.accelMode,
        internalResolutionScale: this.params.internalResolutionScale,
        wavelengthMode: this.params.wavelengthMode,
        earlyTermination: this.params.earlyTermination,
        internalBounces: this.params.internalBounces,
      },
      durationMs,
    );
    return {
      quality,
      fps: row.fps,
      frameTimeMs: row.frameTimeMs,
      renderWidth: row.renderWidth,
      renderHeight: row.renderHeight,
      samplesPerPixel: row.samplesPerPixel,
      wavelengths: row.wavelengths,
      bounceCount: row.bounceCount,
      triangleCount: this.packed?.triangleCount ?? 0,
      bvhEnabled: row.accelEffective === "bvh",
      triangleTestsPerRay: row.triangleTestsPerRay,
      bvhNodeCount: this.packed?.bvh?.nodeCountEstimate ?? 0,
      internalResolutionScale: row.internalRes,
      accelEffective: row.accelEffective,
      label: row.config,
    };
  }

  async compareBvh(durationMs = 1000): Promise<BvhCompareResult> {
    const prev = cloneParams(this.params);
    const offRow = await this.measureStudy(
      "accel:direct",
      {
        samplesPerPixel: 2,
        quality: "medium",
        internalBounces: 12,
        wavelengthMode: "rgb3",
        accelMode: "direct",
        internalResolutionScale: 1,
      },
      durationMs,
    );
    const onRow = await this.measureStudy(
      "accel:bvh",
      {
        samplesPerPixel: 2,
        quality: "medium",
        internalBounces: 12,
        wavelengthMode: "rgb3",
        accelMode: "bvh",
        internalResolutionScale: 1,
      },
      durationMs,
    );
    this.setParams(prev);
    const toPerf = (r: StudyRow): PerfSampleResult => ({
      quality: "medium",
      fps: r.fps,
      frameTimeMs: r.frameTimeMs,
      renderWidth: r.renderWidth,
      renderHeight: r.renderHeight,
      samplesPerPixel: r.samplesPerPixel,
      wavelengths: r.wavelengths,
      bounceCount: r.bounceCount,
      triangleCount: this.packed?.triangleCount ?? 0,
      bvhEnabled: r.accelEffective === "bvh",
      triangleTestsPerRay: r.triangleTestsPerRay,
      bvhNodeCount: this.packed?.bvh?.nodeCountEstimate ?? 0,
      accelEffective: r.accelEffective,
    });
    return { off: toPerf(offRow), on: toPerf(onRow) };
  }

  async runBounceStudy(durationMs = 800): Promise<StudyRow[]> {
    const rows: StudyRow[] = [];
    this.cameraLocked = true;
    this.controls.enabled = false;
    for (const b of BOUNCE_STUDY_COUNTS) {
      const vis = bounceVisualNote(b);
      rows.push(
        await this.measureStudy(
          `bounces=${b}`,
          {
            ior: 2.417,
            dispersion: 0.25,
            absorption: [0.002, 0.002, 0.002],
            thickness: 1,
            roughness: 0.01,
            exposure: 1,
            environmentIntensity: 1,
            samplesPerPixel: 1,
            quality: "low",
            internalBounces: b,
            wavelengthMode: "rgb3",
            enableDispersion: true,
            accelMode: "auto",
            internalResolutionScale: 1,
            earlyTermination: true,
          },
          durationMs,
          vis.score,
          vis.note,
        ),
      );
    }
    return rows;
  }

  async runSppStudy(bounces = 6, durationMs = 800): Promise<StudyRow[]> {
    const rows: StudyRow[] = [];
    for (const spp of SPP_STUDY_COUNTS) {
      rows.push(
        await this.measureStudy(
          `spp=${spp} b=${bounces}`,
          {
            ior: 2.417,
            dispersion: 0.25,
            absorption: [0.002, 0.002, 0.002],
            thickness: 1,
            roughness: 0.01,
            exposure: 1,
            samplesPerPixel: spp,
            quality: spp === 1 ? "low" : spp === 2 ? "medium" : "high",
            internalBounces: bounces,
            wavelengthMode: "rgb3",
            accelMode: "auto",
            internalResolutionScale: 1,
            earlyTermination: true,
          },
          durationMs,
          spp === 1 ? "base" : spp === 2 ? "+smooth" : "+smoother",
          spp === 1
            ? "Deterministic 1 spp"
            : "Extra spp mainly anti-aliases; little new fire",
        ),
      );
    }
    return rows;
  }

  async runDispersionStudy(
    bounces = 6,
    spp = 1,
    durationMs = 800,
  ): Promise<StudyRow[]> {
    const modes: { mode: WavelengthMode; label: string; note: string }[] = [
      { mode: "off", label: "disp=OFF", note: "No chromatic fire; cheapest" },
      {
        mode: "single",
        label: "disp=single-IOR",
        note: "Same cost as OFF; no RGB split",
      },
      {
        mode: "rgb3",
        label: "disp=3λ",
        note: "Chromatic fire; ~3× wavelength traces",
      },
    ];
    const rows: StudyRow[] = [];
    for (const m of modes) {
      rows.push(
        await this.measureStudy(
          m.label,
          {
            ior: 2.417,
            dispersion: 0.25,
            absorption: [0.002, 0.002, 0.002],
            thickness: 1,
            roughness: 0.01,
            exposure: 1,
            samplesPerPixel: spp,
            quality: "low",
            internalBounces: bounces,
            wavelengthMode: m.mode,
            enableDispersion: m.mode === "rgb3",
            accelMode: "auto",
            internalResolutionScale: 1,
            earlyTermination: true,
          },
          durationMs,
          m.mode === "rgb3" ? "fire ON" : "fire OFF",
          m.note,
        ),
      );
    }
    return rows;
  }

  async runInternalResStudy(
    bounces = 6,
    spp = 1,
    durationMs = 800,
  ): Promise<StudyRow[]> {
    const rows: StudyRow[] = [];
    for (const scale of INTERNAL_RES_SCALES) {
      const pct = Math.round(scale * 100);
      rows.push(
        await this.measureStudy(
          `ires=${pct}%`,
          {
            ior: 2.417,
            dispersion: 0.25,
            absorption: [0.002, 0.002, 0.002],
            thickness: 1,
            roughness: 0.01,
            exposure: 1,
            samplesPerPixel: spp,
            quality: "low",
            internalBounces: bounces,
            wavelengthMode: "rgb3",
            accelMode: "auto",
            internalResolutionScale: scale,
            earlyTermination: true,
          },
          durationMs,
          scale >= 0.75 ? "sharp" : scale >= 0.66 ? "good" : "soft edges",
          scale < 0.66
            ? "Edge / fire soften; still readable"
            : "Acceptable for production candidate",
        ),
      );
    }
    return rows;
  }

  async runPresetSuite(durationMs = 900): Promise<StudyRow[]> {
    const rows: StudyRow[] = [];
    for (const id of [
      "mobile",
      "desktop",
      "desktop-high",
      "reference",
    ] as ProductionPresetId[]) {
      const preset = PRODUCTION_PRESETS[id];
      rows.push(
        await this.measureStudy(
          preset.label,
          { ...preset.params },
          durationMs,
          id === "reference"
            ? "9/10"
            : id === "desktop-high"
              ? "8.5/10"
              : id === "desktop"
                ? "8/10"
                : "6.5/10",
          preset.description,
        ),
      );
    }
    return rows;
  }

  private emitDiagnostics(
    iw: number,
    ih: number,
    fullW: number,
    fullH: number,
  ) {
    if (!this.onDiagnostics) return;
    const gl = this.renderer.getContext();
    const isWebGL2 =
      typeof WebGL2RenderingContext !== "undefined" &&
      gl instanceof WebGL2RenderingContext;
    const accel = this.getAccelEffective();
    const win = this.getFpsWindowStats();

    this.onDiagnostics({
      renderer: "Three.js WebGLRenderer (GemRenderer POC V5)",
      backend: isWebGL2 ? "WebGL2" : "WebGL1",
      fps: Math.round(this.fps),
      frameTimeMs: Math.round(this.frameTimeMs * 100) / 100,
      fpsMin: win.samples ? win.min : Math.round(this.fps),
      fpsAvg: win.samples ? win.avg : Math.round(this.fps),
      renderWidth: iw,
      renderHeight: ih,
      canvasWidth: fullW,
      canvasHeight: fullH,
      internalResolutionScale: this.params.internalResolutionScale,
      samplesPerPixel: samplesForParams(this.params),
      wavelengths: wavelengthsForParams(this.params),
      internalBounces: qualityToMaxBounces(
        this.params.quality,
        this.params.internalBounces,
      ),
      dispersionMode: this.material.getDispersionMode(),
      triangleCount: this.packed?.triangleCount ?? 0,
      techniqueLabel: TECHNIQUE_META.name,
      approximations: [...TECHNIQUE_META.approximated],
      characteristicLength: this.packed?.characteristicLength ?? 0,
      debugMode: this.params.debugMode,
      bvhEnabled: accel === "bvh",
      accelMode: this.params.accelMode,
      accelEffective: accel,
      triangleTestsPerRay: Math.round(this.triangleTestsPerRay),
      bvhNodeCount: this.packed?.bvh?.nodeCountEstimate ?? 0,
      qualityTier: this.params.qualityTier,
      gpuRenderer: this.gpuRenderer,
      gpuVendor: this.gpuVendor,
      suitabilityStatus: this.lastSuitability?.status ?? "n/a",
      suitabilitySummary: this.lastSuitability?.summary ?? "n/a",
      fallbackActive: this.fallbackActive,
      fallbackReason: this.fallbackReason,
    });
  }

  getTechniqueMeta() {
    return TECHNIQUE_META;
  }

  getSourceLabel() {
    return this.sourceLabel;
  }

  getCharacteristicLength() {
    return this.packed?.characteristicLength ?? 0;
  }

  isTruncated() {
    return Boolean(this.packed?.truncated);
  }

  hasBvh() {
    return Boolean(this.packed?.bvh);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.controls.dispose();
    disposePackedGem(this.packed);
    this.packed = null;
    this.gemTarget?.dispose();
    this.gemTarget = null;
    this.material.dispose();
    this.blitMaterial.dispose();
    this.env.dispose();
    this.quad.geometry.dispose();
    this.blitQuad.geometry.dispose();
    this.renderer.dispose();
  }
}
