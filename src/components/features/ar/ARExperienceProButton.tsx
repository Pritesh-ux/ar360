"use client";

import { useMemo, useState, type ReactNode, type RefObject } from "react";
import ViewportPortal from "@/components/shared/ViewportPortal";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Copy,
  Focus,
  Hand,
  Loader2,
  Move,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import QrCodePreview, { type QrPreviewItem } from "@/components/user-panel/QrCodePreview";
import { resolveQrCenterLogo } from "@/lib/growth/qr-logo-shared";
import { viewerBrandStyle } from "@/lib/branding/contrast";
import {
  buildSceneViewerIntent,
  detectARDevice,
  getAbsoluteUrl,
  getARInstruction,
  getCleanViewerUrl,
  getPhoneShareViewerUrl,
  getProductKey,
  openQuickLookAr,
  saveARReturnState,
  trackARExperienceEvent,
  type ARExperienceProduct,
} from "@/lib/ar-experience";

function tutorialStorageKey(placement: "floor" | "wall") {
  return `ar360_ar_${placement}_tutorial_v1`;
}

/** Scene Viewer ignores <model-viewer scale> — read the live attribute as fallback. */
function readLiveArModelScale(
  viewer: any,
  fallback?: number | null,
): number | null {
  const fromProp = Number(fallback);
  if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;

  try {
    const raw = String(viewer?.getAttribute?.("scale") || viewer?.scale || "").trim();
    const first = Number(raw.split(/\s+/)[0]);
    if (Number.isFinite(first) && first > 0) return first;
  } catch {
    // ignore
  }
  return null;
}

type Props = {
  product: ARExperienceProduct;
  viewerRef?: RefObject<any>;
  viewerUrl?: string;
  className?: string;
  children?: ReactNode;
  title?: string;
  "aria-label"?: string;
  brandLogoUrl?: string | null;
  brandColor?: string | null;
  brandAccentColor?: string | null;
  /**
   * In-browser Studio Look AR (camera + same model-viewer lighting).
   * Used on iPhone and Android so color matches the 3D viewer.
   */
  onStudioLookAr?: (stream?: MediaStream) => void;
};

