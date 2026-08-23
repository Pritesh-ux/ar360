"use client";

import { useEffect, useRef, useState } from "react";
import {
  attachGemBridge,
  buildAr360EnvironmentSource,
  deactivateGemProduct,
  isGemRendererIntegrationEnabled,
  subscribeGemBridge,
} from "@/lib/gem-integration";
import type { ActiveProductKey } from "@/lib/gem-integration/types";

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
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAttachRef = useRef("");
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !isGemRendererIntegrationEnabled()) return;
    return subscribeGemBridge((state) => {
      setOverlayVisible(
        state.mode === "gem" &&
          state.overlayReady === true &&
          (!productId || state.productId === productId),
      );
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

    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
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
      environment: buildAr360EnvironmentSource({
        environmentImage,
        exposure,
        environmentRotation,
        origin,
      }),
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
    environmentImage,
    exposure,
    environmentRotation,
  ]);

  if (!enabled || !isGemRendererIntegrationEnabled()) return null;

  return (
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
  );
}
