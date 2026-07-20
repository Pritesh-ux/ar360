"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import QRCode from "qrcode";
import { CARD_SHADOW, DISPLAY, SECTION_PAD, usePrefersReducedMotion } from "./landingMotion";

const shareLinkText = "https://ar360.io/viewer/demo";
const embedCodeText =
  '<iframe src="https://ar360.io/embed/demo" width="100%" height="560" style="border:0" allow="xr-spatial-tracking; fullscreen"></iframe>';

const AUTO_MS = 3800;

const steps = [
  {
    id: "qr",
    label: "Generate QR",
    title: "Permanent product QR",
    desc: "One code for the product lifetime. Studio edits stay in sync.",
    icon: QrCode,
  },
  {
    id: "scan",
    label: "Phone scanning",
    title: "Customer scans",
    desc: "Printed on packaging, catalogs, or showroom posters.",
    icon: ScanLine,
  },
  {
    id: "ar",
    label: "AR opens",
    title: "Browser AR launches",
    desc: "Quick Look or Scene Viewer — no app install.",
    icon: Smartphone,
  },
  {
    id: "room",
    label: "In the room",
    title: "Product appears in space",
    desc: "True-scale placement builds buyer confidence.",
    icon: Box,
  },
  {
    id: "share",
    label: "Share link",
    title: "Universal viewer link",
    desc: "Send a permanent URL that always shows the latest model.",
    icon: Link2,
  },
  {
    id: "embed",
    label: "Embed code",
    title: "Drop into any site",
    desc: "Shopify, WooCommerce, Webflow, or custom storefronts.",
    icon: Code,
  },
];

