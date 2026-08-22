"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import ViewerBrandMark from "@/components/features/viewer/ViewerBrandMark";
import { useParams, useSearchParams } from "next/navigation";
import { Box, Lock, Smartphone } from "lucide-react";
import dynamic from "next/dynamic";
const ModelViewer = dynamic(() => import("@/components/shared/ModelViewer"), { ssr: false });
import ARExperienceProButton from "@/components/features/ar/ARExperienceProButton";
import StudioLookArCamera, {
  stopMediaStream,
} from "@/components/features/ar/StudioLookArCamera";
import {
  checkViewerAccess,
  type VariantConfig,
  type ViewerProduct as UniversalViewerProduct,
} from "@/lib/universal-viewer";
import { usePublicViewerProduct } from "@/lib/user-panel/public-viewer";
import { buildWhatsAppHref } from "@/lib/viewer-contact/whatsapp";
import EnquireModal from "@/components/features/viewer/EnquireModal";
import { trackAnalyticsEvent } from "@/lib/analytics/track-event";
import PoweredByAr360 from "@/components/brand/PoweredByAr360";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import { getActiveVariant } from "./viewer-utils";
import { buildViewerRuntimeModelProps } from "./viewer-runtime";
import { fitProductCamera } from "./fit-product-camera";
import { viewerBrandStyle } from "@/lib/branding/contrast";
import type { ViewerProduct } from "./types";

function asUniversalViewerProduct(product: ViewerProduct): UniversalViewerProduct {
  return {
    ...product,
    id: product.id || product.productUid || product.publicId || "",
  } as UniversalViewerProduct;
}

function usePreferMobileArLite() {
  const [preferLite, setPreferLite] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px), (pointer: coarse)");
    const sync = () => setPreferLite(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return preferLite;
}

