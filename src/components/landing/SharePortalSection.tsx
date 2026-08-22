"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  QrCode,
  Smartphone,
  Box,
  Link2,
  Code,
  Copy,
  Check,
  ScanLine,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Printer,
  Package,
  ShoppingBag,
} from "lucide-react";
import QRCode from "qrcode";
import { CARD_SHADOW, DISPLAY, SECTION_PAD, useLandingMotionEnabled } from "./landingMotion";

const shareLinkText = "https://ar360studio.com/demo";
const embedCodeText =
  '<iframe src="https://ar360studio.com/demo" width="100%" height="560" style="border:0" allow="xr-spatial-tracking; fullscreen"></iframe>';

const AUTO_MS = 4500;

const steps = [
  {
    id: "qr",
    label: "Generate QR",
    who: "You in Studio",
    title: "Create a permanent product QR",
    desc: "One QR is tied to the product — not a one-off link. Update materials or swap the model later; the printed code still opens the latest experience.",
    tips: [
      "Generate once per product from QR Center",
      "Safe to print on packaging and catalogs",
      "Studio edits stay live without reprinting",
    ],
    action: "copy-link" as const,
    actionLabel: "Copy viewer link",
    icon: QrCode,
  },
  {
    id: "scan",
    label: "Customer scans",
    who: "Your customer",
    title: "Scan from print or shelf",
    desc: "Shoppers open the camera on any phone — packaging, poster, or showroom tag — and land straight in the product experience. No app download required.",
    tips: [
      "Works with iOS and Android cameras",
      "Ideal for catalogs, hangtags, and displays",
      "Same QR for online and offline buyers",
    ],
    action: "copy-link" as const,
    actionLabel: "Copy scan link",
    icon: ScanLine,
  },
  {
    id: "ar",
    label: "AR opens",
    who: "Browser on phone",
    title: "Browser AR launches instantly",
    desc: "Apple Quick Look or Google Scene Viewer opens in the browser. Buyers place the product in their space without installing your app or an AR toolkit.",
    tips: [
      "No App Store / Play Store friction",
      "Native AR viewers on modern phones",
      "Fallback 3D viewer if AR is unavailable",
    ],
    action: "copy-link" as const,
    actionLabel: "Copy AR link",
    icon: Smartphone,
  },
  {
    id: "room",
    label: "In the room",
    who: "True-scale view",
    title: "See it at real size at home",
    desc: "The model sits in the room at true scale — sofa against the wall, tile on the floor, lamp on the table — so size and fit stop being a guess before checkout.",
    tips: [
      "Reduces “too big / too small” returns",
      "Builds confidence for furniture & décor",
      "Share the view with family in one tap",
    ],
    action: "copy-link" as const,
    actionLabel: "Copy viewer link",
    icon: Box,
  },
  {
    id: "share",
    label: "Share link",
    who: "WhatsApp · Email · CRM",
    title: "Send one universal viewer link",
    desc: "The same permanent URL always shows the current model. Drop it in WhatsApp, email, or your CRM — sales and support stay in sync with Studio.",
    tips: [
      "One link for sales, support, and ads",
      "Always reflects the latest Studio publish",
      "Works on desktop and mobile browsers",
    ],
    action: "copy-link" as const,
    actionLabel: "Copy share link",
    icon: Link2,
  },
  {
    id: "embed",
    label: "Embed on site",
    who: "Your storefront",
    title: "Drop the viewer into any website",
    desc: "Paste one iframe on Shopify, WooCommerce, Webflow, or a custom site. Shoppers rotate, zoom, and launch AR without leaving the product page.",
    tips: [
      "Copy-paste embed — no SDK required",
      "Fits product pages and lookbooks",
      "Tracks engagement back in Analytics",
    ],
    action: "copy-embed" as const,
    actionLabel: "Copy embed code",
    icon: Code,
  },
];

