/**
 * ModelViewer ↔ GemRenderer bridge — smallest integration boundary.
 * Uses geometry already loaded by model-viewer (no second GLB fetch).
 */
import type { MaterialSetting } from "@/components/features/editor/types";
import { analyzeObject3D } from "@/lib/gem-renderer-poc/analyzeGemGeometry";
import { GemRenderer } from "@/lib/gem-renderer-poc/GemRenderer";
import type { Ar360EnvironmentSource } from "@/lib/gem-renderer-poc/gemHdriContract";
import {
  applyIntegrationMaterialParams,
  applyIntegrationQualityShell,
  resolveIntegrationExposure,
} from "./integrationPipeline";
import type { Mesh } from "three";
import { isGemRendererIntegrationEnabled } from "./featureFlags";
import { globalAssetLoadQueue } from "./assetLoadQueue";
import { BoundedResourceCache } from "./boundedResourceCache";
import { getViewerThreeCamera } from "./gemCameraSync";
import {
  analyzeGemCandidatesFromGlbScene,
  pickPrimaryGemCandidate,
} from "./gemDetection";
import {
  buildGemUiRendererDiagnostic,
  formatGemContractSummary,
  materialSettingGemSignature,
  resolvePrimaryGemMaterialSetting,
  shouldUseGemRendererForSetting,
} from "./gemMaterialSync";
import { findSceneMeshByKey } from "./sceneMeshLookup";
import type { ActiveProductKey, GemBridgeState, GemCandidateMesh } from "./types";

export type GemBridgeAttachInput = {
  viewer: HTMLElement;
  scene: import("three").Object3D;
  canvas: HTMLCanvasElement;
  productKey: ActiveProductKey;
  gemMeshHints?: string[];
  materialNames?: string[];
  environment: Ar360EnvironmentSource;
  /** Material UI — primary gem slot drives GemRenderer eligibility + params. */
  allMaterialSettings?: Record<number, MaterialSetting>;
};

type SessionEntry = {
  renderer: GemRenderer;
  candidates: GemCandidateMesh[];
  primaryKey: string;
  primaryMeshName: string;
  hiddenMeshes: Array<{ mesh: Mesh; wasVisible: boolean }>;
  cameraSyncOk: boolean;
  packedOk: boolean;
  scene: import("three").Object3D;
  syncOkFrames: number;
  syncMissFrames: number;
  viewer: HTMLElement;
  environment: Ar360EnvironmentSource;
  materialSig: string;
  gemRendererActive: boolean;
  dispose: () => void;
};

type PreparedAttach = {
  input: GemBridgeAttachInput;
  candidates: GemCandidateMesh[];
  primaryKey: string;
};

const sessionCache = new BoundedResourceCache<SessionEntry>({
  maxWarmEntries: 1,
  maxWarmBytes: 128 * 1024 * 1024,
});

const preparedAttachByKey = new Map<string, PreparedAttach>();

let activeKey: ActiveProductKey | null = null;
let activeSession: SessionEntry | null = null;
let lastAttachInput: GemBridgeAttachInput | null = null;
let bridgeState: GemBridgeState = { mode: "idle", phase: "idle" };
let rafId = 0;
let beforeRenderHandler: ((() => void) | null) = null;
const listeners = new Set<(s: GemBridgeState) => void>();

function cacheKey(k: ActiveProductKey) {
  return `${k.productId}::${k.modelUrl}`;
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(bridgeState);
    } catch {
      /* ignore */
    }
  }
}

function applyQualityShell(gem: GemRenderer) {
  applyIntegrationQualityShell(gem);
}

function applyMaterialParamsToRenderer(
  gem: GemRenderer,
  setting: Partial<MaterialSetting>,
  env: Ar360EnvironmentSource,
) {
  applyIntegrationMaterialParams(gem, setting, env);
}

function publishActiveState(session: SessionEntry, productId: string) {
  bridgeState = {
    mode: "active",
    phase: "active",
    productId,
    candidates: session.candidates,
    primaryKey: session.primaryKey,
    primaryMeshName: session.primaryMeshName,
    cameraSyncOk: session.cameraSyncOk,
  };
  emit();
}

