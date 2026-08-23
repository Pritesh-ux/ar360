/**
 * ModelViewer ↔ GemRenderer bridge — smallest integration boundary.
 * Uses geometry already loaded by model-viewer (no second GLB fetch).
 */
import { analyzeObject3D } from "@/lib/gem-renderer-poc/analyzeGemGeometry";
import { GemRenderer } from "@/lib/gem-renderer-poc/GemRenderer";
import {
  QUALITY_DESKTOP_MEDIUM,
  QUALITY_MOBILE_LOW,
  splitContractsFromLegacy,
} from "@/lib/gem-renderer-poc/gemMaterialContract";
import type { Ar360EnvironmentSource } from "@/lib/gem-renderer-poc/gemHdriContract";
import { probeDeviceCapabilities } from "@/lib/gem-renderer-poc/deviceCapabilities";
import { paramsForQualityTier } from "@/lib/gem-renderer-poc/qualityPresets";
import type { Mesh } from "three";
import { globalAssetLoadQueue } from "./assetLoadQueue";
import { BoundedResourceCache } from "./boundedResourceCache";
import { getViewerThreeCamera } from "./gemCameraSync";
import {
  analyzeGemCandidatesFromGlbScene,
  pickPrimaryGemCandidate,
} from "./gemDetection";
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
};

type SessionEntry = {
  renderer: GemRenderer;
  candidates: GemCandidateMesh[];
  primaryKey: string;
  hiddenMeshes: Array<{ mesh: Mesh; wasVisible: boolean }>;
  overlayReady: boolean;
  scene: import("three").Object3D;
  syncOkFrames: number;
  syncMissFrames: number;
  dispose: () => void;
};

const sessionCache = new BoundedResourceCache<SessionEntry>({
  maxWarmEntries: 1,
  maxWarmBytes: 128 * 1024 * 1024,
});

let activeKey: ActiveProductKey | null = null;
let activeSession: SessionEntry | null = null;
let bridgeState: GemBridgeState = { mode: "idle" };
let rafId = 0;
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

function pickQualityTier() {
  if (typeof window === "undefined") return "medium" as const;
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (mobile) return "low" as const;
  const caps = probeDeviceCapabilities(null, window.innerWidth * window.innerHeight);
  if (caps.hardwareConcurrency <= 4 || (caps.deviceMemoryGb != null && caps.deviceMemoryGb <= 4)) {
    return "low" as const;
  }
  return "medium" as const;
}

function applyProductionQuality(gem: GemRenderer, exposure?: number) {
  const tier = pickQualityTier();
  gem.applyQualityTier(tier === "low" ? "low" : "medium");
  const contracts = tier === "low" ? QUALITY_MOBILE_LOW : QUALITY_DESKTOP_MEDIUM;
  const exp = typeof exposure === "number" && Number.isFinite(exposure) ? exposure : 1;
  gem.setParams({
    ...paramsForQualityTier(tier === "low" ? "low" : "medium"),
    ...splitContractsFromLegacy({
      ior: 2.417,
      dispersion: 0.25,
      absorption: [0.002, 0.002, 0.002],
      thickness: 1,
      roughness: 0.01,
      samplesPerPixel: contracts.samplesPerPixel,
      wavelengthMode: contracts.wavelengthMode,
      internalBounces: contracts.internalBounces,
      internalResolutionScale: contracts.internalResolutionScale,
      accelMode: contracts.accelMode,
      earlyTermination: contracts.earlyTermination,
      qualityTier: contracts.qualityTier,
      environmentIntensity: 1,
      environmentRotation: 0,
      exposure: exp,
    }).quality,
    autoRotate: false,
    debugMode: "beauty",
  });
}

function publishGemState(session: SessionEntry, productId: string) {
  bridgeState = {
    mode: "gem",
    productId,
    candidates: session.candidates,
    primaryKey: session.primaryKey,
    overlayReady: session.overlayReady,
  };
  emit();
}

function fallbackSessionToPbr(
  session: SessionEntry,
  productId: string,
  reason: string,
) {
  restoreHiddenMeshes(session);
  session.overlayReady = false;
  disposeSessionEntry(session);
  if (activeSession === session) activeSession = null;
  bridgeState = { mode: "pbr", productId, reason };
  emit();
}

function stopRenderLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  activeSession?.renderer.stop();
}

