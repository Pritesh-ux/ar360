"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  attachGemBridge,
  buildAr360EnvironmentSource,
  deactivateGemProduct,
  getGemIntegrationDebugOverlay,
  getGemUiRendererDiagnostic,
  isGemRendererIntegrationEnabled,
  subscribeGemBridge,
} from "@/lib/gem-integration";
import { isGemRendererDebugOverlayEnabled } from "@/lib/gem-integration/featureFlags";
import type { MaterialSetting } from "@/components/features/editor/types";
import type { ActiveProductKey, GemBridgeState } from "@/lib/gem-integration/types";

type Props = {
  viewer: HTMLElement | null;
  scene: import("three").Object3D | null;
  productId?: string;
  variantId?: string;
  modelUrl?: string;
  gemMeshHints?: string[];
  materialNames?: string[];
  environmentImage?: string;
  exposure?: number;
  environmentRotation?: number;
  enabled?: boolean;
  allMaterialSettings?: Record<number, MaterialSetting>;
};

function getViewerThreeScene(viewer: unknown): import("three").Object3D | null {
  if (!viewer || typeof viewer !== "object") return null;
  try {
    const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
      (symbol) => symbol.description === "scene",
    );
    return sceneSymbol
      ? ((viewer as Record<symbol, unknown>)[sceneSymbol] as import("three").Object3D) ??
          null
      : null;
  } catch {
    return null;
  }
}

function overlayVisibleForState(state: GemBridgeState): boolean {
  return state.mode === "active" && state.cameraSyncOk;
}

export default function GemRendererOverlay({
  viewer,
  scene: sceneProp,
  productId,
  variantId,
  modelUrl,
  gemMeshHints,
  materialNames,
  environmentImage,
  exposure,
  environmentRotation,
  enabled = true,
  allMaterialSettings,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAttachRef = useRef("");
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [bridgeState, setBridgeState] = useState<GemBridgeState>({ mode: "idle", phase: "idle" });
  const [devDiag, setDevDiag] = useState<ReturnType<typeof getGemUiRendererDiagnostic> | null>(
    null,
  );
  const [integrationDebug, setIntegrationDebug] = useState(
    getGemIntegrationDebugOverlay(),
  );

  const gemEnvironment = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    return buildAr360EnvironmentSource({
      environmentImage,
      exposure,
      environmentRotation,
      origin,
      intensity: 1,
    });
  }, [environmentImage, exposure, environmentRotation]);

  useEffect(() => {
    if (!enabled || !isGemRendererIntegrationEnabled()) return;
    return subscribeGemBridge((state) => {
      setBridgeState(state);
      setOverlayVisible(
        overlayVisibleForState(state) &&
          (!productId || (state.mode === "active" && state.productId === productId)),
      );
      setDevDiag(getGemUiRendererDiagnostic());
      setIntegrationDebug(getGemIntegrationDebugOverlay());
    });
  }, [enabled, productId]);

  useEffect(() => {
    if (!enabled || !isGemRendererIntegrationEnabled()) return;
    if (!viewer || !canvasRef.current || !productId || !modelUrl) return;

    const scene = sceneProp ?? getViewerThreeScene(viewer);
    if (!scene) return;
    const loaded = (viewer as { loaded?: boolean }).loaded;
    if (!loaded) return;

    const hintSig = (gemMeshHints || []).join("|");
    const attachKey = `${productId}::${variantId || ""}::${modelUrl}::${hintSig}`;
    if (lastAttachRef.current === attachKey) return;
    lastAttachRef.current = attachKey;
    setOverlayVisible(false);

    const productKey: ActiveProductKey = {
      productId,
      variantId,
      modelUrl,
    };

    void attachGemBridge({
      viewer,
      scene,
      canvas: canvasRef.current,
      productKey,
      gemMeshHints,
      materialNames,
      allMaterialSettings,
      environment: gemEnvironment,
    });

    return () => {
      deactivateGemProduct(productId);
      lastAttachRef.current = "";
      setOverlayVisible(false);
    };
  }, [
    enabled,
    viewer,
    sceneProp,
    productId,
    variantId,
    modelUrl,
    gemMeshHints,
    materialNames,
    gemEnvironment,
    allMaterialSettings,
  ]);

  if (!enabled || !isGemRendererIntegrationEnabled()) return null;

  const showDebug = isGemRendererDebugOverlayEnabled();

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        style={{
          background: "transparent",
          opacity: overlayVisible ? 1 : 0,
          visibility: overlayVisible ? "visible" : "hidden",
        }}
      />
      {showDebug ? (
        <div
          className="pointer-events-none absolute bottom-2 left-2 z-[2] max-w-[280px] rounded border border-emerald-800/60 bg-black/80 p-2 font-mono text-[10px] leading-snug text-emerald-100 shadow-lg"
          aria-hidden
        >
          <div className="mb-1 font-semibold text-emerald-300">V5 DIAG · Integration</div>
          <div>state: {integrationDebug.gemMode}</div>
          <div>phase: {integrationDebug.phase}</div>
          <div>mesh: {integrationDebug.gemMeshName} ({integrationDebug.gemMesh})</div>
          <div>tris: {String(integrationDebug.triangleCount)}</div>
          <div>material: {integrationDebug.materialName}</div>
          <div>gem type: {integrationDebug.gemType}</div>
          <div>contract: {integrationDebug.gemContract}</div>
          <div>renderer active: {String(integrationDebug.gemRendererActive)}</div>
          <div>mesh hidden: {String(integrationDebug.originalMeshHidden)}</div>
          <div>camera sync: {String(integrationDebug.cameraSyncOk)}</div>
          <div>environment: {integrationDebug.environmentSynced}</div>
          <div>quality: {String(integrationDebug.qualityTier)}</div>
          <div>cache: {integrationDebug.cacheEntries} q:{integrationDebug.queuePending}/{integrationDebug.queueActive}</div>
          {devDiag ? (
            <div className="mt-1 border-t border-emerald-900/60 pt-1 text-lime-300">
              UI→RENDERER · {devDiag.rendererMode}
              <br />
              IOR {devDiag.ior} · disp {devDiag.dispersion}
              <br />
              abs {devDiag.absorption} · thick {devDiag.thickness}
              <br />
              rough {devDiag.roughness}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