function publishFallbackState(productId: string, reason: string) {
  bridgeState = { mode: "fallback", phase: "fallback", productId, reason };
  emit();
}

function fallbackSessionToPbr(
  session: SessionEntry,
  productId: string,
  reason: string,
) {
  restoreHiddenMeshes(session);
  session.cameraSyncOk = false;
  session.gemRendererActive = false;
  disposeSessionEntry(session);
  if (activeSession === session) activeSession = null;
  publishFallbackState(productId, reason);
}

function stopRenderLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (beforeRenderHandler && activeSession?.viewer) {
    try {
      activeSession.viewer.removeEventListener("before-render", beforeRenderHandler);
    } catch {
      /* ignore */
    }
  }
  beforeRenderHandler = null;
  activeSession?.renderer.stop();
}

function syncSessionTransforms(session: SessionEntry, viewer: HTMLElement) {
  const cam = getViewerThreeCamera(viewer);
  const mesh = findSceneMeshByKey(session.scene, session.primaryKey);
  if (cam) session.renderer.syncExternalCamera(cam);
  if (mesh) session.renderer.syncExternalGemMesh(mesh);
}

function startRenderLoop(
  viewer: HTMLElement,
  session: SessionEntry,
  productId: string,
) {
  if (!session.gemRendererActive || !session.packedOk) return;
  stopRenderLoop();
  session.syncOkFrames = 0;
  session.syncMissFrames = 0;
  session.cameraSyncOk = false;
  session.renderer.start();
  const tick = () => {
    if (activeSession !== session || !session.gemRendererActive) return;
    syncSessionTransforms(session, viewer);
    if (getViewerThreeCamera(viewer)) {
      session.syncMissFrames = 0;
      session.syncOkFrames++;
      if (!session.cameraSyncOk && session.syncOkFrames >= 1) {
        session.cameraSyncOk = true;
        publishActiveState(session, productId);
      }
    } else {
      session.syncOkFrames = 0;
      session.syncMissFrames++;
      if (session.syncMissFrames > 120) {
        fallbackSessionToPbr(
          session,
          productId,
          "Camera sync failed — using PBR fallback",
        );
        return;
      }
    }
    const canvas = session.renderer.getDomElement();
    if (canvas?.parentElement) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 1 && h > 1) session.renderer.setSize(w, h);
    }
    rafId = requestAnimationFrame(tick);
  };

  beforeRenderHandler = () => {
    if (activeSession !== session || !session.gemRendererActive) return;
    syncSessionTransforms(session, viewer);
  };
  try {
    viewer.addEventListener("before-render", beforeRenderHandler);
  } catch {
    /* ignore */
  }

  rafId = requestAnimationFrame(tick);
}

function hideGemMeshes(session: SessionEntry, scene: import("three").Object3D, primaryKey: string) {
  session.hiddenMeshes = [];
  const primary = findSceneMeshByKey(scene, primaryKey);
  if (primary) {
    session.hiddenMeshes.push({ mesh: primary, wasVisible: primary.visible });
    primary.visible = false;
  }
}

function restoreHiddenMeshes(session: SessionEntry) {
  for (const { mesh, wasVisible } of session.hiddenMeshes) {
    mesh.visible = wasVisible;
  }
  session.hiddenMeshes = [];
}

function disposeSessionEntry(entry: SessionEntry) {
  restoreHiddenMeshes(entry);
  stopRenderLoop();
  try {
    entry.renderer.dispose();
  } catch {
    /* ignore */
  }
}

function pauseGemRendererSession(reason: string) {
  if (!activeSession || !activeKey) {
    if (activeKey) publishFallbackState(activeKey.productId, reason);
    return;
  }
  restoreHiddenMeshes(activeSession);
  stopRenderLoop();
  activeSession.cameraSyncOk = false;
  activeSession.gemRendererActive = false;
  publishFallbackState(activeKey.productId, reason);
}