function startRenderLoop(
  viewer: HTMLElement,
  session: SessionEntry,
  productId: string,
) {
  stopRenderLoop();
  session.syncOkFrames = 0;
  session.syncMissFrames = 0;
  session.overlayReady = false;
  session.renderer.start();
  const tick = () => {
    if (activeSession !== session) return;
    const cam = getViewerThreeCamera(viewer);
    if (cam) {
      session.syncMissFrames = 0;
      session.syncOkFrames++;
      session.renderer.syncExternalCamera(cam);
      if (!session.overlayReady && session.syncOkFrames >= 3) {
        session.overlayReady = true;
        hideGemMeshes(session, session.scene, session.primaryKey);
        publishGemState(session, productId);
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

/** True only when overlay camera is synced and gem mesh is actually replaced. */
export function isGemRendererOverlayReady(productId?: string) {
  if (bridgeState.mode !== "gem" || !bridgeState.overlayReady) return false;
  if (!productId) return true;
  return bridgeState.productId === productId;
}

export function getGemIntegrationDiagnostics() {
  return {
    bridgeState,
    cacheEntries: sessionCache.stats().size,
    queuePending: globalAssetLoadQueue.getStats().pending,
    queueActive: globalAssetLoadQueue.getStats().active,
    warmProductId: sessionCache.stats().pinned,
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
    bridgeState = { mode: "idle" };
    activeKey = null;
    emit();
  }
}

export function disposeAllGemSessions() {
  sessionCache.disposeAllExcept(null);
  if (activeSession) {
    restoreHiddenMeshes(activeSession);
    activeSession = null;
  }
  stopRenderLoop();
  activeKey = null;
  bridgeState = { mode: "idle" };
  emit();
}

/**
 * Attach GemRenderer overlay to an already-loaded ModelViewer scene.
 * Queued — respects heavy-asset concurrency limits.
 */
export async function attachGemBridge(
  input: GemBridgeAttachInput,
): Promise<GemBridgeState> {
  activeKey = input.productKey;
  const ck = cacheKey(input.productKey);
  sessionCache.pinActive(ck);

  const cached = sessionCache.get(ck);
  if (cached) {
    activeSession = cached;
    cached.scene = input.scene;
    startRenderLoop(input.viewer, cached, input.productKey.productId);
    bridgeState = {
      mode: "gem",
      productId: input.productKey.productId,
      candidates: cached.candidates,
      primaryKey: cached.primaryKey,
      overlayReady: cached.overlayReady,
    };
    emit();
    return bridgeState;
  }

  bridgeState = { mode: "loading", productId: input.productKey.productId };
  emit();

  try {
    const entry = await globalAssetLoadQueue.enqueue(
      input.productKey.productId,
      "gem-bridge-init",
      100,
      async (signal) => {
        if (signal.aborted) throw new DOMException("aborted", "AbortError");

        const report = analyzeObject3D(input.scene, input.productKey.productId);
        const candidates = analyzeGemCandidatesFromGlbScene(
          input.scene,
          input.productKey.productId,
          {
            gemMeshHints: input.gemMeshHints,
            materialNames: input.materialNames,
          },
        );

        const primary = pickPrimaryGemCandidate(candidates);
        if (!primary) return null;

        const sourceMesh = findSceneMeshByKey(input.scene, primary.meshKey);
        if (!sourceMesh) return null;

        const reportPrim =
          report.primitives.find(
            (p) => `${p.meshName}#${p.primitiveIndex}` === primary.meshKey,
          ) ?? report.primitives[0];

        const gem = new GemRenderer({
          canvas: input.canvas,
          integration: true,
        });

        await gem.prepareForIntegration(input.environment.url);
        if (signal.aborted) {
          gem.dispose();
          throw new DOMException("aborted", "AbortError");
        }

        await gem.applyFromAr360Environment(input.environment);
        applyProductionQuality(gem, input.environment.exposure);

        try {
          gem.packFromSceneMesh(
            sourceMesh,
            primary.meshKey,
            input.productKey.productId,
            reportPrim,
          );
        } catch {
          gem.dispose();
          return null;
        }

        const session: SessionEntry = {
          renderer: gem,
          candidates,
          primaryKey: primary.meshKey,
          hiddenMeshes: [],
          overlayReady: false,
          scene: input.scene,
          syncOkFrames: 0,
          syncMissFrames: 0,
          dispose: () => disposeSessionEntry(session),
        };

        return session;
      },
    );

    if (!entry) {
      bridgeState = {
        mode: "pbr",
        productId: input.productKey.productId,
        reason: "No supported gemstone mesh",
      };
      emit();
      return bridgeState;
    }

    sessionCache.set(ck, input.productKey.productId, entry, 32 * 1024 * 1024);
    activeSession = entry;
    startRenderLoop(input.viewer, entry, input.productKey.productId);

    bridgeState = {
      mode: "gem",
      productId: input.productKey.productId,
      candidates: entry.candidates,
      primaryKey: entry.primaryKey,
      overlayReady: false,
    };
    emit();
    return bridgeState;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("aborted") || msg.includes("Abort")) {
      bridgeState = { mode: "idle" };
    } else {
      bridgeState = {
        mode: "error",
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
  if (!activeSession) return;
  try {
    await activeSession.renderer.applyFromAr360Environment(env);
  } catch {
    /* fallback — keep PBR visible underneath */
  }
}