export default function EmbedViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id);
  const passwordParam = searchParams.get("p") || "";
  const clientUid = String(searchParams.get("client") || "").trim();

  const { product, loading, error } = usePublicViewerProduct(id, {
    source: "embed",
    trackEvent: "open_embed",
    retries: 3,
    clientUid: clientUid || null,
  });

  const viewerRef = useRef<any>(null);
  const studioArStreamRef = useRef<MediaStream | null>(null);
  const [activeVariant, setActiveVariant] = useState<VariantConfig | null>(null);
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);
  const [enquireOpen, setEnquireOpen] = useState(false);
  const [studioLookAr, setStudioLookAr] = useState(false);
  const [studioArStream, setStudioArStream] = useState<MediaStream | null>(null);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const preferMobileArLite = usePreferMobileArLite();

  useDeferredEffect(() => {
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

  const runtimeProps = useMemo(() => {
    if (!product) return null;
    return buildViewerRuntimeModelProps(product, {
      mode: "embed",
      variantId: activeVariant?.id || product.activeVariantId,
      preferArLite: preferMobileArLite,
    });
  }, [product, activeVariant, preferMobileArLite]);

  useEffect(() => {
    studioArStreamRef.current = studioArStream;
  }, [studioArStream]);

  useEffect(() => {
    return () => {
      stopMediaStream(studioArStreamRef.current);
      studioArStreamRef.current = null;
    };
  }, []);

  function enterStudioLookAr(stream?: MediaStream) {
    setStudioArStream(stream ?? null);
    setStudioLookAr(true);
  }

  function exitStudioLookAr() {
    setStudioLookAr(false);
    setStudioArStream((prev) => {
      stopMediaStream(prev);
      return null;
    });
  }

  useEffect(() => {
    if (!product || access.ok === false) return;
    const key = "ar360_embed_sess";
    const sessionId =
      sessionStorage.getItem(key) ||
      `embed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
      <UserWorkspaceLoading
        mode="screen"
        label="Loading Embed"
        hint="Please wait while we prepare the embed viewer..."
        withRecovery={false}
      />
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

  if (!runtimeProps) {
    return <EmbedState title="Not available" message="Viewer settings could not be resolved." />;
  }

  const ctaHref = runtimeProps.ctaEnabled
    ? resolveCtaHref(
        runtimeProps.ctaType,
        runtimeProps.ctaUrl,
        product?.title || "this product",
        String(product?.productUid || product?.id || id),
        typeof window !== "undefined" ? window.location.href : "",
      )
    : "";
  const contact = product.viewerContact;
  const enquireEnabled = Boolean(contact?.enquireEnabled);
  const whatsappHref =
    contact?.whatsappEnabled && contact.whatsappNumber
      ? buildWhatsAppHref({
          number: contact.whatsappNumber,
          productTitle: product.title || "this product",
          productId: String(product.productUid || product.id || id),
          viewerUrl: typeof window !== "undefined" ? window.location.href : "",
        })
      : null;
  const arEnabled = product.allowAr !== false;
  const viewerUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `/embed/${encodeURIComponent(id)}`;

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-white"
      style={{
        ...(viewerBrandStyle(product.enterpriseBrandColor, product.enterpriseAccentColor) as CSSProperties),
        backgroundColor: studioLookAr ? "transparent" : undefined,
      }}
    >
      {studioLookAr ? (
        <StudioLookArCamera
          active
          stream={studioArStream}
          onExit={exitStudioLookAr}
          onCameraError={(message) => {
            setCameraNotice(message || "Camera access failed.");
            exitStudioLookAr();
            window.setTimeout(() => setCameraNotice(null), 3200);
          }}
        />
      ) : null}

      <div
        className={studioLookAr ? "absolute inset-0 z-[2] bg-transparent" : "h-full w-full"}
        style={studioLookAr ? { background: "transparent" } : undefined}
      >
        <ModelViewer
          ref={viewerRef}
          src={runtimeProps.src}
          poster={runtimeProps.poster}
          exposure={runtimeProps.exposure}
          environmentTint={runtimeProps.environmentTint}
          environmentSaturation={runtimeProps.environmentSaturation}
          toneMapping={runtimeProps.toneMapping}
          environmentImage={runtimeProps.environmentImage}
          skyboxImage={studioLookAr ? undefined : runtimeProps.skyboxImage}
          backgroundColor={studioLookAr ? "transparent" : runtimeProps.backgroundColor}
          transparent={studioLookAr || runtimeProps.transparent}
          shadowIntensity={runtimeProps.shadowIntensity}
          shadowSoftness={runtimeProps.shadowSoftness}
          autoRotate={runtimeProps.autoRotate}
          cameraControls={runtimeProps.cameraControls}
          showArButton={false}
          interactionPrompt={runtimeProps.interactionPrompt}
          autoPlay={runtimeProps.autoPlay}
          fov={runtimeProps.fov}
          cameraOrbit={runtimeProps.cameraOrbit}
          cameraTarget={runtimeProps.cameraTarget}
          disableTap
          arPlacement={runtimeProps.arPlacement}
          allMaterialSettings={runtimeProps.allMaterialSettings}
          logoDecals={runtimeProps.logoDecals}
          hotspots={runtimeProps.hotspots}
          onModelReady={() => {
            void fitProductCamera({
              viewer: viewerRef.current,
              cameraOrbit: runtimeProps.cameraOrbit,
              cameraTarget: runtimeProps.cameraTarget,
              fieldOfView: runtimeProps.fov,
              forceAutoFit: true,
              fitPadding: 1.16,
              reason: "ready",
            });
          }}
        />
      </div>

      {(product.brandLogo || product.brandLogoUrl || product.brandName) && !studioLookAr ? (
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-[var(--ar-border,#e2e8f0)] bg-white/90 px-3 py-2 shadow-lg backdrop-blur-xl">
          {(product.brandLogo || product.brandLogoUrl) && (
            <ViewerBrandMark
              src={product.brandLogo || product.brandLogoUrl}
              size={24}
              design={product.logoDesign}
            />
          )}
          <span className="text-xs font-black text-slate-700">
            {product.brandName ||
              (product.removeBranding ? "3D Viewer" : product.poweredByLabel || "AR360 Studio")}
          </span>
        </div>
      ) : null}

      {arEnabled && !studioLookAr ? (
        <div className="absolute right-4 top-4 z-20">
          <ARExperienceProButton
            product={{
              id: product.id || id,
              productUid: product.productUid || id,
              title: product.title,
              modelUrl: runtimeProps.src,
              arModelUrl: product.arModelUrl,
              usdzUrl: product.usdzUrl,
              modelBytes: product.modelBytes,
              poster: product.poster,
              realScale: product.realScale,
              arPlacement: runtimeProps.arPlacement,
              arModelScale:
                typeof product.arModelScale === "number" ? product.arModelScale : null,
            }}
            viewerRef={viewerRef}
            viewerUrl={viewerUrl}
            onStudioLookAr={enterStudioLookAr}
            className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-white shadow-lg transition active:scale-[0.96]"
            brandLogoUrl={product.brandLogo || product.brandLogoUrl || undefined}
            brandColor={product.enterpriseBrandColor}
            brandAccentColor={product.enterpriseAccentColor}
          >
            <Smartphone size={18} />
          </ARExperienceProButton>
        </div>
      ) : null}

      {cameraNotice ? (
        <div className="absolute left-1/2 top-4 z-30 max-w-[min(92vw,360px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-950 shadow-lg">
          {cameraNotice}
        </div>
      ) : null}

      {(ctaHref || enquireEnabled || whatsappHref) && !studioLookAr ? (
        <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2">
          {enquireEnabled ? (
            <button
              type="button"
              onClick={() => {
                trackAnalyticsEvent({
                  event: "enquiry_open",
                  productUid: String(product.productUid || product.id || id),
                });
                setEnquireOpen(true);
              }}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-lg"
            >
              {contact?.enquireLabel || "Enquire"}
            </button>
          ) : null}
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackAnalyticsEvent({
                  event: "whatsapp_click",
                  productUid: String(product.productUid || product.id || id),
                })
              }
              className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-black text-white shadow-lg"
            >
              {contact?.whatsappLabel || "WhatsApp"}
            </a>
          ) : null}
          {ctaHref ? (
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[var(--ar-primary,#0f172a)] px-4 py-2 text-sm font-black text-[var(--ar-on-primary,#fff)] shadow-lg"
            >
              {runtimeProps.ctaLabel}
            </a>
          ) : null}
        </div>
      ) : null}

      <EnquireModal
        open={enquireOpen}
        productTitle={product.title || "this product"}
        onClose={() => setEnquireOpen(false)}
        onSubmit={async (input) => {
          const res = await fetch("/api/product-enquiries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: product.productUid || product.id || id,
              clientUid: clientUid || undefined,
              viewerUrl: typeof window !== "undefined" ? window.location.href : "",
              ...input,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(String(data.error || "Could not send enquiry."));
          trackAnalyticsEvent({
            event: "enquiry_submit",
            productUid: String(product.productUid || product.id || id),
          });
        }}
      />

      {!product.removeBranding && !studioLookAr ? (
        <div className="pointer-events-none absolute bottom-3 right-4 z-20 text-slate-400">
          <PoweredByAr360 tone="light" className="text-slate-400" label={product.poweredByLabel} />
        </div>
      ) : null}
    </main>
  );
}

function resolveCtaHref(
  type: string | undefined,
  url: string,
  productTitle: string,
  productId: string,
  viewerUrl: string,
): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (type === "whatsapp") {
    return (
      buildWhatsAppHref({
        number: raw,
        productTitle,
        productId,
        viewerUrl,
      }) || ""
    );
  }
  if (type === "tel" || type === "contact_seller") {
    if (raw.startsWith("tel:")) return raw;
    const digits = raw.replace(/[^\d+]/g, "");
    return digits ? `tel:${digits}` : raw;
  }
  if (type === "mailto") {
    return raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
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
