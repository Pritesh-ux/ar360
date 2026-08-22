"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Globe2,
  Play,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import ViewportPortal from "@/components/shared/ViewportPortal";

const DISMISS_KEY = "ar360:free-trial-popup-dismissed";
const DEFAULT_PHONE_IMAGE = "/home/free-trial-ar-phone.png";

const DEFAULTS = {
  badge: "Limited time offer",
  title: "Try *AR360* Studio\n*FREE* for 7 Days!",
  description:
    "Create immersive 3D and browser AR product experiences in minutes. *No credit card required.*",
  primaryLabel: "Start free trial",
  secondaryLabel: "See how it works",
  scanTitle: "Scan to experience",
  scanNote: "Browser AR · No app",
  primaryHref: "/signup",
  secondaryHref: "#how-it-works",
};

const benefits = [
  { icon: QrCode, title: "Permanent QR", copy: "Share anywhere" },
  { icon: Globe2, title: "Browser AR", copy: "No app required" },
  { icon: ShieldCheck, title: "No card needed", copy: "Start instantly" },
  { icon: BarChart3, title: "Live analytics", copy: "Track engagement" },
];

const assurances = ["No setup fees", "Instant access", "Cancel anytime"];

export type FreeTrialPopupProps = {
  badge?: string | null;
  title?: string | null;
  description?: string | null;
  primaryLabel?: string | null;
  secondaryLabel?: string | null;
  scanTitle?: string | null;
  scanNote?: string | null;
  phoneImage?: string | null;
  phoneImageMobile?: string | null;
  primaryHref?: string | null;
  secondaryHref?: string | null;
  /** When true (CMS preview), open immediately and skip dismiss persistence. */
  forceOpen?: boolean;
};

