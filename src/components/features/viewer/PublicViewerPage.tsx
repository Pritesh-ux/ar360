"use client";

import { sanitizeOrigin } from "@/lib/url";
import AppImage from "@/components/shared/AppImage";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, forwardRef, type CSSProperties } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Download,
  MessageCircle,
  Palette,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Info,
  Maximize2,
  MoreVertical,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import ARExperienceProButton from "@/components/features/ar/ARExperienceProButton";
import StudioLookArCamera, {
  stopMediaStream,
} from "@/components/features/ar/StudioLookArCamera";
import PoweredByAr360 from "@/components/brand/PoweredByAr360";
import MobileProductLanding from "@/components/features/viewer/MobileProductLanding";
import VariantPickerSheet from "@/components/features/viewer/VariantPickerSheet";
import ClientCatalogSidebar from "@/components/features/viewer/ClientCatalogSidebar";
import ViewerBrandMark from "@/components/features/viewer/ViewerBrandMark";
import { getProductModelSrc } from "@/lib/modelSource";
import { fitProductCamera } from "@/components/features/viewer/fit-product-camera";
import { trackAnalyticsEvent } from "@/lib/analytics/track-event";
import { buildWhatsAppHref } from "@/lib/viewer-contact/whatsapp";
import EnquireModal from "@/components/features/viewer/EnquireModal";
import { usePublicViewerProduct } from "@/lib/user-panel/public-viewer";
import { viewerBrandStyle } from "@/lib/branding/contrast";
import { DEFAULT_LOGO_DESIGN, type LogoDesign } from "@/lib/branding/logo-design";
import { DetailRow } from "./DetailRow";
import type { Notice } from "./types";
import {
  copyToClipboard,
  getLogo,
  getVariantSwatchColor,
  getViewerSettings,
  normalizeViewerAssetUrl,
  resolveEnvironmentImage,
} from "./viewer-utils";
import { checkViewerAccess, needsPassword, recordViewerEvent, type ViewerProduct as UniversalViewerProduct } from "@/lib/universal-viewer";

/** Match server MOBILE_AR_SAFE_BYTES — keep client free of glb-optimize deps. */
/** Prefer AR-lite GLB on phones whenever a lite file exists. */
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

/** How long the transfer may stay frozen before the viewer offers a retry. */
const MODEL_STALL_MS = 120000;

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
    return "border-2 border-[var(--ar-primary)] bg-transparent text-[var(--ar-outline-fg)] hover:bg-[var(--ar-primary-soft)]";
  }
  if (style === "soft") {
    return "border border-transparent bg-[var(--ar-primary-soft)] text-[var(--ar-on-soft)] hover:bg-[var(--ar-primary)] hover:text-[var(--ar-on-primary)]";
  }
  return "border border-transparent bg-[var(--ar-primary)] text-[var(--ar-on-primary)] hover:brightness-110 hover:text-[var(--ar-on-primary)]";
}