async function createGemRendererSession(
  input: GemBridgeAttachInput,
  candidates: GemCandidateMesh[],
  primaryKey: string,
  materialSetting: Partial<MaterialSetting>,
): Promise<SessionEntry | null> {
  const primary = candidates.find((c) => c.meshKey === primaryKey);
  if (!primary) return null;

  const sourceMesh = findSceneMeshByKey(input.scene, primaryKey);
  if (!sourceMesh) return null;

  const report = analyzeObject3D(input.scene, input.productKey.productId);
  const reportPrim =
    report.primitives.find(
      (p) => `${p.meshName}#${p.primitiveIndex}` === primaryKey,
    ) ?? report.primitives[0];

  const gem = new GemRenderer({
    canvas: input.canvas,
    integration: true,
  });

  await gem.prepareForIntegration(input.environment.url);
  await gem.applyFromAr360Environment(input.environment);

  try {
    gem.packFromSceneMesh(
      sourceMesh,
      primaryKey,
      input.productKey.productId,
      reportPrim,
    );
  } catch {
    gem.dispose();
    return null;
  }

  applyQualityShell(gem);
  applyMaterialParamsToRenderer(gem, materialSetting, input.environment);

  const session: SessionEntry = {
    renderer: gem,
    candidates,
    primaryKey,
    primaryMeshName: primary?.meshName ?? primaryKey,
    hiddenMeshes: [],
    cameraSyncOk: false,
    packedOk: true,
    scene: input.scene,
    syncOkFrames: 0,
    syncMissFrames: 0,
    viewer: input.viewer,
    environment: input.environment,
    materialSig: materialSettingGemSignature(materialSetting),
    gemRendererActive: true,
    dispose: () => disposeSessionEntry(session),
  };

  hideGemMeshes(session, input.scene, primaryKey);

  return session;
}

function resumeExistingSession(session: SessionEntry, productId: string) {
  session.gemRendererActive = true;
  session.packedOk = true;
  activeSession = session;
  hideGemMeshes(session, session.scene, session.primaryKey);
  startRenderLoop(session.viewer, session, productId);
  bridgeState = {
    mode: "loading",
    phase: "loading",
    productId,
  };
  emit();
}

export function subscribeGemBridge(fn: (s: GemBridgeState) => void) {
  listeners.add(fn);
  fn(bridgeState);
  return () => {
    listeners.delete(fn);
  };
}

export function getGemBridgeState() {
  return bridgeState;
}

export function isGemRendererActiveForProduct(productId?: string) {
  return isGemRendererOverlayReady(productId);
}

/** True when overlay camera is synced and gem mesh is replaced. */
export function isGemRendererOverlayReady(productId?: string) {
  if (bridgeState.mode !== "active" || !bridgeState.cameraSyncOk) return false;
  if (!productId) return true;
  return bridgeState.productId === productId;
}

/** Primary gem slot — used to skip PBR approx when GemRenderer owns the stone. */
export function getGemPrimaryMaterialIndex(): number | null {
  if (
    bridgeState.mode === "idle" ||
    bridgeState.mode === "error" ||
    bridgeState.mode === "fallback"
  ) {
    return null;
  }

  let candidates: GemCandidateMesh[] | undefined;
  let primaryKey: string | undefined;

  if (bridgeState.mode === "active") {
    candidates = bridgeState.candidates;
    primaryKey = bridgeState.primaryKey;
  } else if (bridgeState.mode === "loading" && activeKey) {
    const prepared = preparedAttachByKey.get(cacheKey(activeKey));
    candidates = activeSession?.candidates ?? prepared?.candidates;
    primaryKey = activeSession?.primaryKey ?? prepared?.primaryKey;
  }

  if (!candidates?.length || !primaryKey) return null;
  const hit = candidates.find((c) => c.meshKey === primaryKey);
  return hit?.materialIndex ?? null;
}

/** Skip legacy PBR gem optical approx on primary gem mesh slot while GemRenderer is active. */
export function shouldSkipPbrGemForMaterialSlot(
  materialIndex: number,
  setting: Partial<MaterialSetting> | null | undefined,
): boolean {
  if (!isGemRendererIntegrationEnabled()) return false;
  if (!shouldUseGemRendererForSetting(setting)) return false;
  if (bridgeState.mode !== "active" && bridgeState.mode !== "loading") return false;
  const primary = getGemPrimaryMaterialIndex();
  if (primary != null) return primary === materialIndex;
  return false;
}