export default function SharePortalSection() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const [paused, setPaused] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const pillsRef = useRef<HTMLDivElement>(null);
  const step = steps[active];
  const autoPlay = !reduced && !paused && !hovering;

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
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % steps.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [autoPlay]);

  useEffect(() => {
    const container = pillsRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (!container || !el) return;
    const left = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  const goTo = useCallback((index: number) => {
    setActive(index);
    setPaused(true);
  }, []);

  const goPrev = useCallback(() => {
    setActive((i) => (i - 1 + steps.length) % steps.length);
    setPaused(true);
  }, []);

  const goNext = useCallback(() => {
    setActive((i) => (i + 1) % steps.length);
    setPaused(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const section = document.getElementById("share-portal");
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25;
      if (!inView) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  function copy(text: string, key: "link" | "embed") {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const progress = ((active + 1) / steps.length) * 100;

  return (
    <section id="share-portal" className={`border-b border-[#E8EAED] bg-white ${SECTION_PAD}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
            Publish journey
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            From QR to AR — one path.
          </h2>
        </div>

        {/* Progress + pills */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold text-[#8A9098]">
            Step {active + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] bg-[#F7F8FA] px-3 py-1.5 text-[11px] font-bold text-[#6B7078] transition hover:border-[#D0D4DA] hover:text-[#111111]"
            aria-label={paused || hovering ? "Resume autoplay" : "Pause autoplay"}
          >
            {autoPlay ? <Pause size={12} /> : <Play size={12} />}
            {autoPlay ? "Auto" : "Paused"}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent sm:hidden" />

          <div
            ref={pillsRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === active;
              const passed = i < active;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-step={i}
                  onClick={() => goTo(i)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-bold transition hover:scale-[1.02] ${
                    isActive
                      ? "bg-[#111111] text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                      : passed
                        ? "border border-[#D8DBE0] bg-white text-[#111111] hover:border-[#111111]"
                        : "border border-[#E8EAED] bg-[#F7F8FA] text-[#6B7078] hover:border-[#D0D4DA] hover:bg-white hover:text-[#111111]"
                  }`}
                >
                  <Icon size={13} strokeWidth={2} />
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#EEF0F2]">
            <motion.div
              className="h-full rounded-full bg-[#B9FF2C]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <div
          className={`grid overflow-hidden rounded-[28px] border border-[#E8EAED] bg-[#F7F8FA] lg:grid-cols-[1fr_1.1fr] ${CARD_SHADOW}`}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <div className="relative flex flex-col justify-center p-7 sm:p-9 lg:min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A9098]">
                  Step {active + 1} / {steps.length}
                </span>
                <h3 className={`${DISPLAY} mt-3 text-2xl font-bold text-[#111111] sm:text-3xl`}>
                  {step.title}
                </h3>
                <p className="mt-3 max-w-md text-sm font-medium leading-relaxed text-[#5C6168]">
                  {step.desc}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {(step.id === "share" || step.id === "qr" || step.id === "scan") && (
                    <button
                      type="button"
                      onClick={() => copy(shareLinkText, "link")}
                      className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-bold transition hover:scale-[1.02] ${
                        step.id === "share"
                          ? "bg-[#111111] text-white"
                          : "border border-[#E8EAED] bg-white text-[#111111] hover:border-[#D0D4DA]"
                      }`}
                    >
                      {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
                      {copied === "link" ? "Copied" : "Copy link"}
                    </button>
                  )}
                  {step.id === "embed" && (
                    <button
                      type="button"
                      onClick={() => copy(embedCodeText, "embed")}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-[#B9FF2C] px-5 text-xs font-bold text-[#111111] transition hover:scale-[1.02] hover:bg-[#A7F11D]"
                    >
                      {copied === "embed" ? <Check size={14} /> : <Copy size={14} />}
                      {copied === "embed" ? "Copied" : "Copy embed"}
                    </button>
                  )}
                  {(step.id === "ar" || step.id === "room") && (
                    <button
                      type="button"
                      onClick={() => copy(shareLinkText, "link")}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E8EAED] bg-white px-5 text-xs font-bold text-[#111111] transition hover:scale-[1.02] hover:border-[#D0D4DA]"
                    >
                      {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
                      {copied === "link" ? "Copied" : "Copy viewer link"}
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E8EAED] bg-white text-[#6B7078] transition hover:border-[#D0D4DA] hover:text-[#111111]"
                aria-label="Previous step"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E8EAED] bg-white text-[#6B7078] transition hover:border-[#D0D4DA] hover:text-[#111111]"
                aria-label="Next step"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[280px] items-center justify-center border-t border-[#E8EAED] bg-gradient-to-br from-white to-[#EEF0F2] p-8 lg:border-l lg:border-t-0 lg:min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id + "-viz"}
                initial={{ opacity: 0, x: 20, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -16, scale: 1.02 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                {(step.id === "qr" || step.id === "scan") && (
                  <div className="flex items-end gap-4">
                    {step.id === "scan" && (
                      <div className="rounded-[20px] border-[3px] border-[#111111] bg-[#111111] p-1.5">
                        <div className="flex h-[180px] w-[90px] flex-col items-center justify-center rounded-[14px] bg-[#F4F5F6]">
                          <ScanLine size={28} className="text-[#84D400]" />
                          <span className="mt-2 text-[8px] font-bold text-[#6B7078]">Scanning…</span>
                        </div>
                      </div>
                    )}
                    <div
                      className={`rounded-[24px] border border-[#E8EAED] bg-white p-4 shadow-lg ${
                        step.id === "scan" ? "mb-6 p-3" : "p-5"
                      }`}
                    >
                      {qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrDataUrl}
                          alt="Demo product QR code"
                          width={step.id === "scan" ? 72 : 148}
                          height={step.id === "scan" ? 72 : 148}
                          className="block"
                        />
                      ) : (
                        <div
                          className={`animate-pulse rounded-lg bg-[#EEF0F2] ${
                            step.id === "scan" ? "h-[72px] w-[72px]" : "h-[148px] w-[148px]"
                          }`}
                        />
                      )}
                    </div>
                  </div>
                )}

                {(step.id === "ar" || step.id === "room") && (
                  <div className="rounded-[20px] border-[3px] border-[#111111] bg-[#111111] p-1.5 shadow-xl">
                    <div className="relative flex h-[220px] w-[110px] flex-col items-center justify-end overflow-hidden rounded-[14px] bg-gradient-to-b from-[#C8D4E0] to-[#9AABB8] pb-4">
                      <div className="absolute inset-x-4 top-10 h-24 rounded-2xl bg-white/40 backdrop-blur-sm" />
                      <div className="relative z-10 h-16 w-16 rounded-xl bg-white/90 shadow-md" />
                      <span className="relative z-10 mt-2 rounded-full bg-[#B9FF2C] px-2 py-0.5 text-[8px] font-black text-[#111111]">
                        {step.id === "ar" ? "AR Ready" : "In Room"}
                      </span>
                    </div>
                  </div>
                )}

                {step.id === "share" && (
                  <div className="max-w-[280px] rounded-2xl border border-[#E8EAED] bg-white p-5 shadow-lg">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9098]">
                      Viewer URL
                    </p>
                    <p className="mt-2 break-all text-[12px] font-semibold text-[#111111]">
                      {shareLinkText}
                    </p>
                  </div>
                )}

                {step.id === "embed" && (
                  <div className="max-w-[300px] rounded-2xl border border-[#1a1a1a] bg-[#111111] p-4 shadow-lg">
                    <div className="mb-2 flex items-center gap-2">
                      <Code size={12} className="text-[#B9FF2C]" />
                      <span className="text-[10px] font-bold text-[#A3A3A3]">embed.html</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[10px] leading-relaxed text-[#E5E5E5]">
                      {embedCodeText}
                    </pre>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
