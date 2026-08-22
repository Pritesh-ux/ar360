"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Sofa,
  Grid3X3,
  Footprints,
  Package,
  Laptop,
  Gem,
  Shirt,
  Car,
  Check,
} from "lucide-react";
import Link from "next/link";
import { CARD_SHADOW, DISPLAY } from "./landingMotion";
import LandingContentParallax from "./LandingContentParallax";

type UseCase = {
  id: string;
  showcaseUid?: string;
  name: string;
  icon: typeof Sofa;
  title: string;
  description: string;
  benefits: string[];
  cta: string;
  ctaLink: string;
  image: string;
  style?: { objectPosition?: string };
};

function parseBenefits(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw) && raw.length) {
    return raw.map((b) => String(b).trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((b) => String(b).trim()).filter(Boolean).slice(0, 12);
      }
    } catch {
      return raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  }
  return fallback;
}

const USE_CASE_IMAGES: Record<string, string> = {
  furniture: "/home/use-cases/furniture.webp",
  tiles: "/home/use-cases/tiles.webp",
  shoes: "/home/use-cases/shoes.webp",
  packaging: "/home/use-cases/packaging.webp",
  electronics: "/home/use-cases/electronics.webp",
  jewelry: "/home/use-cases/jewelry.webp",
  fashion: "/home/use-cases/fashion.webp",
  automotive: "/home/use-cases/automotive.webp",
};

const FALLBACK_IMAGE = "/home/use-cases/furniture.webp";

const defaultUseCases: UseCase[] = [
  {
    id: "furniture",
    name: "Furniture",
    icon: Sofa,
    title: "In-room placement",
    description: "True-scale sofas and chairs in the living room before checkout.",
    benefits: [
      "True-scale AR in the room",
      "Fewer size-related returns",
      "Works on product pages & QR",
    ],
    cta: "Start with Furniture",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.furniture,
  },
  {
    id: "tiles",
    name: "Tiles",
    icon: Grid3X3,
    title: "Surface inspection",
    description: "Inspect shine, grout, and texture at architect-grade fidelity.",
    benefits: [
      "Close-up material detail",
      "Accurate finish & pattern",
      "Share with architects & buyers",
    ],
    cta: "Start with Tiles",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.tiles,
  },
  {
    id: "shoes",
    name: "Shoes",
    icon: Footprints,
    title: "Detail & form",
    description: "Rotate every stitch and sole profile for confident buys.",
    benefits: [
      "360° stitch & sole detail",
      "Colorway switching ready",
      "Mobile-first AR try-on path",
    ],
    cta: "Start with Footwear",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.shoes,
  },
  {
    id: "packaging",
    name: "Packaging",
    icon: Package,
    title: "Print preview",
    description: "Validate labels and finishes before the print run.",
    benefits: [
      "Label & print proofing",
      "Share variants with clients",
      "Permanent QR on packaging",
    ],
    cta: "Start with Packaging",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.packaging,
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: Laptop,
    title: "Micro-feature zoom",
    description: "Ports, bezels, and dimensions — clear before the cart.",
    benefits: [
      "Zoom into ports & bezels",
      "Clear dimension storytelling",
      "Embed on PDP & compare pages",
    ],
    cta: "Start with Electronics",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.electronics,
  },
  {
    id: "jewelry",
    name: "Jewelry",
    icon: Gem,
    title: "Sparkle & metal",
    description: "Metalness and reflections that feel premium on mobile.",
    benefits: [
      "Premium metal & gem light",
      "Macro-level detail on mobile",
      "Shareable AR for showrooms",
    ],
    cta: "Start with Jewelry",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.jewelry,
  },
  {
    id: "fashion",
    name: "Fashion",
    icon: Shirt,
    title: "Lookbook staging",
    description: "Soft fashion-floor light for apparel and accessories.",
    benefits: [
      "Lookbook-ready lighting",
      "Accessory & bag storytelling",
      "QR for runway & retail",
    ],
    cta: "Start with Fashion",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.fashion,
  },
  {
    id: "automotive",
    name: "Automotive",
    icon: Car,
    title: "Finish & form",
    description: "Showcase paint, trim, and silhouette under studio light.",
    benefits: [
      "Paint & trim under studio light",
      "Silhouette & form clarity",
      "Dealer floor QR & embeds",
    ],
    cta: "Start with Automotive",
    ctaLink: "/signup",
    image: USE_CASE_IMAGES.automotive,
  },
];

