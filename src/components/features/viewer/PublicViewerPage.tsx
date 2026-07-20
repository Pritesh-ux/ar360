"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, forwardRef, type CSSProperties } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Download,
  Maximize2,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Info,
  MoreVertical,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import ARExperienceProButton from "@/components/features/ar/ARExperienceProButton";
import MobileProductLanding from "@/components/features/viewer/MobileProductLanding";
import { getProductModelSrc } from "@/lib/modelSource";
import { trackAnalyticsEvent } from "@/lib/analytics/track-event";
import { usePublicViewerProduct } from "@/lib/user-panel/public-viewer";
import { DetailRow } from "./DetailRow";
import type { Notice } from "./types";
import {
  copyToClipboard,
  getActiveVariant,
  getLogo,
  getViewerSettings,
  normalizeViewerAssetUrl,
  resolveEnvironmentImage,
} from "./viewer-utils";
import { checkViewerAccess, needsPassword, type ViewerProduct as UniversalViewerProduct } from "@/lib/universal-viewer";

const ModelViewerImport = dynamic(() => import("@/components/shared/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/88 px-5 py-3 text-sm font-black text-slate-500 shadow-xl backdrop-blur-xl">
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--ar-primary)]" />
      Loading 3D viewer...
    </div>
  ),
});

const ModelViewer = forwardRef<any, any>((props, ref) => (
  <ModelViewerImport {...props} forwardedRef={ref} />
));
ModelViewer.displayName = "ModelViewer";

function viewerFontFamily(font?: string) {
  if (font === "sans") return 'var(--font-auth-body), "Instrument Sans", system-ui, sans-serif';
  if (font === "serif") return 'Georgia, "Times New Roman", serif';
  if (font === "display") return 'var(--font-auth-display), Outfit, system-ui, sans-serif';
  return "system-ui, -apple-system, Segoe UI, sans-serif";
}

function headerChromeClass(style?: string, dark?: boolean) {
  if (style === "solid") {
    return dark
      ? "border-white/10 bg-[#1C1F22]"
      : "border-slate-200/90 bg-white";
  }
  if (style === "minimal") {
    return "border-transparent bg-transparent shadow-none backdrop-blur-none";
  }
  return dark
    ? "border-white/15 bg-white/10 backdrop-blur-xl"
    : "border-white/70 bg-white/90 backdrop-blur-xl";
}

function brandButtonClass(style?: string) {
  if (style === "outline") {
    return "border-2 border-[var(--ar-primary)] bg-transparent text-slate-950 hover:bg-[var(--ar-primary-soft)]";
  }
  if (style === "soft") {
    return "border border-transparent bg-[var(--ar-primary-soft)] text-slate-950 hover:bg-[var(--ar-primary)]";
  }
  return "border border-transparent bg-[var(--ar-primary)] text-slate-950 hover:bg-[var(--ar-primary-hover)]";
}