/** @deprecated Mesh-level hide is authoritative — do not skip whole material slot apply. */
export function shouldDeferGemSlotToRenderer(
  materialIndex: number,
  setting: Partial<MaterialSetting> | null | undefined,
): boolean {
  return shouldSkipPbrGemForMaterialSlot(materialIndex, setting);
}

export function isGemPrimaryMeshHidden(): boolean {
  return Boolean(activeSession?.hiddenMeshes.length && activeSession.gemRendererActive);
}

export function getGemIntegrationDebugOverlay() {
  const setting = activeSession
    ? resolvePrimaryGemMaterialSetting(
        lastAttachInput?.allMaterialSettings,
        activeSession.candidates,
        activeSession.primaryKey,
      )
    : null;
  const env = activeSession?.environment ?? lastAttachInput?.environment ?? null;
  const phase = bridgeState.phase ?? "idle";
  const triCount = activeSession?.candidates.find(
    (c) => c.meshKey === activeSession.primaryKey,
  )?.suitability.triangleCount;
  return {
    phase,
    gemMode:
      bridgeState.mode === "active" && activeSession?.gemRendererActive
        ? "GEM ACTIVE"
        : bridgeState.mode === "loading"
          ? "GEM SESSION LOADING"
          : bridgeState.mode === "fallback"
            ? "GEM FALLBACK"
            : bridgeState.mode === "error"
              ? "GEM ERROR"
              : isGemRendererIntegrationEnabled()
                ? preparedAttachByKey.size > 0
                  ? "GEM DETECTED"
                  : "GEM OFF"
                : "GEM OFF",
    gemType: setting?.gemstoneType ?? "—",
    gemMesh: activeSession?.primaryKey ?? "—",
    gemMeshName: activeSession?.primaryMeshName ?? "—",
    triangleCount: triCount ?? "—",
    materialName:
      activeSession?.candidates.find((c) => c.meshKey === activeSession?.primaryKey)
        ?.materialIndex != null
        ? String(
            lastAttachInput?.materialNames?.[
              activeSession.candidates.find((c) => c.meshKey === activeSession!.primaryKey)!
                .materialIndex!
            ] ?? "—",
          )
        : "—",
    gemContract: formatGemContractSummary(setting),
    gemRendererActive: Boolean(activeSession?.gemRendererActive),
    originalMeshHidden: isGemPrimaryMeshHidden(),
    cameraSyncOk: Boolean(activeSession?.cameraSyncOk),
    environmentSynced: env?.url ?? "—",
    environmentIntensity: env?.intensity ?? null,
    environmentExposure: env?.exposure ?? null,
    qualityTier: activeSession?.renderer.getParams?.()?.qualityTier ?? "—",
    cacheEntries: sessionCache.stats().size,
    queuePending: globalAssetLoadQueue.getStats().pending,
    queueActive: globalAssetLoadQueue.getStats().active,
  };
}

export function deactivateGemProduct(productId?: string) {
  if (productId) globalAssetLoadQueue.cancelForProduct(productId);
  const pin = activeKey ? cacheKey(activeKey) : null;
  sessionCache.disposeAllExcept(pin);
  if (activeSession && (!productId || activeKey?.productId === productId)) {
    restoreHiddenMeshes(activeSession);
    stopRenderLoop();
    activeSession = null;
  }
  if (!productId || activeKey?.productId === productId) {
    if (activeKey) preparedAttachByKey.delete(cacheKey(activeKey));
    bridgeState = { mode: "idle", phase: "idle" };
    activeKey = null;
    lastAttachInput = null;
    emit();
  }
}

export function disposeAllGemSessions() {
  sessionCache.disposeAllExcept(null);
  preparedAttachByKey.clear();
  if (activeSession) {
    restoreHiddenMeshes(activeSession);
    activeSession = null;
  }
  stopRenderLoop();
  activeKey = null;
  lastAttachInput = null;
  bridgeState = { mode: "idle", phase: "idle" };
  emit();
}

/**
 * Live Material UI → GemRenderer sync. No GLB re-fetch; reuses cached session.
 */