export default function ARExperienceProButton({
  product,
  viewerRef,
  viewerUrl,
  className = "",
  children,
  title = "View in AR",
  "aria-label": ariaLabel = "View in AR",
  brandLogoUrl,
  brandColor,
  brandAccentColor,
  onStudioLookAr: _onStudioLookAr,
}: Props) {
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [skipTutorialNextTime, setSkipTutorialNextTime] = useState(false);

  const productId = getProductKey(product, "unknown");
  const device = useMemo(() => detectARDevice(), []);
  const placement = product.arPlacement === "wall" ? "wall" : "floor";
  const instruction = getARInstruction(device, placement);
  const cleanViewerUrl = getCleanViewerUrl(viewerUrl);
  const phoneShareUrl = getPhoneShareViewerUrl(viewerUrl);
  const isDesktop = device === "desktop" || device === "unknown";

  const brandedArQrItem = useMemo<QrPreviewItem | null>(() => {
    if (!phoneShareUrl || !isDesktop) return null;
    const qrLogo = resolveQrCenterLogo({
      customLogoUrl: brandLogoUrl,
      allowCustomBranding: Boolean(String(brandLogoUrl || "").trim()),
    });
    return {
      id: `ar-phone-${productId}`,
      productId,
      destinationUrl: phoneShareUrl,
      foregroundColor: "#111111",
      backgroundColor: "#FFFFFF",
      patternStyle: "square",
      cornerStyle: "square",
      logoUrl: qrLogo.logoUrl,
      logoSize: qrLogo.logoSize,
      frameEnabled: false,
      frameStyle: "simple",
      frameColor: "#111111",
      frameText: "",
    };
  }, [phoneShareUrl, isDesktop, productId, brandLogoUrl]);

  function openOnboarding(event?: { isTrusted?: boolean }) {
    setError("");
    setCopied(false);
    setSkipTutorialNextTime(false);
    trackARExperienceEvent(productId, "ar_onboarding_open", { device, placement });

    let skipTutorial = false;
    try {
      skipTutorial =
        !isDesktop
        && typeof window !== "undefined"
        && window.localStorage.getItem(tutorialStorageKey(placement)) === "1";
    } catch {
      skipTutorial = false;
    }

    setOpen(true);
    // Programmatic clicks (openAR=1) are not isTrusted — never auto getUserMedia.
    // Real user taps may skip the sheet when they opted out of the tutorial.
    if (skipTutorial && event?.isTrusted) {
      void launchAR();
    }
  }

  async function copyViewerLink() {
    if (!phoneShareUrl) return;

    try {
      await navigator.clipboard.writeText(phoneShareUrl);
      setCopied(true);
      trackARExperienceEvent(productId, "ar_link_copy", { device });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Could not copy the viewer link. Please copy it from the browser address bar.");
    }
  }

  async function shareViewerLink() {
    if (!phoneShareUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: product.title || "3D Product",
          text: "Open this product in 3D / AR on your phone.",
          url: phoneShareUrl,
        });
        trackARExperienceEvent(productId, "ar_mobile_share", { device, method: "native" });
        return;
      }

      await copyViewerLink();
    } catch {
      // User dismissed native share sheet.
    }
  }

  async function launchWithModelViewer() {
    const viewer = viewerRef?.current;
    if (!viewer?.activateAR) return false;

    await viewer.updateComplete;
    try {
      viewer.setAttribute?.(
        "ar-placement",
        product.arPlacement === "wall" ? "wall" : "floor",
      );
    } catch {
      // ignore
    }

    try {
      viewer.setAttribute?.(
        "ar-scale",
        product.realScale === true ? "fixed" : "auto",
      );
    } catch {
      // ignore
    }

    // Set ios-src so model-viewer can hand off to Quick Look when USDZ exists.
    try {
      const usdzAbs = product.usdzUrl ? getAbsoluteUrl(product.usdzUrl) : "";
      if (usdzAbs) {
        viewer.setAttribute?.("ios-src", usdzAbs);
      }
    } catch {
      // ignore
    }

    // Keep Scene Viewer + Quick Look as fallbacks. WebXR-only made floor
    // placement fail on many Android phones compared with Google Scene Viewer.
    try {
      viewer.setAttribute?.("ar-modes", "webxr scene-viewer quick-look");
    } catch {
      // ignore
    }

    const arScale = readLiveArModelScale(viewer, product.arModelScale);
    const needsBakedScale =
      arScale != null && Number.isFinite(arScale) && arScale > 0 && Math.abs(arScale - 1) >= 1e-9;

    if (needsBakedScale && arScale != null) {
      try {
        const attr = `${arScale} ${arScale} ${arScale}`;
        viewer.setAttribute?.("scale", attr);
        try {
          viewer.scale = attr;
        } catch {
          // attribute is enough
        }
      } catch {
        // ignore
      }
    }

    await viewer.activateAR();
    return true;
  }

  async function launchAR() {
    setLaunching(true);
    setError("");
    trackARExperienceEvent(productId, "ar_launch_attempt", { device, placement });
    saveARReturnState(productId, cleanViewerUrl);

    if (skipTutorialNextTime && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(tutorialStorageKey(placement), "1");
      } catch {
        // ignore
      }
    }

    try {
      const modelBytes = Number(product.modelBytes) || 0;
      const hasArLite = Boolean(product.arModelUrl);
      const hasUsdz = Boolean(product.usdzUrl);
      // In-tab activateAR() keeps the full GLB in Safari memory — OOM on large files.
      const tooHeavyInPage = modelBytes > 35 * 1024 * 1024;
      const liveScale = readLiveArModelScale(
        viewerRef?.current,
        product.arModelScale,
      );
      const productForAr: ARExperienceProduct = {
        ...product,
        arModelScale: liveScale,
      };

      // Prefer native ARKit Quick Look / Google Scene Viewer — not in-tab Studio AR.
      if (device === "android") {
        if (!product.modelUrl && !product.arModelUrl) {
          throw new Error("Android AR needs a GLB model URL.");
        }
        window.location.href = buildSceneViewerIntent(productForAr, cleanViewerUrl);
        trackARExperienceEvent(productId, "ar_launch_success", {
          mode: "scene-viewer",
          device,
          lite: hasArLite,
          arModelScale: liveScale,
        });
        return;
      }

      if (device === "ios") {
        if (hasUsdz && openQuickLookAr(product, cleanViewerUrl)) {
          trackARExperienceEvent(productId, "ar_launch_success", {
            mode: "quick-look",
            device,
          });
          setOpen(false);
          return;
        }

        // Set ios-src so model-viewer can hand off to Quick Look when USDZ exists.
        if (hasUsdz) {
          try {
            const usdz = product.usdzUrl || "";
            viewerRef?.current?.setAttribute?.("ios-src", usdz);
          } catch {
            // ignore
          }
        }

        if (!(tooHeavyInPage && !hasArLite && !hasUsdz)) {
          try {
            const launchedByModelViewer = await launchWithModelViewer();
            if (launchedByModelViewer) {
              trackARExperienceEvent(productId, "ar_launch_success", {
                mode: "model-viewer",
                device,
                lite: hasArLite,
              });
              setOpen(false);
              return;
            }
          } catch {
            // Fall through.
          }
        }

        // Native Quick Look / model-viewer only — do not open in-tab Studio AR.
        throw new Error(
          "iPhone AR needs a USDZ file for Apple Quick Look (ARKit). Upload a USDZ for this product in the dashboard.",
        );
      }

      trackARExperienceEvent(productId, "ar_unsupported", { device });
      setError("AR opens on a phone. Scan the QR or copy the link below.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "AR launch failed. Try again on a supported mobile browser.";
      setError(message);
      trackARExperienceEvent(productId, "ar_launch_failed", { device, message });
    } finally {
      setLaunching(false);
    }
  }

  const surfaceLabel = placement === "wall" ? "wall" : "floor";
  const placementHint =
    placement === "wall"
      ? "This product places on a wall or vertical surface."
      : "This product places on the floor or a flat surface.";

  const tutorialSteps =
    placement === "wall"
      ? [
          {
            icon: Camera,
            title: "Allow camera access",
            text:
              device === "ios"
                ? "Apple Quick Look (ARKit) will ask for camera access so you can place the product on a wall."
                : "Google Scene Viewer will ask for camera access so you can place the product on a wall.",
          },
          {
            icon: Move,
            title: "Point at the wall",
            text: "Hold the phone upright and aim at the wall or surface where the product should sit.",
          },
          {
            icon: Focus,
            title: "Tap to place",
            text: "When a surface is found, tap to place. Drag to move, pinch to resize (unless real-scale is locked).",
          },
          {
            icon: Hand,
            title: "Close when done",
            text: "Use the system AR close control to return to the 3D viewer.",
          },
        ]
      : [
          {
            icon: Camera,
            title: "Allow camera access",
            text:
              device === "ios"
                ? "Apple Quick Look (ARKit) opens outside the page — allow camera when prompted."
                : "Google Scene Viewer opens outside the page — allow camera when prompted.",
          },
          {
            icon: Move,
            title: "Find the floor or table",
            text: "Move your phone slowly until the surface is detected, then tap to place the product.",
          },
          {
            icon: Focus,
            title: "Native phone AR",
            text:
              device === "ios"
                ? "This uses Apple Quick Look / ARKit — not the in-browser Studio preview."
                : "This uses Google Scene Viewer — not the in-browser Studio preview.",
          },
          {
            icon: Hand,
            title: "Move and resize",
            text: "Drag to move, pinch to resize. Close AR to return to the viewer.",
          },
        ];

  return (
    <>
      <button
        type="button"
        data-ar-pro-launch
        onClick={(event) => openOnboarding(event)}
        className={className}
        title={title}
        aria-label={ariaLabel}
      >
        {children || (
          <>
            <Smartphone size={18} />
            View in AR
          </>
        )}
      </button>

      {open && (
        <ViewportPortal>
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => !launching && setOpen(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={viewerBrandStyle(brandColor, brandAccentColor)}
            className="flex w-full max-w-[420px] max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {instruction.deviceLabel} · AR tutorial
                </p>
                <h2 className="mt-1 text-[22px] font-black leading-tight text-slate-950">
                  {isDesktop ? "Open on your phone" : "See it in your room"}
                </h2>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-500">
                  {isDesktop
                    ? "Scan the QR code or copy the link. On phones, AR opens in Apple Quick Look or Google Scene Viewer."
                    : device === "ios"
                      ? product.usdzUrl
                        ? "Quick guide before Apple Quick Look (ARKit) opens."
                        : "This product has no USDZ yet — Apple Quick Look needs a USDZ file for ARKit."
                      : "Quick guide before Google Scene Viewer opens."}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                  {placement === "wall"
                    ? "This product hangs on a wall"
                    : "This product stands on the floor"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={launching}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"
                aria-label="Close AR guide"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {isDesktop ? (
                <div className="space-y-4">
                  <div className="mx-auto grid w-fit place-items-center rounded-2xl border border-slate-200 bg-white p-3">
                    {brandedArQrItem ? (
                      <QrCodePreview item={brandedArQrItem} size={180} />
                    ) : (
                      <div className="grid h-[180px] w-[180px] place-items-center text-sm font-semibold text-slate-400">
                        Preparing QR…
                      </div>
                    )}
                  </div>

                  <p className="text-center text-[12px] font-semibold text-slate-500">{placementHint}</p>

                  <p className="break-all rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
                    {phoneShareUrl || "Viewer link unavailable"}
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={copyViewerLink}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#111111] text-[13px] font-bold text-white transition hover:brightness-125 hover:text-white"
                    >
                      <Copy size={15} />
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={shareViewerLink}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--ar-primary)] text-[13px] font-bold text-[var(--ar-on-primary)] transition hover:brightness-110 hover:text-[var(--ar-on-primary)]"
                    >
                      <Share2 size={15} />
                      Share
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tutorialSteps.map((step, index) => (
                    <TutorialStep
                      key={step.title}
                      n={index + 1}
                      icon={step.icon}
                      title={step.title}
                      text={step.text}
                    />
                  ))}
                  <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3.5 py-3 text-[12px] font-semibold leading-relaxed text-amber-900">
                    Tip: On iPhone this opens Apple Quick Look (ARKit). On Android it opens Google Scene Viewer.
                  </p>
                  <label className="mt-1 flex items-center gap-2 text-[12px] font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={skipTutorialNextTime}
                      onChange={(event) => setSkipTutorialNextTime(event.target.checked)}
                    />
                    Don&apos;t show this guide next time
                  </label>
                </div>
              )}

              {error ? (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <p className="text-[13px] font-semibold leading-relaxed">{error}</p>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 space-y-2 border-t border-slate-100 px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {!isDesktop ? (
                <button
                  type="button"
                  onClick={() => void launchAR()}
                  disabled={launching}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ar-primary)] text-[14px] font-bold text-[var(--ar-on-primary)] transition hover:brightness-110 hover:text-[var(--ar-on-primary)] disabled:opacity-70"
                >
                  {launching ? <Loader2 size={17} className="animate-spin" /> : <Smartphone size={17} />}
                  {launching ? "Opening AR…" : "Got it — open AR"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={launching}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-[13px] font-bold text-slate-700 disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Stay in 3D viewer
              </button>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}
    </>
  );
}

function TutorialStep({
  n,
  icon: Icon,
  title,
  text,
}: {
  n: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-3.5 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className="text-[var(--ar-primary)]" />
          <p className="text-[13px] font-black text-slate-900">{title}</p>
        </div>
        <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-600">{text}</p>
      </div>
    </div>
  );
}