export default function PublicViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id || "");

  const viewerRef = useRef<any>(null);
  const viewerShellRef = useRef<HTMLElement | null>(null);
  const cameraFitTimerRef = useRef<number | null>(null);
  const source = searchParams.get("source") || "direct";
  const { product, loading, error: entitlementError } = usePublicViewerProduct(id, {
    source,
    trackEvent: "viewer_open",
    retries: 2,
  });
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [modelRetryKey, setModelRetryKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [stage, setStage] = useState<"landing" | "viewer">("viewer");
  const [pendingAR, setPendingAR] = useState(false);

  const autoOpenAR =
    pendingAR ||
    searchParams.get("openAR") === "1" ||
    searchParams.get("ar") === "1" ||
    searchParams.get("mode") === "ar";

  useEffect(() => {
    const fromQr =
      searchParams.get("source") === "qr" ||
      searchParams.get("landing") === "1" ||
      searchParams.get("qr") === "1";
    if (fromQr) {
      setStage("landing");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!product || !autoOpenAR || !modelReady || stage !== "viewer") return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>("[data-ar-pro-launch]")?.click();
      setPendingAR(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [product, autoOpenAR, modelReady, stage]);

  const viewerAccessProduct = useMemo((): UniversalViewerProduct | null => {
    if (!product) return null;
    return { ...product, id: product.id || product.productUid || id } as UniversalViewerProduct;
  }, [product, id]);

  useEffect(() => {
    if (!viewerAccessProduct) return;
    const access = checkViewerAccess(viewerAccessProduct, { passwordUnlocked });
    if (!access.ok) {
      if (access.reason === "password") return;
      setAccessDenied(
        access.reason === "expired"
          ? "This share link has expired."
          : access.reason === "unpublished"
            ? "This product is not published."
            : "Product not found.",
      );
      return;
    }
    setAccessDenied(null);
  }, [viewerAccessProduct, passwordUnlocked]);

  useEffect(() => {
    setModelReady(false);
    setModelError(false);
  }, [id]);

  const settings = useMemo(() => getViewerSettings(product), [product]);
  const activeVariant = useMemo(() => getActiveVariant(product), [product]);
  const modelSrc = getProductModelSrc(product);
  const modelIdentity = `${product?.productUid || product?.id || id}-${activeVariant?.id || "default"}`;
  const logo = getLogo(product);

  useEffect(() => {
    const href = product?.faviconUrl || product?.brandLogoUrl || product?.brandLogo || logo;
    if (!href || typeof document === "undefined") return;
    let link = document.querySelector<HTMLLinkElement>("link[data-ar360-brand-favicon]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-ar360-brand-favicon", "1");
      document.head.appendChild(link);
    }
    link.href = href;
  }, [product?.faviconUrl, product?.brandLogoUrl, product?.brandLogo, logo]);

  const viewerUrl = useMemo(() => {
    if (typeof window === "undefined") return `/viewer/${id}`;
    return `${window.location.origin}/viewer/${id}`;
  }, [id]);

  function showNotice(type: Notice["type"], message: string) {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 2600);
  }

  const ctaLabel = useMemo(() => {
    if (!settings.ctaEnabled || !settings.ctaUrl) return "";
    if (settings.ctaLabel?.trim()) return settings.ctaLabel.trim();
    const defaults: Record<string, string> = {
      buy_now: "Buy Now",
      visit_website: "Visit Website",
      whatsapp: "WhatsApp",
      contact_seller: "Contact Seller",
      request_quote: "Request Quote",
    };
    return defaults[settings.ctaType || "visit_website"] || "Learn More";
  }, [settings]);

  function handleCtaClick() {
    if (!settings.ctaUrl || !product) return;
    trackAnalyticsEvent({
      event: "cta_click",
      productUid: product.productUid || product.id || id,
      meta: { ctaType: settings.ctaType || "visit_website", trafficSource: source },
    });
    window.open(settings.ctaUrl, "_blank", "noopener,noreferrer");
  }

  async function copyShareLink() {
    await copyToClipboard(viewerUrl);
    showNotice("success", "Share link copied");
    trackAnalyticsEvent({ event: "copy_link", productUid: product?.productUid || product?.id || id });
  }

  async function nativeShare() {
    if (!product) return;
    if (navigator.share) {
      await navigator.share({
        title: product.title || "3D Product",
        text: product.description || "View this product in 3D / AR",
        url: viewerUrl,
      });
      trackAnalyticsEvent({ event: "share_native", productUid: product.productUid || product.id || id });
      return;
    }
    await copyShareLink();
  }

  async function takeScreenshot() {
    const viewer = viewerRef.current;
    if (!viewer?.toDataURL) {
      showNotice("error", "Screenshot is not ready yet");
      return;
    }

    try {
      await viewer.updateComplete;
      const dataUrl = await viewer.toDataURL("image/png");
      const fileName = `${product?.title || "ar-product"}-screenshot.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: product?.title || "3D Screenshot" });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        link.click();
      }

      showNotice("success", "Screenshot saved");
      trackAnalyticsEvent({ event: "screenshot", productUid: product?.productUid || product?.id || id });
    } catch {
      showNotice("error", "Screenshot failed. Try again after model loads.");
    }
  }

  async function fitViewerCamera(reason: "ready" | "resize" | "reset" | "retry" = "ready") {
    const viewer = viewerRef.current;
    if (!viewer?.loaded) return;

    try {
      const isMobileViewport = typeof window !== "undefined" && window.innerWidth < 640;
      const zoomFactor = (settings.initialZoom || 100) / 100;

      if (settings.cameraTarget) {
        viewer.cameraTarget = settings.cameraTarget;
      } else {
        const center = viewer.getBoundingBoxCenter?.();
        if (center && Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z)) {
          viewer.cameraTarget = `${center.x}m ${center.y}m ${center.z}m`;
        } else {
          viewer.cameraTarget = "auto auto auto";
        }
      }

      if (settings.cameraOrbit) {
        viewer.cameraOrbit = settings.cameraOrbit;
      } else {
        const dimensions = viewer.getDimensions?.();
        const maxDimension = dimensions
          ? Math.max(Number(dimensions.x || 0), Number(dimensions.y || 0), Number(dimensions.z || 0))
          : 0;
        const desktopRadius = maxDimension > 3 ? 205 : maxDimension > 1.6 ? 185 : 165;
        const mobileRadius = maxDimension > 3 ? 320 : maxDimension > 1.6 ? 290 : 255;
        const radius = (isMobileViewport ? mobileRadius : desktopRadius) / zoomFactor;
        viewer.cameraOrbit = `35deg 65deg ${reason === "reset" ? (isMobileViewport ? 285 : 175) / zoomFactor : radius}%`;
      }

      viewer.fieldOfView = `${isMobileViewport ? Math.min(Number(settings.fov || 38), 32) : settings.fov || 38}deg`;
      viewer.updateFraming?.();
      viewer.jumpCameraToGoal?.();
    } catch (error) {
      console.warn("Viewer camera fit failed", error);
    }
  }

  function scheduleCameraFit(reason: "ready" | "resize" | "reset" | "retry" = "ready", delay = 80) {
    if (cameraFitTimerRef.current) window.clearTimeout(cameraFitTimerRef.current);
    cameraFitTimerRef.current = window.setTimeout(() => {
      void fitViewerCamera(reason);
    }, delay);
  }

  function retryModelLoad() {
    setModelReady(false);
    setModelError(false);
    setModelRetryKey((value) => value + 1);
    showNotice("info", "Retrying 3D model...");
    scheduleCameraFit("retry", 650);
  }

  async function resetCamera() {
    await fitViewerCamera("reset");
    showNotice("success", "Camera centered");
  }

  async function openFullscreenViewer() {
    const target = viewerShellRef.current || document.documentElement;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await target.requestFullscreen?.();
        setIsFullscreen(true);
      }
      scheduleCameraFit("resize", 180);
    } catch {
      showNotice("error", "Fullscreen is not available in this browser");
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
      scheduleCameraFit("resize", 180);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!product || !modelSrc || modelReady || modelError || loading) return;

    const timer = window.setTimeout(() => {
      if (!modelReady) {
        setModelError(true);
        showNotice("error", "3D model is taking too long. Try reload.");
      }
    }, 14000);

    return () => window.clearTimeout(timer);
  }, [product, modelSrc, modelReady, modelError, loading, modelRetryKey]);

  useEffect(() => {
    if (!modelReady) return;

    scheduleCameraFit("ready", 120);

    const target = viewerShellRef.current;
    let observer: ResizeObserver | null = null;

    if (target && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => scheduleCameraFit("resize", 120));
      observer.observe(target);
    }

    const handleViewportChange = () => scheduleCameraFit("resize", 160);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelReady, modelIdentity]);

  const darkTheme = product?.customViewerTheme === "dark";
  const headerClass = headerChromeClass(product?.headerStyle, darkTheme);
  const buttonClass = brandButtonClass(product?.buttonStyle);

  return (
    <main
      data-viewer-page
      data-viewer-theme={product?.customViewerTheme || "default"}
      data-header-style={product?.headerStyle || "glass"}
      data-button-style={product?.buttonStyle || "filled"}
      className={`fixed inset-0 overflow-hidden text-slate-950 [touch-action:manipulation] z-0 ${
        darkTheme ? "bg-[#111318] text-white" : "bg-[#fbfcfb]"
      }`}
      style={
        {
          fontFamily: viewerFontFamily(product?.viewerFont),
          "--ar-primary": product?.enterpriseBrandColor || "#B8FF3C",
          "--ar-primary-hover":
            product?.enterpriseAccentColor || product?.enterpriseBrandColor || "#84D400",
          "--ar-primary-soft": product?.enterpriseBrandColor
            ? `color-mix(in srgb, ${product.enterpriseBrandColor} 14%, white)`
            : "#F3FFD7",
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            product?.customViewerTheme === "dark"
              ? "linear-gradient(180deg, #111318 0%, #17191D 52%, #0D0F12 100%)"
              : product?.customViewerTheme === "brand" && product?.enterpriseBrandColor
                ? `linear-gradient(180deg, color-mix(in srgb, ${product.enterpriseBrandColor} 18%, white) 0%, #ffffff 48%, #f7f8f5 100%)`
                : product?.customViewerTheme === "light"
                  ? "linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #f3f4f6 100%)"
                  : "linear-gradient(180deg, #ffffff 0%, #fbfcfb 52%, #f4f7f4 100%)",
        }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(15,23,42,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,.06)_1px,transparent_1px)] [background-size:46px_46px]" />
      {product?.viewerWatermark && (logo || product.brandName) ? (
        <div className="pointer-events-none fixed bottom-3 left-3 z-[80] flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200/80 bg-white/85 px-2.5 py-2 shadow-sm backdrop-blur-md">
          {logo ? <img src={logo} alt="" className="h-6 w-6 rounded-lg object-contain" /> : null}
          {product.brandName ? (
            <span className="truncate text-[11px] font-bold text-slate-700">{product.brandName}</span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-white/55 px-5 text-slate-950 backdrop-blur-md">
          <div className="w-full max-w-[320px] rounded-[30px] border border-slate-200 bg-white/88 p-6 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-[var(--ar-primary-soft)]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--ar-primary)] border-t-transparent" />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.24em] text-slate-400">
              Loading viewer
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {product?.loadingMessage || "Preparing premium 3D experience"}
            </p>
          </div>
        </div>
      ) : entitlementError ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-[#f8f9fa] text-slate-900 p-6">
          <div className="w-full max-w-[440px] rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-50 text-amber-500 mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Unavailable</h1>
            <p className="mt-4 text-slate-500 font-semibold leading-relaxed">
              This AR experience is temporarily unavailable.
            </p>
          </div>
        </div>
      ) : accessDenied ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-white text-slate-950 p-6">
          <div className="w-full max-w-[420px] rounded-[30px] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <AlertTriangle size={60} className="mx-auto text-amber-500" />
            <h1 className="mt-5 text-3xl font-black">Unavailable</h1>
            <p className="mt-3 text-slate-500">{accessDenied}</p>
          </div>
        </div>
      ) : viewerAccessProduct && needsPassword(viewerAccessProduct) && !passwordUnlocked ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-white text-slate-950 p-6">
          <div className="w-full max-w-[420px] rounded-[30px] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <h1 className="text-2xl font-black">Password required</h1>
            <p className="mt-2 text-sm text-slate-500">Enter the share password to view this product.</p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Share password"
            />
            <button
              type="button"
              onClick={() => {
                if (passwordInput === product.sharePassword) {
                  setPasswordUnlocked(true);
                  setPasswordInput("");
                } else {
                  showNotice("error", "Incorrect password");
                }
              }}
              className="mt-4 w-full rounded-xl bg-[var(--ar-primary)] px-4 py-3 text-sm font-bold text-slate-950"
            >
              Unlock viewer
            </button>
          </div>
        </div>
      ) : !product || !modelSrc ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-white text-slate-950 p-6">
          <div className="w-full max-w-[420px] rounded-[30px] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <AlertTriangle size={60} className="mx-auto text-amber-500" />
            <h1 className="mt-5 text-3xl font-black">Product not found</h1>
            <p className="mt-3 text-slate-500">
              This product may be private, deleted, or missing a GLB file.
            </p>
          </div>
        </div>
      ) : stage === "landing" ? (
        <MobileProductLanding
          title={product.title || "3D Product"}
          subtitle={product.viewerTagline || product.category || undefined}
          description={product.description || undefined}
          brandName={product.brandName || undefined}
          category={product.category || undefined}
          poster={product.poster}
          logo={logo || undefined}
          hidePoweredBy={Boolean(product.removeBranding)}
          viewerTheme={product.customViewerTheme}
          ctaLabel={product.ctaLabel || undefined}
          buttonStyle={product.buttonStyle}
          headerStyle={product.headerStyle}
          viewerFont={product.viewerFont}
          onView3D={() => {
            setPendingAR(false);
            setStage("viewer");
          }}
          onViewAR={() => {
            setPendingAR(true);
            setStage("viewer");
          }}
        />
      ) : (
        <>
          <section data-viewer-section ref={viewerShellRef} className="fixed inset-0 z-10 pointer-events-auto bg-transparent">
            <ModelViewer
              key={`${modelIdentity}-${modelRetryKey}`}
              ref={viewerRef}
              src={modelSrc}
              poster={normalizeViewerAssetUrl(settings.poster)}
              exposure={settings.exposure ?? 0.9}
              toneMapping="commerce"
              environmentImage={resolveEnvironmentImage(settings.environmentImage)}
              backgroundColor={
                !settings.backgroundColor || settings.backgroundColor === "#ffffff"
                  ? "#F0F2F5"
                  : settings.backgroundColor
              }
              transparent={settings.transparent}
              shadowIntensity={settings.shadowIntensity ?? 1.25}
              shadowSoftness={settings.shadowSoftness ?? 0.7}
              autoRotate={settings.autoRotate}
              cameraControls={settings.cameraControls}
              interactionPrompt={settings.interactionPrompt}
              autoPlay={settings.autoPlay}
              showArButton={false}
              fov={settings.fov}
              cameraOrbit={settings.cameraOrbit || "35deg 65deg 240%"}
              cameraTarget={settings.cameraTarget}
              baseColor={settings.baseColor}
              metalness={settings.metalness}
              roughness={settings.roughness}
              emissiveColor={settings.emissiveColor}
              baseColorTexture={settings.baseColorTexture}
              allMaterialSettings={settings.materialSettings}
              arPlacement={settings.arPlacement === "wall" ? "wall" : "floor"}
              realScale={product.realScale !== false}
              logoDecals={product.logoDecals || []}
              onModelReady={() => {
                setModelReady(true);
                setModelError(false);
                scheduleCameraFit("ready", 80);
              }}
              onModelError={() => {
                setModelReady(false);
                setModelError(true);
                showNotice("error", "Model failed to load");
              }}
            />
          </section>

          {!modelReady && !modelError && (
            <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/88 px-5 py-3 text-sm font-black text-slate-500 shadow-xl backdrop-blur-xl">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--ar-primary)]" />
              Loading 3D model...
            </div>
          )}

          {modelError && (
            <div className="fixed left-1/2 top-1/2 z-30 w-[calc(100vw-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-slate-200 bg-white/94 p-5 text-center shadow-2xl backdrop-blur-xl">
              <AlertTriangle size={42} className="mx-auto text-amber-500" />
              <h2 className="mt-3 text-xl font-black text-slate-950">Model load issue</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                The GLB may still be loading or the model path is not reachable. Retry once after the product file finishes saving.
              </p>
              <button
                type="button"
                onClick={retryModelLoad}
                className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--ar-primary)] px-5 text-sm font-black text-[var(--ar-text)] shadow-lg shadow-black/10"
              >
                <RefreshCw size={16} />
                Reload Model
              </button>
            </div>
          )}

          <header
            data-viewer-header
            className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex items-start justify-between gap-3 p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-5 sm:pt-5"
          >
            <div
              className={`pointer-events-auto flex min-w-0 max-w-[min(72vw,340px)] items-center gap-2.5 rounded-full border px-2.5 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.10)] sm:gap-3 sm:px-3 ${headerClass}`}
            >
              {logo ? (
                <span className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-slate-200/80">
                  <img src={logo} alt="Brand logo" className="h-full w-full object-contain" />
                </span>
              ) : (
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-black tracking-wide text-slate-950"
                  style={{ backgroundColor: "var(--ar-primary)" }}
                >
                  {(product.brandName || "AR").trim().slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 pr-1.5">
                {product.brandWebsiteUrl ? (
                  <a
                    href={product.brandWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block truncate text-[13px] font-bold leading-tight underline-offset-2 hover:underline sm:text-sm ${
                      darkTheme ? "text-white" : "text-slate-950"
                    }`}
                  >
                    {product.brandName || product.title || "3D Product"}
                  </a>
                ) : (
                  <p
                    className={`truncate text-[13px] font-bold leading-tight sm:text-sm ${
                      darkTheme ? "text-white" : "text-slate-950"
                    }`}
                  >
                    {product.brandName || product.title || "3D Product"}
                  </p>
                )}
                <p className={`truncate text-[11px] font-semibold ${darkTheme ? "text-white/55" : "text-slate-400"}`}>
                  {product.viewerTagline ||
                    (product.brandName
                      ? product.showProductTitle === false
                        ? product.category || "3D / AR Viewer"
                        : product.title || product.category || "3D / AR Viewer"
                      : product.category || "3D / AR Viewer")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={`pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.10)] transition active:scale-95 sm:h-12 sm:w-12 ${headerClass} ${
                darkTheme ? "text-white hover:bg-white/15" : "hover:bg-white"
              }`}
              aria-label="Open product menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={20} />
            </button>
          </header>

          {!product.hideInteractionHint ? (
            <div className="pointer-events-none fixed inset-x-0 top-[72px] z-[70] flex justify-center px-4 sm:top-[84px]">
              <div
                className={`max-w-[calc(100vw-32px)] truncate rounded-full border px-3.5 py-1.5 text-[11px] font-semibold shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:px-4 sm:py-2 sm:text-xs sm:font-bold ${headerClass} ${
                  darkTheme ? "text-white/70" : "text-slate-500"
                }`}
              >
                <span className="sm:hidden">Drag • Pinch • View in AR</span>
                <span className="hidden sm:inline">
                  Drag to rotate • Pinch to zoom • View in AR to place in room
                </span>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6">
            <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/92 p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => void takeScreenshot()}
                title="Screenshot"
                aria-label="Screenshot"
                className="grid h-11 w-11 place-items-center rounded-full bg-[#F4F5F7] text-slate-900 transition hover:bg-[#EBEDF0] active:scale-[0.96]"
              >
                <Camera size={18} />
              </button>

              <button
                type="button"
                onClick={() => void resetCamera()}
                title="Center camera"
                aria-label="Center camera"
                className="grid h-11 w-11 place-items-center rounded-full bg-[#F4F5F7] text-slate-900 transition hover:bg-[#EBEDF0] active:scale-[0.96]"
              >
                <RotateCcw size={18} />
              </button>

              <button
                type="button"
                onClick={() => void openFullscreenViewer()}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="grid h-11 w-11 place-items-center rounded-full bg-[#F4F5F7] text-slate-900 transition hover:bg-[#EBEDF0] active:scale-[0.96]"
              >
                <Maximize2 size={18} />
              </button>

              <ARExperienceProButton
                product={{
                  id: product.id || id,
                  productUid: product.productUid || id,
                  title: product.title,
                  modelUrl: modelSrc,
                  usdzUrl: product.usdzUrl,
                  poster: normalizeViewerAssetUrl(product.poster),
                  realScale: product.realScale,
                  arPlacement: settings.arPlacement === "wall" ? "wall" : "floor",
                }}
                viewerRef={viewerRef}
                viewerUrl={viewerUrl}
                className={`grid h-11 w-11 place-items-center rounded-full shadow-lg transition active:scale-[0.96] ${buttonClass}`}
              >
                <Smartphone size={18} />
              </ARExperienceProButton>
            </div>
          </div>

          {!product.removeBranding ? (
            <p className="pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-[70] -translate-x-1/2 text-[10px] font-semibold tracking-wide text-slate-400 sm:bottom-[5.5rem]">
              Powered by AR360
            </p>
          ) : null}

          {menuOpen && (
            <div
              className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-start sm:justify-end"
              onClick={() => setMenuOpen(false)}
              role="presentation"
            >
              <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px] sm:bg-slate-950/25" />

              <aside
                role="dialog"
                aria-modal="true"
                aria-label="Product menu"
                onClick={(event) => event.stopPropagation()}
                className="relative z-10 flex w-full max-h-[min(88dvh,720px)] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:m-4 sm:mt-[76px] sm:mr-5 sm:max-h-[min(78vh,640px)] sm:w-[380px] sm:rounded-[24px] sm:border sm:border-slate-200/90"
              >
                {/* Mobile drag handle */}
                <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />

                {/* Sticky header */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    {logo ? (
                      <span className="flex h-11 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-slate-200">
                        <img src={logo} alt="Brand logo" className="h-full w-full object-contain" />
                      </span>
                    ) : (
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-[11px] font-black tracking-wide text-[#B9FF2C]">
                        AR
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-bold leading-tight text-slate-950">
                        {product.title || "3D Product"}
                      </h2>
                      <p className="truncate text-[12px] font-medium text-slate-400">
                        {product.brandName || product.category || "3D Product"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                    aria-label="Close menu"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scroll body */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 [scrollbar-width:thin]">
                  {product.poster ? (
                    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#FAFAFA]">
                      <div className="relative aspect-square w-full bg-white p-3 sm:p-4">
                        <img
                          src={normalizeViewerAssetUrl(product.poster)}
                          alt={`${product.title || "Product"} poster`}
                          className="h-full w-full object-contain"
                          draggable={false}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className={`${product.poster ? "mt-4" : ""} rounded-[18px] bg-slate-50 p-3.5`}>
                    <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-700">
                      <Info size={15} />
                      Details
                    </div>
                    <div className="space-y-2.5 text-[13px]">
                      <DetailRow label="Product" value={product.title || "Untitled"} />
                      <DetailRow label="Category" value={product.category || "Uncategorized"} />
                      <DetailRow label="File" value={product.fileName || "GLB model"} />
                      <DetailRow
                        label="AR Scale"
                        value={product.realScale === false ? "Resizable" : "Real scale"}
                      />
                    </div>
                    {product.description ? (
                      <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-[12px] leading-relaxed text-slate-500 ring-1 ring-slate-200/70">
                        {product.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-3.5">
                    <p className="text-[13px] font-bold text-slate-700">Share link</p>
                    <p className="mt-2 break-all rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-slate-500">
                      {viewerUrl}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => void copyShareLink()}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-[13px] font-bold text-white transition active:scale-[0.98]"
                      >
                        <Copy size={15} />
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => void nativeShare()}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--ar-primary)] text-[13px] font-bold text-slate-950 transition hover:bg-[var(--ar-primary-hover)] active:scale-[0.98]"
                      >
                        <Share2 size={15} />
                        Share
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sticky footer actions */}
                <div className="shrink-0 space-y-2.5 border-t border-slate-100 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5 sm:pb-4">
                  <ARExperienceProButton
                    product={{
                      id: product.id || id,
                      productUid: product.productUid || id,
                      title: product.title,
                      modelUrl: modelSrc,
                      usdzUrl: product.usdzUrl,
                      poster: normalizeViewerAssetUrl(product.poster),
                      realScale: product.realScale,
                      arPlacement: settings.arPlacement === "wall" ? "wall" : "floor",
                    }}
                    viewerRef={viewerRef}
                    viewerUrl={viewerUrl}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-[14px] font-bold transition active:scale-[0.98] ${buttonClass}`}
                  >
                    <Smartphone size={18} />
                    {product.ctaLabel || "View in AR"}
                  </ARExperienceProButton>

                  {ctaLabel ? (
                    <button
                      type="button"
                      onClick={handleCtaClick}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-[14px] font-bold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                    >
                      <ExternalLink size={18} />
                      {ctaLabel}
                    </button>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        void takeScreenshot();
                        setMenuOpen(false);
                      }}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-[13px] font-bold text-slate-900 transition hover:bg-slate-200 active:scale-[0.98]"
                    >
                      <Download size={15} />
                      Save Shot
                    </button>
                    <a
                      href={viewerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-[13px] font-bold text-slate-900 transition hover:bg-slate-200 active:scale-[0.98]"
                    >
                      <ExternalLink size={15} />
                      Open
                    </a>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {notice && (
            <div className="fixed right-3 top-[max(12px,env(safe-area-inset-top))] z-[10000] w-[min(360px,calc(100vw-24px))] sm:right-5 sm:top-5">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    notice.type === "error"
                      ? "bg-red-50 text-red-500"
                      : notice.type === "info"
                        ? "bg-[#F7FFE8] text-slate-800"
                        : "bg-emerald-50 text-emerald-500"
                  }`}
                >
                  <Check size={16} />
                </div>
                <p className="min-w-0 truncate text-sm font-bold text-slate-800">{notice.message}</p>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