export async function syncGemMaterialFromSettings(
  allMaterialSettings: Record<number, MaterialSetting> | undefined,
): Promise<void> {
  if (!activeKey || !lastAttachInput) return;

  lastAttachInput = { ...lastAttachInput, allMaterialSettings };
  const ck = cacheKey(activeKey);
  const prepared = preparedAttachByKey.get(ck);
  const candidates = activeSession?.candidates ?? prepared?.candidates;
  const primaryKey = activeSession?.primaryKey ?? prepared?.primaryKey;
  if (!candidates?.length || !primaryKey) return;

  const setting = resolvePrimaryGemMaterialSetting(
    allMaterialSettings,
    candidates,
    primaryKey,
  );

  if (!shouldUseGemRendererForSetting(setting)) {
    pauseGemRendererSession(
      setting?.type === "standard"
        ? "Standard material — PBR path"
        : "Unsupported gem material configuration",
    );
    return;
  }

  const sig = materialSettingGemSignature(setting);
  const env = lastAttachInput.environment;

  if (activeSession?.renderer && activeSession.gemRendererActive) {
    if (activeSession.materialSig !== sig) {
      applyMaterialParamsToRenderer(activeSession.renderer, setting!, env);
      activeSession.materialSig = sig;
    }
    return;
  }

  const cached = sessionCache.get(ck);
  if (cached?.renderer) {
    applyMaterialParamsToRenderer(cached.renderer, setting!, env);
    cached.materialSig = sig;
    cached.gemRendererActive = true;
    cached.scene = lastAttachInput.scene;
    cached.viewer = lastAttachInput.viewer;
    cached.environment = lastAttachInput.environment;
    activeSession = cached;
    resumeExistingSession(cached, activeKey.productId);
    return;
  }

  if (!prepared) return;

  bridgeState = { mode: "loading", phase: "loading", productId: activeKey.productId };
  emit();

  try {
    const entry = await globalAssetLoadQueue.enqueue(
      activeKey.productId,
      "gem-bridge-activate",
      90,
      async (signal) => {
        if (signal.aborted) throw new DOMException("aborted", "AbortError");
        return createGemRendererSession(
          { ...prepared.input, allMaterialSettings },
          candidates,
          primaryKey,
          setting!,
        );
      },
    );

    if (!entry) {
      publishFallbackState(activeKey.productId, "Gem mesh unsuitable for GemRenderer");
      return;
    }

    sessionCache.set(ck, activeKey.productId, entry, 32 * 1024 * 1024);
    activeSession = entry;
    startRenderLoop(lastAttachInput.viewer, entry, activeKey.productId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("aborted")) {
      bridgeState = {
        mode: "error",
        phase: "error",
        productId: activeKey.productId,
        message: msg,
      };
      emit();
    }
  }
}

/**
 * Attach GemRenderer overlay to an already-loaded ModelViewer scene.
 * Queued — respects heavy-asset concurrency limits.
 */
export async function attachGemBridge(
  input: GemBridgeAttachInput,
): Promise<GemBridgeState> {
  activeKey = input.productKey;
  lastAttachInput = input;
  const ck = cacheKey(input.productKey);
  sessionCache.pinActive(ck);

  const candidates = analyzeGemCandidatesFromGlbScene(
    input.scene,
    input.productKey.productId,
    {
      gemMeshHints: input.gemMeshHints,
      materialNames: input.materialNames,
    },
  );
  const primary = pickPrimaryGemCandidate(candidates);

  if (!primary) {
    bridgeState = {
      mode: "fallback",
      phase: "fallback",
      productId: input.productKey.productId,
      reason: "No supported gemstone mesh",
    };
    emit();
    return bridgeState;
  }

  preparedAttachByKey.set(ck, {
    input,
    candidates,
    primaryKey: primary.meshKey,
  });

  bridgeState = {
    mode: "loading",
    phase: "loading",
    productId: input.productKey.productId,
  };
  emit();

  const materialSetting = resolvePrimaryGemMaterialSetting(
    input.allMaterialSettings,
    candidates,
    primary.meshKey,
  );

  if (!shouldUseGemRendererForSetting(materialSetting)) {
    bridgeState = {
      mode: "fallback",
      phase: "fallback",
      productId: input.productKey.productId,
      reason: "Primary gem slot is not a gemstone material",
    };
    emit();
    return bridgeState;
  }

  const cached = sessionCache.get(ck);
  if (cached) {
    cached.scene = input.scene;
    cached.viewer = input.viewer;
    cached.environment = input.environment;
    applyMaterialParamsToRenderer(cached.renderer, materialSetting!, input.environment);
    cached.materialSig = materialSettingGemSignature(materialSetting);
    cached.gemRendererActive = true;
    activeSession = cached;
    hideGemMeshes(cached, input.scene, cached.primaryKey);
    startRenderLoop(input.viewer, cached, input.productKey.productId);
    return bridgeState;
  }

  try {
    const entry = await globalAssetLoadQueue.enqueue(
      input.productKey.productId,
      "gem-bridge-init",
      100,
      async (signal) => {
        if (signal.aborted) throw new DOMException("aborted", "AbortError");
        return createGemRendererSession(
          input,
          candidates,
          primary.meshKey,
          materialSetting!,
        );
      },
    );

    if (!entry) {
      bridgeState = {
        mode: "fallback",
        phase: "fallback",
        productId: input.productKey.productId,
        reason: "No supported gemstone mesh",
      };
      emit();
      return bridgeState;
    }

    sessionCache.set(ck, input.productKey.productId, entry, 32 * 1024 * 1024);
    activeSession = entry;
    startRenderLoop(input.viewer, entry, input.productKey.productId);
    return bridgeState;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("aborted") || msg.includes("Abort")) {
      bridgeState = { mode: "idle", phase: "idle" };
    } else {
      bridgeState = {
        mode: "error",
        phase: "error",
        productId: input.productKey.productId,
        message: msg,
      };
    }
    emit();
    return bridgeState;
  }
}