function resolveImage(slug: string, cmsPath?: string | null) {
  const candidate = String(cmsPath || "").trim();
  // Prefer seeded static assets when CMS still points at a wiped /uploads path,
  // or when the editor has not set a custom image yet.
  const seeded = USE_CASE_IMAGES[slug] || FALLBACK_IMAGE;
  if (!candidate) return seeded;
  if (!/\.(webp|jpe?g|png|avif)$/i.test(candidate)) return seeded;
  // Keep absolute site paths /uploads and /home as-is; still allow http(s) CMS URLs.
  if (
    candidate.startsWith("/home/") ||
    candidate.startsWith("/uploads/") ||
    candidate.startsWith("https://") ||
    candidate.startsWith("http://")
  ) {
    return candidate;
  }
  return seeded;
}

function UseCaseImage({
  src,
  fallbackSrc,
  alt,
  style,
}: {
  src: string;
  fallbackSrc: string;
  alt: string;
  style?: { objectPosition?: string };
}) {
  const [current, setCurrent] = useState(src);
  useEffect(() => {
    setCurrent(src);
  }, [src]);

  return (
    <Image
      src={current}
      alt={alt}
      fill
      sizes="(max-width: 1024px) 100vw, 52vw"
      className="object-cover"
      style={style}
      quality={75}
      priority={false}
      onError={() => {
        if (current !== fallbackSrc) setCurrent(fallbackSrc);
      }}
    />
  );
}

