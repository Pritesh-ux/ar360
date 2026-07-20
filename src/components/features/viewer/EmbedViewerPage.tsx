"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Box, Lock } from "lucide-react";
import ModelViewer from "@/components/shared/ModelViewer";
import { getProductModelSrc } from "@/lib/modelSource";
import {
  checkViewerAccess,
  getActiveViewerSettings,
  resolveEnvironmentImage,
  type VariantConfig,
  type ViewerProduct as UniversalViewerProduct,
} from "@/lib/universal-viewer";
import { usePublicViewerProduct } from "@/lib/user-panel/public-viewer";
import { getActiveVariant } from "./viewer-utils";
import type { ViewerProduct } from "./types";

function asUniversalViewerProduct(product: ViewerProduct): UniversalViewerProduct {
  return {
    ...product,
    id: product.id || product.productUid || product.publicId || "",
  } as UniversalViewerProduct;
}

export default function EmbedViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id);
  const passwordParam = searchParams.get("p") || "";

  const { product, loading, error } = usePublicViewerProduct(id, {
    source: "embed",
    trackEvent: "open_embed",
    retries: 3,
  });

  const [activeVariant, setActiveVariant] = useState<VariantConfig | null>(null);
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);

  useEffect(() => {
    if (!product) return;
    if (product.sharePassword && passwordParam === product.sharePassword) {
      setPasswordUnlocked(true);
    }
    const variant = getActiveVariant(product);
    setActiveVariant(variant as VariantConfig | null);
  }, [product, passwordParam]);

  const access = useMemo(
    () =>
      product
        ? checkViewerAccess(asUniversalViewerProduct(product), { passwordUnlocked })
        : ({ ok: false, reason: "not-found" } as const),
    [product, passwordUnlocked],
  );

  useEffect(() => {
    if (!product || access.ok === false) return;
    const key = "ar360_embed_sess";
    const sessionId = sessionStorage.getItem(key) || `embed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(key, sessionId);
    let referrerDomain = "";
    try {
      referrerDomain = document.referrer ? new URL(document.referrer).hostname : "";
    } catch {
      referrerDomain = "";
    }
    void fetch("/api/embed/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.productUid || product.id || id,
        sessionId,
        referrerDomain,
      }),
    });
  }, [product, access.ok, id]);

  if (loading) {
    return (
      <main className="grid h-screen w-screen place-items-center bg-white">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-[var(--ar-surface-soft,#f1f5f9)]" />
      </main>
    );
  }

  if (error) {
    const isTemporarilyUnavailable = error.includes("temporarily unavailable");
    return (
      <EmbedState
        title={isTemporarilyUnavailable ? "Unavailable" : "Access expired"}
        message={error}
      />
    );
  }

  if (!product) {
    return <EmbedState title="Product not found" message="This embedded product does not exist." />;
  }

  if (product.allowEmbed === false) {
    return <EmbedState title="Embed disabled" message="Embedding has been disabled for this product." />;
  }

  if (access.ok === false && access.reason === "password") {
    return (
      <EmbedState
        icon={<Lock size={34} />}
        title="Password protected"
        message="Open the public viewer and enter the password to view this product."
      />
    );
  }

  if (access.ok === false && access.reason === "expired") {
    return <EmbedState title="Link expired" message="This viewer link is no longer active." />;
  }

  if (access.ok === false) {
    return <EmbedState title="Not available" message="This product is private or unpublished." />;
  }

  const settings = getActiveViewerSettings(asUniversalViewerProduct(product), activeVariant);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-white">
      <ModelViewer
        src={getProductModelSrc(product)}
        poster={settings.poster || product.poster}
        exposure={settings.exposure}
        toneMapping="commerce"
        environmentImage={resolveEnvironmentImage(settings.environmentImage)}
        skyboxImage={
          settings.environmentImage &&
          settings.environmentImage !== "default" &&
          !settings.environmentImage.startsWith("blob:")
            ? settings.environmentImage
            : undefined
        }
        backgroundColor={settings.backgroundColor}
        transparent={settings.transparent}
        shadowIntensity={settings.shadowIntensity}
        shadowSoftness={settings.shadowSoftness}
        autoRotate={settings.autoRotate}
        cameraControls={settings.cameraControls}
        showArButton={settings.showArButton}
        interactionPrompt={settings.interactionPrompt}
        autoPlay={settings.autoPlay}
        fov={settings.fov}
        arPlacement={
          (settings as { arPlacement?: string }).arPlacement === "wall" ? "wall" : "floor"
        }
        allMaterialSettings={settings.materialSettings}
        logoDecals={product.logoDecals || []}
      />

      {(product.brandLogo || product.brandLogoUrl || product.brandName) && (
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-[var(--ar-border,#e2e8f0)] bg-white/90 px-3 py-2 shadow-lg backdrop-blur-xl">
          {(product.brandLogo || product.brandLogoUrl) && (
            <img
              src={product.brandLogo || product.brandLogoUrl}
              alt="Brand"
              className="h-6 w-6 rounded-full object-contain"
            />
          )}
          <span className="text-xs font-black text-slate-700">
            {product.brandName || (product.removeBranding ? "3D Viewer" : "AR360 Studio")}
          </span>
        </div>
      )}
      {!product.removeBranding ? (
        <p className="pointer-events-none absolute bottom-3 right-4 z-20 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Powered by AR360
        </p>
      ) : null}
    </main>
  );
}

function EmbedState({ title, message, icon }: { title: string; message: string; icon?: ReactNode }) {
  return (
    <main className="grid h-screen w-screen place-items-center bg-white p-6 text-slate-950">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[var(--ar-border,#e2e8f0)] bg-[var(--ar-surface-soft,#f8fafc)] text-slate-300">
          {icon || <Box size={34} />}
        </div>
        <h1 className="mt-4 text-2xl font-black">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">{message}</p>
      </div>
    </main>
  );
}