/** Update HDRI when editor changes environment — active product only. */
export async function syncGemEnvironment(env: Ar360EnvironmentSource) {
  if (!activeSession?.renderer || !activeSession.gemRendererActive) return;
  activeSession.environment = env;
  if (lastAttachInput) lastAttachInput = { ...lastAttachInput, environment: env };
  const setting = resolvePrimaryGemMaterialSetting(
    lastAttachInput?.allMaterialSettings,
    activeSession.candidates,
    activeSession.primaryKey,
  );
  try {
    await activeSession.renderer.applyFromAr360Environment(env);
    if (setting) {
      applyMaterialParamsToRenderer(activeSession.renderer, setting, env);
    } else {
      activeSession.renderer.setParams({
        environmentIntensity: 1,
        environmentRotation: env.rotationRadians,
        exposure: resolveIntegrationExposure(env),
      });
    }
  } catch {
    /* fallback — keep PBR visible underneath */
  }
}

export function getGemIntegrationDiagnostics() {
  const setting = activeSession
    ? resolvePrimaryGemMaterialSetting(
        lastAttachInput?.allMaterialSettings,
        activeSession.candidates,
        activeSession.primaryKey,
      )
    : null;
  return {
    bridgeState,
    cacheEntries: sessionCache.stats().size,
    queuePending: globalAssetLoadQueue.getStats().pending,
    queueActive: globalAssetLoadQueue.getStats().active,
    warmProductId: sessionCache.stats().pinned,
    uiRenderer: buildGemUiRendererDiagnostic(
      setting,
      isGemRendererOverlayReady(),
      Boolean(activeSession?.gemRendererActive),
    ),
    overlay: getGemIntegrationDebugOverlay(),
  };
}

/** Dev diagnostic: GEM UI → RENDERER */
export function getGemUiRendererDiagnostic() {
  if (!activeSession) return buildGemUiRendererDiagnostic(null, false, false);
  const setting = resolvePrimaryGemMaterialSetting(
    lastAttachInput?.allMaterialSettings,
    activeSession.candidates,
    activeSession.primaryKey,
  );
  return buildGemUiRendererDiagnostic(
    setting,
    isGemRendererOverlayReady(),
    Boolean(activeSession?.gemRendererActive),
  );
}

/** Test hook — count active GemRenderer instances. */
export function __gemBridgeTestGetActiveRendererCount(): number {
  return activeSession?.renderer && activeSession.gemRendererActive ? 1 : 0;
}

/** Test hook — whether attach prepared context without second fetch. */
export function __gemBridgeTestHasPreparedAttach(productKey: ActiveProductKey): boolean {
  return preparedAttachByKey.has(cacheKey(productKey));
}