export default function PublicViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params.id || "");
  const clientUid = String(searchParams.get("client") || "").trim();

  const viewerRef = useRef<any>(null);
  const viewerShellRef = useRef<HTMLElement | null>(null);
  const cameraFitTimerRef = useRef<number | null>(null);
  const userMovedCameraRef = useRef(false);
  const openingCameraRef = useRef<{
    cameraOrbit: string;
    cameraTarget: string;
    fieldOfView: string;
  } | null>(null);
  const source = searchParams.get("source") || "direct";
  const allowPreview = searchParams.get("preview") === "1";
  const { product, loading, error: entitlementError } = usePublicViewerProduct(id, {
    source: allowPreview ? "preview" : source,
    trackEvent: "viewer_open",
    retries: 2,
    allowPreview,
    clientUid: clientUid || null,
  });
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [modelRetryKey, setModelRetryKey] = useState(0);
  const [autoRotateOverride, setAutoRotateOverride] = useState<boolean | null>(null);
  const loadedPercentRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const [resolvedArScale, setResolvedArScale] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [stage, setStage] = useState<"landing" | "viewer">("viewer");
  const [pendingAR, setPendingAR] = useState(false);
  const [studioLookAr, setStudioLookAr] = useState(false);
  const [studioArStream, setStudioArStream] = useState<MediaStream | null>(null);
  const studioArStreamRef = useRef<MediaStream | null>(null);
  const [shopperVariantId, setShopperVariantId] = useState<string | null>(null);
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null);
  const [variantSheetOpen, setVariantSheetOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [clientLogoUrl, setClientLogoUrl] = useState("");
  const [clientLogoDesign, setClientLogoDesign] = useState<LogoDesign | null>(null);
  const [enquireOpen, setEnquireOpen] = useState(false);

  const arEnabled = product?.allowAr !== false;

  const autoOpenAR =
    arEnabled &&
    (pendingAR ||
      searchParams.get("openAR") === "1" ||
      searchParams.get("ar") === "1" ||
      searchParams.get("mode") === "ar");

  useDeferredEffect(() => {
    const fromQr =
      searchParams.get("source") === "qr" ||
      searchParams.get("landing") === "1" ||
      searchParams.get("qr") === "1";
    if (fromQr) {
      setStage("landing");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!product || !arEnabled || !autoOpenAR || !modelReady || stage !== "viewer") return;
    // Open tutorial sheet only (synthetic click is not isTrusted → no camera yet).
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>("[data-ar-pro-launch]")?.click();
      setPendingAR(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [product, arEnabled, autoOpenAR, modelReady, stage]);

  useEffect(() => {
    studioArStreamRef.current = studioArStream;
  }, [studioArStream]);

  useEffect(() => {
    return () => {
      stopMediaStream(studioArStreamRef.current);
      studioArStreamRef.current = null;
    };
  }, []);

  const viewerAccessProduct = useMemo((): UniversalViewerProduct | null => {
    if (!product) return null;
    return { ...product, id: product.id || product.productUid || id } as UniversalViewerProduct;
  }, [product, id]);

  useDeferredEffect(() => {
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

  useDeferredEffect(() => {
    setModelReady(false);
    setModelError(false);
  }, [id]);

  useDeferredEffect(() => {
    if (!product) return;
    const initial =
      product.activeVariantId ||
      product.variants?.[0]?.id ||
      null;
    setShopperVariantId(initial);
    setPendingVariantId(null);
  }, [product?.productUid || product?.id, product?.activeVariantId]);

  const shopperVariants = product?.variants || [];
  const hasVariantPicker = shopperVariants.length > 1;
  const previewVariantId =
    variantSheetOpen && pendingVariantId ? pendingVariantId : shopperVariantId;
  const settings = useMemo(
    () => getViewerSettings(product, previewVariantId),
    [product, previewVariantId],
  );
  const preferMobileArLite = usePreferMobileArLite();
  const [forceFullModel, setForceFullModel] = useState(false);
  const modelSrc = useMemo(() => {
    if (!product) return undefined;
    const full = getProductModelSrc(product);
    const arLite = String(product.arModelUrl || "").trim();
    // Prefer lite whenever present on phone/coarse viewports — don't require modelBytes.
    // If lite failed once, fall back to the full model.glb.
    if (!forceFullModel && preferMobileArLite && arLite) {
      return getProductModelSrc({
        ...product,
        modelUrl: arLite,
        fileName: "model.ar.glb",
      });
    }
    return full;
  }, [product, preferMobileArLite, forceFullModel]);
  // Keep model identity stable across variant switches so materials apply live.
  const modelIdentity = `${product?.productUid || product?.id || id}`;
  const productLogo = getLogo(product);
  // Client branding wins when viewer opens with ?client=...; else product brand; else AR360 mark.
  const logo = clientLogoUrl || productLogo;
  const logoDesign = clientLogoDesign || product?.logoDesign || DEFAULT_LOGO_DESIGN;
  const autoRotateEnabled = autoRotateOverride ?? settings.autoRotate !== false;

  useDeferredEffect(() => {
    if (!clientUid) {
      setClientLogoUrl("");
      setClientLogoDesign(null);
    }
  }, [clientUid]);

  useDeferredEffect(() => {
    setAutoRotateOverride(null);
    setResolvedArScale(null);
    openingCameraRef.current = null;
    setForceFullModel(false);
  }, [modelIdentity]);

  useEffect(() => {
    // Prefer an uploaded customer favicon only. Never fall back to brand logo —
    // that made share/AR/embed tabs show another company's mark.
    const href = String(product?.faviconUrl || "").trim();
    if (!href || typeof document === "undefined") return;
    let link = document.querySelector<HTMLLinkElement>("link[data-ar360-brand-favicon]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-ar360-brand-favicon", "1");
      document.head.appendChild(link);
    }
    link.href = href;
  }, [product?.faviconUrl]);

  const viewerUrl = useMemo(() => {
    if (typeof window === "undefined") return `/viewer/${id}`;
    return `${sanitizeOrigin(window.location.origin)}/viewer/${id}`;
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

  const viewerContact = product?.viewerContact;
  const enquireEnabled = Boolean(viewerContact?.enquireEnabled);
  const whatsappEnabled = Boolean(viewerContact?.whatsappEnabled && viewerContact?.whatsappNumber);
  const enquireLabel = viewerContact?.enquireLabel?.trim() || "Enquire";
  const whatsappLabel = viewerContact?.whatsappLabel?.trim() || "WhatsApp";

  function openEnquire() {
    if (!product) return;
    trackAnalyticsEvent({
      event: "enquiry_open",
      productUid: product.productUid || product.id || id,
    });
    setEnquireOpen(true);
  }

  async function submitEnquire(input: { name: string; phone: string; email: string; message: string }) {
    if (!product) throw new Error("Product is not available.");
    const res = await fetch("/api/product-enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.productUid || product.id || id,
        clientUid: clientUid || undefined,
        viewerUrl,
        ...input,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data.error || "Could not send enquiry."));
    trackAnalyticsEvent({
      event: "enquiry_submit",
      productUid: product.productUid || product.id || id,
    });
  }

  function openWhatsApp() {
    if (!product || !viewerContact?.whatsappNumber) return;
    trackAnalyticsEvent({
      event: "whatsapp_click",
      productUid: product.productUid || product.id || id,
    });
    const href = buildWhatsAppHref({
      number: viewerContact.whatsappNumber,
      productTitle: product.title || "this product",
      productId: product.productUid || product.id || id,
      viewerUrl,
    });
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  function handleCtaClick() {
    if (!settings.ctaUrl || !product) return;
    trackAnalyticsEvent({
      event: "cta_click",
      productUid: product.productUid || product.id || id,
      meta: { ctaType: settings.ctaType || "visit_website", trafficSource: source },
    });
    const raw = String(settings.ctaUrl).trim();
    const type = settings.ctaType || "visit_website";
    let href = raw;
    if (type === "whatsapp") {
      href =
        buildWhatsAppHref({
          number: raw,
          productTitle: product.title || "this product",
          productId: product.productUid || product.id || id,
          viewerUrl,
        }) || raw;
    } else if (type === "tel" || type === "contact_seller") {
      href = raw.startsWith("tel:") ? raw : `tel:${raw.replace(/[^\d+]/g, "") || raw}`;
    } else if (type === "mailto") {
      href = raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
    } else if (!/^https?:\/\//i.test(raw) && !raw.startsWith("mailto:") && !raw.startsWith("tel:")) {
      href = `https://${raw}`;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function copyShareLink() {
    trackAnalyticsEvent({ event: "copy_link", productUid: product?.productUid || product?.id || id });
    await copyToClipboard(viewerUrl);
    showNotice("success", "Share link copied");
  }

  async function nativeShare() {
    if (!product) return;
    const productUid = product.productUid || product.id || id;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title || "3D Product",
          text: product.description || "View this product in 3D / AR",
          url: viewerUrl,
        });
        trackAnalyticsEvent({ event: "share_native", productUid });
        return;
      } catch {
        // User cancelled or share failed — still keep a copy fallback.
      }
    }
    await copyShareLink();
  }

  function enterStudioLookAr(stream?: MediaStream) {
    setMenuOpen(false);
    setVariantSheetOpen(false);
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

  async function takeScreenshot() {
    const viewer = viewerRef.current;
    const productUid = product?.productUid || product?.id || id;
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
      trackAnalyticsEvent({ event: "screenshot", productUid });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: product?.title || "3D Screenshot" });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        link.click();
      }

      showNotice("success", "Screenshot saved");
    } catch {
      showNotice("error", "Screenshot failed. Try again after model loads.");
    }
  }

  async function fitViewerCamera(reason: "ready" | "resize" | "reset" | "retry" = "ready") {
    const viewer = viewerRef.current;
    if (!viewer?.loaded) return;

    // Mobile browsers fire resize whenever the URL bar collapses mid-gesture, which
    // would otherwise snap the camera back and make pinch-zoom look broken.
    if (reason === "resize" && userMovedCameraRef.current) {
      viewer.updateFraming?.();
      return;
    }
    if (reason !== "resize") userMovedCameraRef.current = false;

    const opening = openingCameraRef.current;
    const restoreOrbit =
      reason === "reset"
        ? opening?.cameraOrbit || settings.cameraOrbit || null
        : settings.cameraOrbit || null;
    const restoreTarget =
      reason === "reset"
        ? opening?.cameraTarget || settings.cameraTarget || ""
        : settings.cameraTarget || "";
    const restoreFov =
      reason === "reset"
        ? opening?.fieldOfView || settings.fov || 45
        : settings.fov || 45;

    try {
      await fitProductCamera({
        viewer,
        cameraOrbit: restoreOrbit,
        cameraTarget: restoreTarget,
        fieldOfView: restoreFov,
        // Reset restores the QR/open view — never a padded auto-fit zoom-out.
        forceAutoFit: reason === "retry" && !restoreOrbit,
        fitPadding: 1.18,
        reason,
      });
      if (reason === "ready" && !openingCameraRef.current) {
        const live = viewer.getCameraOrbit?.();
        const orbit =
          String(settings.cameraOrbit || "").trim() ||
          (live && Number.isFinite(live.theta)
            ? `${live.theta}rad ${live.phi}rad ${live.radius}m`
            : String(viewer.cameraOrbit || "").trim());
        if (orbit) {
          openingCameraRef.current = {
            cameraOrbit: orbit,
            cameraTarget:
              String(settings.cameraTarget || viewer.cameraTarget || "").trim(),
            fieldOfView: String(viewer.fieldOfView || `${settings.fov || 45}deg`),
          };
        }
      }
      try {
        viewer.cameraControls = true;
        viewer.removeAttribute?.("disable-zoom");
      } catch {
        // ignore
      }
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
    setForceFullModel(true);
    setModelRetryKey((value) => value + 1);
    showNotice("info", "Retrying 3D model...");
    scheduleCameraFit("retry", 650);
  }

  async function resetCamera() {
    await fitViewerCamera("reset");
    showNotice("success", "View reset");
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
      if (event.key === "Escape") {
        setMenuOpen(false);
        exitStudioLookAr();
      }
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

    loadedPercentRef.current = 0;
    lastProgressAtRef.current = Date.now();

    // Heavy models on mobile data can legitimately take a minute, so give up only
    // when the transfer itself stops advancing instead of at a fixed deadline.
    const timer = window.setInterval(() => {
      if (Date.now() - lastProgressAtRef.current < MODEL_STALL_MS) return;
      window.clearInterval(timer);
      setModelError(true);
      showNotice("error", "3D model is taking too long. Try reload.");
    }, 2000);

    return () => window.clearInterval(timer);
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

    const viewer = viewerRef.current as HTMLElement | null;
    const markUserCamera = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source === "user-interaction") userMovedCameraRef.current = true;
    };
    viewer?.addEventListener("camera-change", markUserCamera);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      viewer?.removeEventListener("camera-change", markUserCamera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelReady, modelIdentity]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset cached scale when model changes
    setResolvedArScale(null);
  }, [modelIdentity, modelSrc]);

  const darkTheme = product?.customViewerTheme === "dark";
  const headerClass = headerChromeClass(product?.headerStyle, darkTheme);
  const buttonClass = brandButtonClass(product?.buttonStyle);
  const solidViewerBg = settings.transparent
    ? "transparent"
    : !settings.backgroundColor ||
        settings.backgroundColor === "#ffffff" ||
        settings.backgroundColor === "#FFFFFF"
      ? null
      : settings.backgroundColor;
  const pageBackdrop = solidViewerBg
    ? solidViewerBg
    : darkTheme
      ? "linear-gradient(180deg, #111318 0%, #17191D 52%, #0D0F12 100%)"
      : product?.customViewerTheme === "brand" && product?.enterpriseBrandColor
        ? `linear-gradient(180deg, color-mix(in srgb, ${product.enterpriseBrandColor} 18%, white) 0%, #ffffff 48%, #f7f8f5 100%)`
        : product?.customViewerTheme === "light"
          ? "linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #f3f4f6 100%)"
          : "linear-gradient(180deg, #ffffff 0%, #fbfcfb 52%, #f4f7f4 100%)";

  return (
    <main
      data-viewer-page
      data-viewer-theme={product?.customViewerTheme || "default"}
      data-header-style={product?.headerStyle || "glass"}
      data-button-style={product?.buttonStyle || "filled"}
      data-transparent-viewer={settings.transparent ? "true" : "false"}
      className={`fixed inset-0 overflow-hidden text-slate-950 [touch-action:manipulation] z-0 ${
        darkTheme ? "bg-[#111318] text-white" : "bg-[#fbfcfb]"
      }`}
      style={
        {
          fontFamily: viewerFontFamily(product?.viewerFont),
          ...viewerBrandStyle(product?.enterpriseBrandColor, product?.enterpriseAccentColor),
          ...(solidViewerBg ? { background: solidViewerBg } : {}),
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: pageBackdrop }}
      />
      {!solidViewerBg ? (
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(15,23,42,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,.06)_1px,transparent_1px)] [background-size:46px_46px]" />
      ) : null}
      {product?.viewerWatermark && logo ? (
        <div className="pointer-events-none fixed bottom-3 left-3 z-[80]">
          <ViewerBrandMark src={logo} size={40} className="shrink-0 drop-shadow-md" design={logoDesign} />
        </div>
      ) : null}

      {loading ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-white px-5 text-slate-950">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-[180px] rounded-3xl border border-[#ECECEC] bg-white p-4 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="absolute left-0 top-0 h-full w-1/2 animate-pulse rounded-full bg-[#84D400]" />
              </div>
              <span className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
                Loading Viewer
              </span>
            </div>
            <p className="max-w-xs text-[13px] font-medium text-[#737373]">
              {product?.loadingMessage || "Please wait while we prepare the 3D experience..."}
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
              className="mt-4 w-full rounded-xl bg-[var(--ar-primary)] px-4 py-3 text-sm font-bold text-[var(--ar-on-primary)]"
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
          poweredByLabel={product.poweredByLabel}
          viewerTheme={product.customViewerTheme}
          ctaLabel={product.ctaLabel || undefined}
          buttonStyle={product.buttonStyle}
          headerStyle={product.headerStyle}
          viewerFont={product.viewerFont}
          showAr={arEnabled}
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
          <section
            data-viewer-section
            ref={viewerShellRef}
            className="fixed inset-0 z-10 pointer-events-auto"
            style={{
              backgroundColor: studioLookAr
                ? "transparent"
                : settings.transparent
                  ? "transparent"
                  : solidViewerBg || "#F0F2F5",
            }}
          >
            {studioLookAr ? (
              <StudioLookArCamera
                active
                stream={studioArStream}
                onExit={exitStudioLookAr}
                onCameraError={(message) => {
                  showNotice("error", message || "Camera access failed. Tap View in AR to retry.");
                  exitStudioLookAr();
                }}
              />
            ) : null}
            <div
              className={
                studioLookAr
                  ? "pointer-events-auto absolute inset-0 z-[2] bg-transparent"
                  : "h-full w-full"
              }
              style={studioLookAr ? { background: "transparent" } : undefined}
            >
            <ModelViewer
              key={`${modelIdentity}-${modelRetryKey}`}
              ref={viewerRef}
              src={modelSrc}
              poster={normalizeViewerAssetUrl(settings.poster)}
              exposure={settings.exposure ?? 0.9}
              environmentTint={settings.environmentTint || "#ffffff"}
              environmentSaturation={settings.environmentSaturation ?? 1}
              toneMapping="commerce"
              environmentImage={resolveEnvironmentImage(settings.environmentImage)}
              skyboxImage={
                studioLookAr
                  ? undefined
                  : (settings as { useSkybox?: boolean }).useSkybox === true &&
                      settings.environmentImage &&
                      settings.environmentImage !== "default" &&
                      !String(settings.environmentImage).startsWith("blob:")
                    ? settings.environmentImage
                    : undefined
              }
              backgroundColor={
                studioLookAr || settings.transparent
                  ? "transparent"
                  : solidViewerBg || "#F0F2F5"
              }
              transparent={studioLookAr || Boolean(settings.transparent)}
              shadowIntensity={studioLookAr ? 0 : settings.shadowIntensity ?? 1.25}
              shadowSoftness={settings.shadowSoftness ?? 0.7}
              autoRotate={studioLookAr ? false : autoRotateEnabled}
              cameraControls={settings.cameraControls !== false}
              interactionPrompt={studioLookAr ? false : settings.interactionPrompt}
              autoPlay={settings.autoPlay}
              showArButton={false}
              fov={settings.fov}
              cameraOrbit={settings.cameraOrbit || undefined}
              cameraTarget={settings.cameraTarget}
              disableZoom={false}
              disableTap
              // Variant materials only — do NOT pass product-level baseColor/metalness.
              allMaterialSettings={settings.materialSettings}
              arPlacement={settings.arPlacement === "wall" ? "wall" : "floor"}
              realScale={product.realScale === true}
              modelUnit={product.arModelUnit || "auto"}
              iosSrc={normalizeViewerAssetUrl(product.usdzUrl) || undefined}
              modelScale={
                typeof product.arModelScale === "number" && product.arModelScale > 0
                  ? product.arModelScale
                  : null
              }
              onModelScaleResolved={(scale) => setResolvedArScale(scale)}
              logoDecals={product.logoDecals || []}
              hotspots={product.hotspots || []}
              onLoadProgress={(percent) => {
                // Any progress heartbeat resets the stall timer — heavy GLBs may
                // sit at the same % for a while while bytes keep arriving.
                lastProgressAtRef.current = Date.now();
                if (percent > loadedPercentRef.current) {
                  loadedPercentRef.current = percent;
                }
              }}
              onModelReady={() => {
                setModelReady(true);
                setModelError(false);
                scheduleCameraFit("ready", 80);
              }}
              onModelError={() => {
                const arLite = String(product.arModelUrl || "").trim();
                if (!forceFullModel && preferMobileArLite && arLite) {
                  setForceFullModel(true);
                  setModelReady(false);
                  setModelError(false);
                  setModelRetryKey((key) => key + 1);
                  return;
                }
                setModelReady(false);
                setModelError(true);
                showNotice("error", "Model failed to load");
              }}
            />
            </div>
          </section>

          {clientUid && !studioLookAr ? (
            <ClientCatalogSidebar
              clientUid={clientUid}
              activeProductId={String(product.id || id)}
              fallbackLogoUrl={productLogo || undefined}
              hasVariantPicker={hasVariantPicker}
              onLogoUrlChange={setClientLogoUrl}
              onLogoDesignChange={setClientLogoDesign}
              onOpenChange={setCatalogOpen}
              onSelectProduct={(productId) => {
                const next = new URLSearchParams(searchParams.toString());
                next.delete("openAR");
                next.delete("ar");
                next.delete("mode");
                next.set("client", clientUid);
                const qs = next.toString();
                router.push(`/viewer/${encodeURIComponent(productId)}${qs ? `?${qs}` : ""}`);
              }}
            />
          ) : null}

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
                className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--ar-primary)] px-5 text-sm font-black text-[var(--ar-on-primary)] shadow-lg shadow-black/10"
              >
                <RefreshCw size={16} />
                Reload Model
              </button>
            </div>
          )}

          {!studioLookAr ? (
          <header
            data-viewer-header
            className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex items-start justify-between gap-3 p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-5 sm:pt-5"
          >
            {clientUid && catalogOpen ? (
              <span aria-hidden className="h-10 w-24 shrink-0 sm:h-11" />
            ) : logo ? (
              <div className="pointer-events-auto drop-shadow-[0_6px_16px_rgba(15,23,42,0.22)]">
                <ViewerBrandMark src={logo} size={52} className="shrink-0" design={logoDesign} />
              </div>
            ) : product.brandName ? (
              <div
                className={`pointer-events-auto flex min-w-0 max-w-[min(72vw,280px)] items-center gap-2 rounded-full border px-3 py-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.10)] sm:px-3.5 sm:py-2 ${headerClass}`}
              >
                <div className="min-w-0 pr-1">
                  {product.brandWebsiteUrl ? (
                    <a
                      href={product.brandWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block truncate text-[13px] font-bold leading-tight underline-offset-2 hover:underline sm:text-sm ${
                        darkTheme ? "text-white" : "text-slate-950"
                      }`}
                    >
                      {product.brandName}
                    </a>
                  ) : (
                    <p
                      className={`truncate text-[13px] font-bold leading-tight sm:text-sm ${
                        darkTheme ? "text-white" : "text-slate-950"
                      }`}
                    >
                      {product.brandName}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <span aria-hidden className="h-10 w-10 shrink-0" />
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={`pointer-events-auto grid h-10 w-10 shrink-0 place-items-center text-slate-900 transition active:scale-95 sm:h-11 sm:w-11 ${
                darkTheme ? "text-white" : "text-slate-800"
              }`}
              aria-label="Open product menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={22} />
            </button>
          </header>
          ) : null}

          {/* Interaction tip intentionally hidden on public viewer (mobile clutter). */}

          {!studioLookAr ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6">
            {hasVariantPicker ? (
              <div className="pointer-events-auto flex max-w-[min(100%,420px)] items-center gap-2 overflow-x-auto rounded-full border border-white/70 bg-white/92 px-2 py-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                {shopperVariants.map((variant) => {
                  const selected = shopperVariantId === variant.id;
                  const swatch = getVariantSwatchColor(variant);
                  const poster = normalizeViewerAssetUrl(variant.poster);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      title={variant.name || "Variant"}
                      onClick={() => {
                        setShopperVariantId(variant.id);
                        setPendingVariantId(null);
                        if (viewerAccessProduct) {
                          recordViewerEvent(viewerAccessProduct, "variant_change", {
                            variantId: variant.id,
                            variantName: variant.name || "",
                          });
                        }
                      }}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0.5 transition ${
                        selected
                          ? "bg-[#F0FBD9] ring-2 ring-[#84D400]"
                          : "bg-[#F4F5F7] hover:bg-[#EBEDF0]"
                      }`}
                    >
                      {poster ? (
                        <span className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-black/10">
                          <AppImage src={poster} alt="" className="h-full w-full object-cover" />
                        </span>
                      ) : (
                        <span
                          className="h-9 w-9 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: swatch }}
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setPendingVariantId(shopperVariantId);
                    setVariantSheetOpen(true);
                  }}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black text-[#3F7A00]"
                >
                  See all
                </button>
              </div>
            ) : null}

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
                onClick={() => setAutoRotateOverride(!autoRotateEnabled)}
                title={autoRotateEnabled ? "Stop auto-rotate" : "Start auto-rotate"}
                aria-label={autoRotateEnabled ? "Stop auto-rotate" : "Start auto-rotate"}
                aria-pressed={autoRotateEnabled}
                className={`grid h-11 w-11 place-items-center rounded-full transition active:scale-[0.96] ${
                  autoRotateEnabled
                    ? "bg-[#F0FBD9] text-[#3F7A00] ring-1 ring-[#84D400]/60"
                    : "bg-[#F4F5F7] text-slate-900 hover:bg-[#EBEDF0]"
                }`}
              >
                <RefreshCw size={18} className={autoRotateEnabled ? "animate-spin [animation-duration:3s]" : ""} />
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

              {hasVariantPicker ? (
                <button
                  type="button"
                  onClick={() => {
                    setPendingVariantId(shopperVariantId);
                    setVariantSheetOpen(true);
                  }}
                  title="Choose variant"
                  aria-label="Choose variant"
                  className="grid h-11 w-11 place-items-center rounded-full bg-[#F4F5F7] text-slate-900 transition hover:bg-[#EBEDF0] active:scale-[0.96]"
                >
                  <Palette size={18} />
                </button>
              ) : null}

              {arEnabled ? (
                <ARExperienceProButton
                  product={{
                    id: product.id || id,
                    productUid: product.productUid || id,
                    title: product.title,
                    modelUrl: modelSrc,
                    arModelUrl: product.arModelUrl,
                    usdzUrl: product.usdzUrl,
                    modelBytes: product.modelBytes,
                    poster: normalizeViewerAssetUrl(product.poster),
                    realScale: product.realScale,
                    arPlacement: settings.arPlacement === "wall" ? "wall" : "floor",
                    arModelScale:
                      resolvedArScale ??
                      (typeof product.arModelScale === "number" ? product.arModelScale : null),
                  }}
                  viewerRef={viewerRef}
                  viewerUrl={viewerUrl}
                  onStudioLookAr={enterStudioLookAr}
                  className={`grid h-11 w-11 place-items-center rounded-full shadow-lg transition active:scale-[0.96] ${buttonClass}`}
                  brandLogoUrl={logo || undefined}
                  brandColor={product.enterpriseBrandColor}
                  brandAccentColor={product.enterpriseAccentColor}
                >
                  <Smartphone size={18} />
                </ARExperienceProButton>
              ) : null}
            </div>
          </div>
          ) : null}

          <VariantPickerSheet
            open={variantSheetOpen}
            variants={shopperVariants}
            selectedId={shopperVariantId}
            pendingId={pendingVariantId}
            onSelect={(variantId) => setPendingVariantId(variantId)}
            onApply={() => {
              const nextId = pendingVariantId || shopperVariantId;
              if (nextId) {
                setShopperVariantId(nextId);
                if (viewerAccessProduct) {
                  recordViewerEvent(viewerAccessProduct, "variant_change", {
                    variantId: nextId,
                    variantName: shopperVariants.find((item) => item.id === nextId)?.name || "",
                  });
                }
              }
              setPendingVariantId(null);
              setVariantSheetOpen(false);
            }}
            onClose={() => {
              setPendingVariantId(null);
              setVariantSheetOpen(false);
            }}
          />

          {!product.removeBranding && !studioLookAr ? (
            <div
              className={`pointer-events-none fixed left-1/2 z-[70] -translate-x-1/2 text-slate-400 ${
                hasVariantPicker
                  ? "bottom-[calc(8.5rem+env(safe-area-inset-bottom))] sm:bottom-[9.25rem]"
                  : "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-[5.5rem]"
              }`}
            >
              <PoweredByAr360 tone="light" className="text-slate-400" label={product.poweredByLabel} />
            </div>
          ) : null}

          {menuOpen && !studioLookAr && (
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
                    {logo ? <ViewerBrandMark src={logo} size={48} className="shrink-0" design={logoDesign} /> : null}
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
                        <AppImage
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
                        value={product.realScale === true ? "Real scale" : "Resizable"}
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
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--ar-primary)] text-[13px] font-bold text-[var(--ar-on-primary)] transition hover:brightness-110 hover:text-[var(--ar-on-primary)] active:scale-[0.98]"
                      >
                        <Share2 size={15} />
                        Share
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sticky footer actions */}
                <div className="shrink-0 space-y-2.5 border-t border-slate-100 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5 sm:pb-4">
                  {arEnabled ? (
                    <ARExperienceProButton
                      product={{
                        id: product.id || id,
                        productUid: product.productUid || id,
                        title: product.title,
                        modelUrl: modelSrc,
                        arModelUrl: product.arModelUrl,
                        usdzUrl: product.usdzUrl,
                        modelBytes: product.modelBytes,
                        poster: normalizeViewerAssetUrl(product.poster),
                        realScale: product.realScale,
                        arPlacement: settings.arPlacement === "wall" ? "wall" : "floor",
                        arModelScale:
                          resolvedArScale ??
                          (typeof product.arModelScale === "number" ? product.arModelScale : null),
                      }}
                      viewerRef={viewerRef}
                      viewerUrl={viewerUrl}
                      onStudioLookAr={enterStudioLookAr}
                      className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-[14px] font-bold transition active:scale-[0.98] ${buttonClass}`}
                      brandLogoUrl={logo || undefined}
                      brandColor={product.enterpriseBrandColor}
                      brandAccentColor={product.enterpriseAccentColor}
                    >
                      <Smartphone size={18} />
                      {product.ctaLabel || "View in AR"}
                    </ARExperienceProButton>
                  ) : null}

                  {enquireEnabled ? (
                    <button
                      type="button"
                      onClick={openEnquire}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 text-[14px] font-bold text-white transition hover:brightness-125 hover:text-white active:scale-[0.98]"
                    >
                      <MessageCircle size={18} />
                      {enquireLabel}
                    </button>
                  ) : null}

                  {whatsappEnabled ? (
                    <button
                      type="button"
                      onClick={openWhatsApp}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-[14px] font-bold text-white transition hover:brightness-110 hover:text-white active:scale-[0.98]"
                    >
                      {whatsappLabel}
                    </button>
                  ) : null}

                  {ctaLabel ? (
                    <button
                      type="button"
                      onClick={handleCtaClick}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 text-[14px] font-bold text-white transition hover:brightness-125 hover:text-white active:scale-[0.98]"
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

          <EnquireModal
            open={enquireOpen}
            productTitle={product?.title || "this product"}
            onClose={() => setEnquireOpen(false)}
            onSubmit={submitEnquire}
          />
        </>
      )}
    </main>
  );
}