/** `*word*` marks lime-highlighted copy so admins can style text without HTML. */
function renderHighlighted(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, index) => {
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return (
        <span key={index} className="text-[#b9ff2c]">
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function textOr(value: string | null | undefined, fallback: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}

export default function FreeTrialPopup(props: FreeTrialPopupProps) {
  const [open, setOpen] = useState(Boolean(props.forceOpen));
  const [shown, setShown] = useState(Boolean(props.forceOpen));

  const badge = textOr(props.badge, DEFAULTS.badge);
  const title = textOr(props.title, DEFAULTS.title);
  const description = textOr(props.description, DEFAULTS.description);
  const primaryLabel = textOr(props.primaryLabel, DEFAULTS.primaryLabel);
  const secondaryLabel = textOr(props.secondaryLabel, DEFAULTS.secondaryLabel);
  const scanTitle = textOr(props.scanTitle, DEFAULTS.scanTitle);
  const scanNote = textOr(props.scanNote, DEFAULTS.scanNote);
  const phoneImage = textOr(props.phoneImage, DEFAULT_PHONE_IMAGE);
  const phoneImageMobile = textOr(props.phoneImageMobile, phoneImage);
  const [desktopPhoneSrc, setDesktopPhoneSrc] = useState(phoneImage);
  const [mobilePhoneSrc, setMobilePhoneSrc] = useState(phoneImageMobile);
  const primaryHref = textOr(props.primaryHref, DEFAULTS.primaryHref);
  const secondaryHref = textOr(props.secondaryHref, DEFAULTS.secondaryHref);

  useEffect(() => {
    setDesktopPhoneSrc(phoneImage);
  }, [phoneImage]);

  useEffect(() => {
    setMobilePhoneSrc(phoneImageMobile);
  }, [phoneImageMobile]);

  // Safe to read during render: the dialog only mounts after hydration, so the
  // origin-based URL never takes part in a server/client markup comparison.
  const trialUrl =
    typeof window === "undefined"
      ? "https://ar360studio.com/signup"
      : primaryHref.startsWith("http")
        ? primaryHref
        : `${window.location.origin}${primaryHref.startsWith("/") ? primaryHref : `/${primaryHref}`}`;

  useEffect(() => {
    if (props.forceOpen) return;
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // private mode — still show the offer
    }
    if (dismissed) return;

    const timer = window.setTimeout(() => setOpen(true), 650);
    return () => window.clearTimeout(timer);
  }, [props.forceOpen]);

  // Slide in from the right edge once mounted.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const close = useCallback(() => {
    // Continue the right-to-left motion on the way out, then unmount.
    setShown(false);
    if (!props.forceOpen) {
      try {
        window.sessionStorage.setItem(DISMISS_KEY, "1");
      } catch {
        // dismissal is a nicety, never block closing on it
      }
    }
    window.setTimeout(() => setOpen(false), 280);
  }, [props.forceOpen]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, close]);

  return (
    <ViewportPortal open={open}>
      <div
        className={`fixed inset-0 z-[100100] flex items-center justify-center overflow-y-auto bg-[#02090d]/80 p-3 backdrop-blur-md transition-opacity duration-300 sm:p-5 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-trial-title"
          className={`relative my-auto max-h-[94vh] w-full max-w-[1040px] overflow-y-auto overflow-x-hidden rounded-[26px] border border-white/15 bg-[#06181d] text-white shadow-[0_32px_100px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out motion-reduce:transition-none sm:rounded-[34px] ${
            shown ? "translate-x-0 opacity-100" : "translate-x-[12%] opacity-0"
          }`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(185,255,44,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(185,255,44,0.055) 1px, transparent 1px)",
              backgroundSize: "34px 34px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-8 h-80 w-80 rounded-full bg-[#b9ff2c]/10 blur-3xl"
          />

          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-[#0A252B]/90 text-white transition hover:border-[#b9ff2c]/60 hover:text-[#b9ff2c] sm:right-5 sm:top-5 sm:h-11 sm:w-11"
            aria-label="Close free trial offer"
          >
            <X size={20} />
          </button>

          <div className="relative grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col p-5 sm:p-8 lg:p-10">
              <BrandLogo href={null} tone="dark" variant="wordmark" size={36} />

              <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#b9ff2c]/45 bg-[#b9ff2c]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#b9ff2c] sm:text-[11px]">
                <Clock3 size={13} />
                {badge}
              </div>

              <h2
                id="free-trial-title"
                className="mt-4 max-w-[600px] text-[34px] font-black leading-[1] tracking-[-0.045em] sm:text-[48px] lg:text-[56px]"
              >
                {title.split("\n").map((line, index) => (
                  <span key={index} className={index === 0 ? "block" : "mt-1 block"}>
                    {renderHighlighted(line)}
                  </span>
                ))}
              </h2>

              <p className="mt-4 max-w-[540px] text-[13px] font-medium leading-6 text-slate-300 sm:text-[15px]">
                {renderHighlighted(description)}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {benefits.map(({ icon: Icon, title: label, copy }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 backdrop-blur-sm"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#b9ff2c]/10 text-[#b9ff2c]">
                      <Icon size={17} />
                    </span>
                    <p className="mt-2 text-[12px] font-extrabold leading-tight text-white">{label}</p>
                    <p className="mt-0.5 text-[10px] font-medium leading-tight text-slate-400">{copy}</p>
                  </div>
                ))}
              </div>

              {/* Mobile keeps a compact scan card instead of the full render panel. */}
              <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#b9ff2c]/25 lg:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mobilePhoneSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-30"
                  aria-hidden
                  onError={() => {
                    if (mobilePhoneSrc !== DEFAULT_PHONE_IMAGE) setMobilePhoneSrc(DEFAULT_PHONE_IMAGE);
                  }}
                />
                <div className="relative flex items-center gap-3 bg-[#0A252B]/70 p-3">
                <span className="inline-grid size-[68px] shrink-0 place-items-center rounded-none bg-white p-1.5 shadow-sm">
                  <QRCodeSVG
                    value={trialUrl}
                    size={56}
                    bgColor="#ffffff"
                    fgColor="#07181D"
                    level="M"
                    includeMargin={false}
                    className="block h-[56px] w-[56px] rounded-none"
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-black leading-tight">{scanTitle}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                    Opens AR in your browser — no app install.
                  </p>
                </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Link
                  href={primaryHref}
                  onClick={close}
                  className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#b9ff2c] px-6 text-[14px] font-black text-[#081014] shadow-[0_16px_38px_rgba(185,255,44,0.22)] transition hover:-translate-y-0.5 hover:bg-[#a3f020] sm:h-[52px] sm:flex-1"
                >
                  {primaryLabel}
                  <ArrowRight size={18} strokeWidth={2.8} />
                </Link>
                <Link
                  href={secondaryHref}
                  onClick={close}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 text-[14px] font-bold text-white transition hover:border-white/30 hover:bg-white/10 sm:h-[52px] sm:w-auto"
                >
                  <Play size={15} fill="currentColor" />
                  {secondaryLabel}
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-400">
                {assurances.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <span className="grid h-4 w-4 place-items-center rounded-full border border-white/35 text-[#b9ff2c]">
                      <Check size={10} strokeWidth={3} />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative hidden overflow-hidden lg:block" data-cms-target="popup">
              <Image
                src={desktopPhoneSrc}
                alt="AR360 product preview running in a phone browser"
                fill
                priority
                sizes="500px"
                className="object-cover object-center"
                onError={() => {
                  if (desktopPhoneSrc !== DEFAULT_PHONE_IMAGE) setDesktopPhoneSrc(DEFAULT_PHONE_IMAGE);
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#06181d] via-transparent to-transparent" />

              <div className="absolute bottom-8 right-7 flex items-center gap-3 rounded-[22px] border border-[#b9ff2c]/35 bg-[#07181D]/90 p-3 pr-5 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <span className="inline-grid size-[84px] shrink-0 place-items-center rounded-none bg-white p-2 shadow-sm">
                  <QRCodeSVG
                    value={trialUrl}
                    size={68}
                    bgColor="#ffffff"
                    fgColor="#07181D"
                    level="M"
                    includeMargin={false}
                    className="block h-[68px] w-[68px] rounded-none"
                  />
                </span>
                <div>
                  <p className="text-[13px] font-black leading-tight">{scanTitle}</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-400">{scanNote}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ViewportPortal>
  );
}