export default function SharePortalSection({
  title,
  subtitle,
  description,
  steps: cmsSteps,
}: {
  title?: string;
  subtitle?: string;
  description?: string;
  steps?: { title: string; description: string; button_label?: string | null; button_link?: string | null }[];
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const [paused, setPaused] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const motionEnabled = useLandingMotionEnabled();
  const sectionRef = useRef<HTMLElement>(null);
  const resolvedSteps =
    cmsSteps && cmsSteps.length > 0
      ? steps.map((s, i) => {
          const c = cmsSteps[i];
          if (!c) return s;
          return {
            ...s,
            title: c.title || s.title,
            desc: c.description || s.desc,
            label: c.button_link || s.label,
          };
        })
      : steps;
  const step = resolvedSteps[active] || resolvedSteps[0];
  const autoPlay = motionEnabled && !paused && !hovering;
  const Icon = step.icon;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.35 });
  // One content speed for title + card + visual (matched)
  const contentY = useTransform(smooth, [0, 1], motionEnabled ? [28, -28] : [0, 0]);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(shareLinkText, {
      width: 280,
      margin: 1,
      color: { dark: "#111111", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    const len = resolvedSteps.length;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % len);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [autoPlay, resolvedSteps.length]);

  const goTo = (index: number) => {
    setActive(index);
    setPaused(true);
  };

  const goPrev = () => {
    const len = resolvedSteps.length;
    setActive((i) => (i - 1 + len) % len);
    setPaused(true);
  };

  const goNext = () => {
    const len = resolvedSteps.length;
    setActive((i) => (i + 1) % len);
    setPaused(true);
  };

  useEffect(() => {
    const len = resolvedSteps.length;
    function onKey(e: KeyboardEvent) {
      const section = document.getElementById("share-portal");
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25;
      if (!inView) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActive((i) => (i - 1 + len) % len);
        setPaused(true);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActive((i) => (i + 1) % len);
        setPaused(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resolvedSteps.length]);

  function copy(text: string, key: "link" | "embed") {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const progress = ((active + 1) / resolvedSteps.length) * 100;

  return (
    <section
      ref={sectionRef}
      id="share-portal"
      className={`relative overflow-x-clip bg-transparent ${SECTION_PAD}`}
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div style={{ y: contentY }} className="mx-auto mb-5 max-w-2xl text-center will-change-transform sm:mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B7078] sm:text-[11px]">
            {subtitle || "How it works"}
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-[32px] font-bold leading-[1.08] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            {title || "From QR to AR — one path."}
          </h2>
          {description ? (
            <p className="mx-auto mt-3 max-w-md text-[15px] font-medium leading-relaxed text-[#6B7078] sm:max-w-lg sm:text-sm">
              {description}
            </p>
          ) : (
            <p className="mx-auto mt-3 max-w-md text-[15px] font-medium leading-relaxed text-[#6B7078] sm:max-w-lg sm:text-sm">
              Print a QR, customer scans, AR opens on their phone — then share or embed the same
              experience on your site.
            </p>
          )}
        </motion.div>

        <motion.div style={{ y: contentY }} className="will-change-transform">
        <div className="mb-4 flex flex-col items-start gap-2.5 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <p className="text-[11px] font-bold text-[#8A9098] sm:text-[12px]">
            Step {active + 1} of {resolvedSteps.length}
            <span className="mx-2 text-[#D0D4DA]">·</span>
            <span className="text-[#6B7078]">{step.who}</span>
          </p>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#6B7078] backdrop-blur transition hover:border-[#D0D4DA] hover:text-[#111111]"
            aria-label={autoPlay ? "Pause autoplay" : "Resume autoplay"}
          >
            {autoPlay ? <Pause size={12} /> : <Play size={12} />}
            {autoPlay ? "Playing" : "Paused"}
          </button>
        </div>

        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#EEF0F2]/90">
          <motion.div
            className="h-full rounded-full bg-[#b9ff2c]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {/* Mobile step chips */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:hidden sm:mb-5" style={{ scrollbarWidth: "none" }}>
          {resolvedSteps.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === active;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
                  isActive
                    ? "bg-[#111111] text-white"
                    : "border border-[#E8EAED] bg-white/85 text-[#6B7078] backdrop-blur"
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
                    isActive ? "bg-[#b9ff2c] text-[#111111]" : "bg-[#F7F8FA] text-[#8A9098]"
                  }`}
                >
                  {i + 1}
                </span>
                <StepIcon size={13} />
                {s.label}
              </button>
            );
          })}
        </div>

        <div
          className={`grid overflow-hidden rounded-[24px] border border-white/70 bg-white/90 backdrop-blur-sm lg:grid-cols-[280px_1fr] lg:rounded-[28px] ${CARD_SHADOW}`}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {/* Desktop vertical rail */}
          <aside className="hidden border-b border-[#E8EAED] bg-white p-4 lg:block lg:border-b-0 lg:border-r">
            <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A9098]">
              Journey steps
            </p>
            <ol className="space-y-1">
              {resolvedSteps.map((s, i) => {
                const StepIcon = s.icon;
                const isActive = i === active;
                const passed = i < active;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        isActive
                          ? "bg-[#111111] text-white"
                          : "hover:bg-[#F7F8FA] text-[#6B7078]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                          isActive
                            ? "bg-[#b9ff2c] text-[#111111]"
                            : passed
                              ? "bg-[#EEFFD2] text-[#111111]"
                              : "bg-[#F0F1F3] text-[#8A9098]"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`flex items-center gap-1.5 text-[13px] font-bold ${
                            isActive ? "text-white" : "text-[#111111]"
                          }`}
                        >
                          <StepIcon size={13} className={isActive ? "text-[#b9ff2c]" : "text-[#66706B]"} />
                          {s.label}
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-[11px] font-medium ${
                            isActive ? "text-white/65" : "text-[#8A9098]"
                          }`}
                        >
                          {s.who}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* Detail + visual */}
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-center p-5 sm:p-8 lg:min-h-[420px] lg:p-9">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
                  exit={{ y: -6 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#E8EAED] bg-white px-3 py-1 text-[10px] font-bold text-[#6B7078] sm:text-[11px]">
                    <Icon size={12} className="text-[#b9ff2c]" />
                    {step.who}
                  </div>

                  <h3 className={`${DISPLAY} mt-4 text-[28px] font-bold leading-[1.08] text-[#111111] sm:text-[32px]`}>
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-[14px] font-medium leading-relaxed text-[#5C6168] sm:text-[15px]">
                    {step.desc}
                  </p>

                  <ul className="mt-5 space-y-2.5">
                    {step.tips.map((tip) => (
                      <li
                        key={tip}
                        className="flex items-start gap-2.5 text-[13px] font-semibold text-[#5C6168]"
                      >
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#b9ff2c] text-[#111111]">
                          <Check size={11} strokeWidth={3} />
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-7">
                    <button
                      type="button"
                      onClick={() =>
                        copy(
                          step.action === "copy-embed" ? embedCodeText : shareLinkText,
                          step.action === "copy-embed" ? "embed" : "link",
                        )
                      }
                      className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs font-bold transition hover:scale-[1.02] ${
                        step.action === "copy-embed"
                          ? "bg-[#b9ff2c] text-[#111111] hover:bg-[#a3f020]"
                          : "bg-[#111111] text-white hover:bg-[#222]"
                      }`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : step.actionLabel}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="grid h-11 w-11 place-items-center rounded-full border border-[#E8EAED] bg-white text-[#6B7078] transition hover:border-[#D0D4DA] hover:text-[#111111]"
                        aria-label="Previous step"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        className="grid h-11 w-11 place-items-center rounded-full border border-[#E8EAED] bg-white text-[#6B7078] transition hover:border-[#D0D4DA] hover:text-[#111111]"
                        aria-label="Next step"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative flex min-h-[260px] items-center justify-center border-t border-[#E8EAED] bg-gradient-to-br from-white to-[#EEF0F2] p-5 sm:min-h-[300px] sm:p-8 lg:min-h-full lg:border-l lg:border-t-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id + "-viz"}
                  initial={{ y: 8, scale: 0.98 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: -6 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-full max-w-[340px]"
                >
                  {(step.id === "qr" || step.id === "scan") && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="rounded-[24px] border border-[#E8EAED] bg-white p-5 shadow-lg">
                        {qrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrDataUrl}
                            alt="Demo product QR code"
                            width={168}
                            height={168}
                            className="block"
                          />
                        ) : (
                          <div className="h-[168px] w-[168px] animate-pulse rounded-lg bg-[#EEF0F2]" />
                        )}
                        <p className="mt-3 text-center text-[11px] font-bold text-[#6B7078]">
                          Permanent product QR
                        </p>
                      </div>
                      {step.id === "scan" && (
                        <div className="flex items-center gap-2 rounded-full border border-[#E8EAED] bg-white px-3 py-2 text-[11px] font-bold text-[#5C6168] shadow-sm">
                          <Printer size={13} className="text-[#b9ff2c]" />
                          Packaging · Poster · Hangtag
                        </div>
                      )}
                      {step.id === "qr" && (
                        <div className="flex items-center gap-2 rounded-full border border-[#E8EAED] bg-white px-3 py-2 text-[11px] font-bold text-[#5C6168] shadow-sm">
                          <Package size={13} className="text-[#b9ff2c]" />
                          Tied to one product ID
                        </div>
                      )}
                    </div>
                  )}

                  {(step.id === "ar" || step.id === "room") && (
                    <div className="relative mx-auto flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/home/ar-preview.webp"
                        alt="AR Experience Preview"
                        width={360}
                        height={640}
                        loading="lazy"
                        decoding="async"
                        className="h-[280px] w-auto object-contain drop-shadow-2xl sm:h-[320px]"
                      />
                      {step.id === "ar" && (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-3 select-none">
                          <div className="relative flex h-[82%] w-[85%] flex-col items-center justify-center overflow-hidden rounded-[24px] bg-black/15">
                            <style>{`
                              @keyframes arScannerLine {
                                0% { transform: translateY(0px); opacity: 0.3; }
                                50% { transform: translateY(160px); opacity: 1; }
                                100% { transform: translateY(0px); opacity: 0.3; }
                              }
                            `}</style>
                            <div className="relative z-10 flex h-14 w-14 items-center justify-center">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b9ff2c]/50 opacity-75" />
                              <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#b9ff2c] bg-[#111111]/90 shadow-lg">
                                <Smartphone size={16} className="text-[#b9ff2c]" />
                              </div>
                            </div>
                            <div
                              className="absolute left-0 right-0 top-2 h-0.5 bg-gradient-to-r from-transparent via-[#b9ff2c] to-transparent shadow-[0_0_10px_#b9ff2c]"
                              style={{ animation: "arScannerLine 3s ease-in-out infinite" }}
                            />
                            <span className="relative z-10 mt-3 rounded-full bg-[#111111] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#b9ff2c] shadow-lg">
                              Scanning surface…
                            </span>
                          </div>
                        </div>
                      )}
                      {step.id === "room" && (
                        <div className="absolute bottom-[16%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#b9ff2c] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#111111] shadow-lg select-none">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#111111]" />
                          Placed in space
                        </div>
                      )}
                    </div>
                  )}

                  {step.id === "share" && (
                    <div className="mx-auto max-w-[300px] space-y-3">
                      <div className="rounded-2xl border border-[#E8EAED] bg-white p-5 shadow-lg">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9098]">
                          Viewer URL
                        </p>
                        <p className="mt-2 break-all text-[13px] font-semibold text-[#111111]">
                          {shareLinkText}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["WhatsApp", "Email", "CRM"].map((ch) => (
                          <span
                            key={ch}
                            className="rounded-full border border-[#E8EAED] bg-white px-3 py-1.5 text-[11px] font-bold text-[#6B7078]"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.id === "embed" && (
                    <div className="mx-auto max-w-[320px] space-y-3">
                      <div className="rounded-2xl border border-[#1a1a1a] bg-[#111111] p-4 shadow-lg">
                        <div className="mb-2 flex items-center gap-2">
                          <Code size={12} className="text-[#b9ff2c]" />
                          <span className="text-[10px] font-bold text-[#A3A3A3]">embed.html</span>
                        </div>
                        <pre className="whitespace-pre-wrap break-all text-[10px] leading-relaxed text-[#E5E5E5]">
                          {embedCodeText}
                        </pre>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-[#E8EAED] bg-white px-3 py-2 text-[11px] font-bold text-[#5C6168] shadow-sm">
                        <ShoppingBag size={13} className="text-[#b9ff2c]" />
                        Shopify · Woo · Webflow · Custom
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        </motion.div>
      </div>
    </section>
  );
}
