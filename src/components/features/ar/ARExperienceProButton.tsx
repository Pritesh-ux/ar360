"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  BrickWall,
  Copy,
  Loader2,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import {
  buildQuickLookUrl,
  buildSceneViewerIntent,
  detectARDevice,
  getARInstruction,
  getCleanViewerUrl,
  getPhoneShareViewerUrl,
  getProductKey,
  saveARReturnState,
  trackARExperienceEvent,
  type ARExperienceProduct,
} from "@/lib/ar-experience";

type Props = {
  product: ARExperienceProduct;
  viewerRef?: RefObject<any>;
  viewerUrl?: string;
  className?: string;
  children?: ReactNode;
  title?: string;
  "aria-label"?: string;
};

export default function ARExperienceProButton({
  product,
  viewerRef,
  viewerUrl,
  className = "",
  children,
  title = "View in AR",
  "aria-label": ariaLabel = "View in AR",
}: Props) {
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const productId = getProductKey(product, "unknown");
  const device = useMemo(() => detectARDevice(), []);
  const placement = product.arPlacement === "wall" ? "wall" : "floor";
  const instruction = getARInstruction(device, placement);
  const cleanViewerUrl = getCleanViewerUrl(viewerUrl);
  const phoneShareUrl = getPhoneShareViewerUrl(viewerUrl);
  const isDesktop = device === "desktop" || device === "unknown";

  useEffect(() => {
    if (!open || !phoneShareUrl || !isDesktop) {
      setQrDataUrl("");
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(phoneShareUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [open, phoneShareUrl, isDesktop]);

  function openOnboarding() {
    setError("");
    setCopied(false);
    setOpen(true);
    trackARExperienceEvent(productId, "ar_onboarding_open", { device });
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
    await viewer.activateAR();
    return true;
  }

  async function launchAR() {
    setLaunching(true);
    setError("");
    trackARExperienceEvent(productId, "ar_launch_attempt", { device });
    saveARReturnState(productId, cleanViewerUrl);

    try {
      if (device === "android") {
        try {
          const launchedByModelViewer = await launchWithModelViewer();
          if (launchedByModelViewer) {
            trackARExperienceEvent(productId, "ar_launch_success", { mode: "model-viewer", device });
            setOpen(false);
            return;
          }
        } catch {
          // Continue to Scene Viewer fallback below.
        }

        if (!product.modelUrl) throw new Error("Android AR needs a GLB model URL.");
        window.location.href = buildSceneViewerIntent(product, cleanViewerUrl);
        trackARExperienceEvent(productId, "ar_launch_success", { mode: "scene-viewer", device });
        return;
      }

      if (device === "ios") {
        try {
          const launchedByModelViewer = await launchWithModelViewer();
          if (launchedByModelViewer) {
            trackARExperienceEvent(productId, "ar_launch_success", { mode: "model-viewer", device });
            setOpen(false);
            return;
          }
        } catch {
          // Continue to Quick Look fallback below.
        }

        const quickLookUrl = buildQuickLookUrl(product, cleanViewerUrl);
        if (!quickLookUrl) {
          throw new Error("iPhone AR needs a USDZ file. Add USDZ export for best iPhone AR support.");
        }

        window.location.href = quickLookUrl;
        trackARExperienceEvent(productId, "ar_launch_success", { mode: "quick-look", device });
        return;
      }

      trackARExperienceEvent(productId, "ar_unsupported", { device });
      setError("AR opens on a phone. Scan the QR or copy the link below.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AR launch failed. Try again on a supported mobile browser.";
      setError(message);
      trackARExperienceEvent(productId, "ar_launch_failed", { device, message });
    } finally {
      setLaunching(false);
    }
  }

  const placementLabel = placement === "wall" ? "Wall" : "Floor";
  const placementHint =
    placement === "wall"
      ? "This product places on a wall or vertical surface."
      : "This product places on the floor or a flat surface.";

  return (
    <>
      <button
        type="button"
        data-ar-pro-launch
        onClick={openOnboarding}
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
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => !launching && setOpen(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-[400px] max-h-[min(90vh,640px)] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {instruction.deviceLabel}
                </p>
                <h2 className="mt-1 text-[22px] font-black leading-tight text-slate-950">
                  {isDesktop ? "Open on your phone" : instruction.title}
                </h2>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-500">
                  {isDesktop
                    ? "Scan the QR code or copy the link. AR works on Android Chrome and iPhone Safari."
                    : instruction.description}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                  text={
                    placement === "wall"
                      ? "This product hangs on a wall"
                      : "This product stands on the floor"
                  }
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
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR code to open AR on phone" className="h-[180px] w-[180px]" />
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
                      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-[13px] font-bold text-white"
                    >
                      <Copy size={15} />
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={shareViewerLink}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#84D400] text-[13px] font-bold text-slate-950"
                    >
                      <Share2 size={15} />
                      Share
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Step n={1} text="Hold your phone and move slowly" />
                  <Step
                    n={2}
                    text={
                      placement === "wall"
                        ? "Point at a wall until a surface is found"
                        : "Point at the floor until a surface is found"
                    }
                  />
                  <Step n={3} text="Tap to place the product" />
                  <p className="pt-1 text-[12px] font-semibold text-slate-500">{placementHint}</p>
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
                  onClick={launchAR}
                  disabled={launching}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#84D400] text-[14px] font-bold text-slate-950 disabled:opacity-70"
                >
                  {launching ? <Loader2 size={17} className="animate-spin" /> : <Smartphone size={17} />}
                  {launching ? "Opening AR…" : instruction.primary}
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
      )}
    </>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">
        {n}
      </span>
      <span className="text-[13px] font-bold text-slate-700">{text}</span>
    </div>
  );
}