export default function UseCases({
  dynamicCategories,
  dynamicShowcases,
  title,
  subtitle,
}: {
  dynamicCategories?: any[];
  dynamicShowcases?: any[];
  title?: string;
  subtitle?: string;
  description?: string;
}) {
  const resolveIcon = (name: string) => {
    switch (name?.toLowerCase()) {
      case "sofa":
        return Sofa;
      case "grid":
      case "grid3x3":
        return Grid3X3;
      case "footprints":
        return Footprints;
      case "box":
        return Package;
      case "laptop":
        return Laptop;
      case "gem":
        return Gem;
      case "shirt":
        return Shirt;
      case "car":
        return Car;
      default:
        return Sofa;
    }
  };

  const useCases =
    dynamicCategories && dynamicCategories.length > 0 && dynamicShowcases
      ? dynamicCategories.map((cat: any) => {
          const item = dynamicShowcases.find((sh: any) => sh.category_uid === cat.category_uid);
          const fallback = defaultUseCases.find((d) => d.id === cat.slug);
          const style = item?.style_settings || {};
          const focalX = typeof style.focalX === "number" ? style.focalX : 50;
          const focalY = typeof style.focalY === "number" ? style.focalY : 50;
          return {
            id: cat.slug,
            showcaseUid: item?.showcase_uid,
            name: cat.name,
            icon: resolveIcon(cat.icon),
            title: item?.title || fallback?.title || "Product Placement",
            description:
              item?.description || cat.description || fallback?.description || "View products in real space with AR.",
            benefits: parseBenefits(item?.benefits, fallback?.benefits || [
              "True-scale AR in the room",
              "Fewer size-related returns",
              "Works on product pages & QR",
            ]),
            cta: item?.cta_label || fallback?.cta || "Get Started",
            ctaLink: item?.cta_link || "/signup",
            image: resolveImage(cat.slug, item?.image_path || item?.cover_image),
            style: { objectPosition: `${focalX}% ${focalY}%` },
          };
        })
      : defaultUseCases;

  const [activeTab, setActiveTab] = useState(useCases[0]?.id || "furniture");
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const active = useCases.find((uc) => uc.id === activeTab) || useCases[0];

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "180px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = pillsRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-uc="${activeTab}"]`);
    if (!container || !el) return;
    const left = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeTab]);

  if (!active) return null;

  const ActiveIcon = active.icon;

  return (
    <section
      ref={sectionRef}
      id="use-cases"
      className="bg-transparent py-5 sm:py-10 lg:py-14"
    >
      <LandingContentParallax className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-3 max-w-2xl text-center sm:mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6B7078] sm:text-[11px] sm:tracking-[0.18em]">
            {subtitle || "Industry fit"}
          </p>
          <h2
            className={`${DISPLAY} mt-1.5 text-[32px] font-bold leading-[1.08] tracking-tight text-[#111111] sm:mt-2 sm:text-3xl sm:text-[40px]`}
          >
            {title || "Use Cases"}
          </h2>
        </div>

        <div className="relative mb-3 sm:mb-5">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#F4F6F8] to-transparent md:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#F4F6F8] to-transparent md:hidden" />
          <div
            ref={pillsRef}
            className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none sm:gap-2 md:flex-wrap md:justify-center"
            style={{ scrollbarWidth: "none" }}
          >
            {useCases.map((uc) => {
              const Icon = uc.icon;
              const isActive = uc.id === activeTab;
              return (
                <button
                  key={uc.id}
                  type="button"
                  data-uc={uc.id}
                  data-cms-target={uc.showcaseUid ? `showcase:${uc.showcaseUid}` : `showcase:${uc.id}`}
                  onClick={() => setActiveTab(uc.id)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold transition hover:scale-[1.02] sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-[11px] ${
                    isActive
                      ? "bg-[#111111] text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                      : "border border-[#E8EAED] bg-white/85 text-[#6B7078] hover:border-[#D0D4DA] hover:bg-white hover:text-[#111111]"
                  }`}
                >
                  <Icon size={12} className="sm:hidden" />
                  <Icon size={13} className="hidden sm:block" />
                  {uc.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`overflow-hidden rounded-[20px] border border-[#E8EAED] bg-white sm:rounded-[28px] ${CARD_SHADOW}`}>
          <div className="grid bg-white lg:grid-cols-[0.95fr_1.05fr]">
            <div className="flex flex-col bg-white p-4 sm:p-8 lg:p-9">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#b9ff2c] text-[#111111] sm:h-10 sm:w-10 sm:rounded-2xl">
                    <ActiveIcon size={16} className="sm:hidden" />
                    <ActiveIcon size={18} className="hidden sm:block" />
                  </span>
                  <h3
                    className={`${DISPLAY} mt-2.5 text-xl font-bold leading-tight text-[#111111] sm:mt-4 sm:text-2xl sm:text-3xl`}
                  >
                    {active.title}
                  </h3>
                  <p className="mt-1.5 max-w-md text-[12px] font-medium leading-relaxed text-[#5C6168] sm:mt-2.5 sm:text-sm">
                    {active.description}
                  </p>

                  <ul className="mt-3 space-y-1.5 sm:mt-5 sm:space-y-2.5">
                    {active.benefits.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-[12px] font-semibold text-[#5C6168] sm:gap-2.5 sm:text-[13px]"
                      >
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#b9ff2c] text-[#111111] sm:h-5 sm:w-5">
                          <Check size={10} strokeWidth={3} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={active.ctaLink || "/signup"}
                    className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-[#111111] px-4 text-[11px] font-bold text-white transition hover:scale-[1.02] hover:bg-[#222] sm:mt-6 sm:h-10 sm:px-5 sm:text-xs"
                  >
                    {active.cta}
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>

            <div
              className="relative min-h-[210px] overflow-hidden border-t border-[#E8EAED]/80 bg-white sm:min-h-[300px] lg:min-h-full lg:border-l lg:border-t-0"
              data-cms-target={active.showcaseUid ? `showcase:${active.showcaseUid}` : `showcase:${active.id}`}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id + active.image}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 bg-white"
                >
                  {visible ? (
                    <UseCaseImage
                      src={active.image}
                      fallbackSrc={USE_CASE_IMAGES[active.id] || FALLBACK_IMAGE}
                      alt={`${active.name} — ${active.title}`}
                      style={active.style}
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-white" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </LandingContentParallax>
    </section>
  );
}
