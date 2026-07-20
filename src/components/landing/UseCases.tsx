"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import ModelViewer from "./LandingModelViewer";
import { CARD_SHADOW, DISPLAY, SECTION_PAD } from "./landingMotion";

/**
 * Drop a GLB at public/models/use-cases/{id}.glb
 * Until the file exists, chair_01.glb is used (no 404 in the viewer).
 */
const FALLBACK_MODEL = "/models/chair_01.glb";

/** Add category ids here once the matching GLB is in public/models/use-cases/ */
const READY_USE_CASE_MODELS = new Set<string>([
  // "furniture",
  // "tiles",
  // "shoes",
  // "packaging",
  // "electronics",
  // "jewelry",
  // "fashion",
  // "automotive",
]);

type UseCase = {
  id: string;
  name: string;
  icon: typeof Sofa;
  title: string;
  description: string;
  benefits: string[];
  cta: string;
  exposure: number;
  orbit: string;
  target: string;
  fov: number;
  preferredModel: string;
};

const useCases: UseCase[] = [
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
    exposure: 1.2,
    orbit: "35deg 70deg 110%",
    target: "0m 0.48m 0m",
    fov: 22,
    preferredModel: "/models/use-cases/furniture.glb",
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
    exposure: 1.05,
    orbit: "15deg 55deg 105%",
    target: "0m 0.35m 0m",
    fov: 26,
    preferredModel: "/models/use-cases/tiles.glb",
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
    exposure: 1.25,
    orbit: "-40deg 65deg 112%",
    target: "0m 0.3m 0m",
    fov: 24,
    preferredModel: "/models/use-cases/shoes.glb",
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
    exposure: 1.35,
    orbit: "60deg 68deg 115%",
    target: "0m 0.4m 0m",
    fov: 22,
    preferredModel: "/models/use-cases/packaging.glb",
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
    exposure: 1.1,
    orbit: "80deg 70deg 108%",
    target: "0m 0.4m 0m",
    fov: 22,
    preferredModel: "/models/use-cases/electronics.glb",
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
    exposure: 1.3,
    orbit: "-20deg 60deg 100%",
    target: "0m 0.25m 0m",
    fov: 28,
    preferredModel: "/models/use-cases/jewelry.glb",
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
    exposure: 1.28,
    orbit: "-55deg 72deg 112%",
    target: "0m 0.45m 0m",
    fov: 22,
    preferredModel: "/models/use-cases/fashion.glb",
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
    exposure: 1.15,
    orbit: "45deg 65deg 125%",
    target: "0m 0.5m 0m",
    fov: 24,
    preferredModel: "/models/use-cases/automotive.glb",
  },
];

export default function UseCases() {
  const [activeTab, setActiveTab] = useState(useCases[0].id);
  const [visible, setVisible] = useState(false);
  const [failedModelSrc, setFailedModelSrc] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const active = useCases.find((uc) => uc.id === activeTab) || useCases[0];
  const ActiveIcon = active.icon;
  const preferredModelSrc = READY_USE_CASE_MODELS.has(active.id)
    ? active.preferredModel
    : FALLBACK_MODEL;
  const modelSrc = failedModelSrc === preferredModelSrc ? FALLBACK_MODEL : preferredModelSrc;

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

  return (
    <section
      ref={sectionRef}
      id="use-cases"
      className={`border-b border-[#E8EAED] bg-white ${SECTION_PAD}`}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
            Industry fit
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            Use Cases
          </h2>
        </div>

        <div className="relative mb-5">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent md:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent md:hidden" />
          <div
            ref={pillsRef}
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-none md:flex-wrap md:justify-center"
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
                  onClick={() => setActiveTab(uc.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold transition hover:scale-[1.02] ${
                    isActive
                      ? "bg-[#111111] text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                      : "border border-[#E8EAED] bg-[#F7F8FA] text-[#6B7078] hover:border-[#D0D4DA] hover:bg-white hover:text-[#111111]"
                  }`}
                >
                  <Icon size={13} />
                  {uc.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`overflow-hidden rounded-[28px] border border-[#E8EAED] ${CARD_SHADOW}`}>
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="flex flex-col p-7 sm:p-8 lg:p-9">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B9FF2C] text-[#111111]">
                    <ActiveIcon size={18} />
                  </span>
                  <h3
                    className={`${DISPLAY} mt-4 text-2xl font-bold leading-tight text-[#111111] sm:text-3xl`}
                  >
                    {active.title}
                  </h3>
                  <p className="mt-2.5 max-w-md text-sm font-medium leading-relaxed text-[#5C6168]">
                    {active.description}
                  </p>

                  <ul className="mt-5 space-y-2.5">
                    {active.benefits.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2.5 text-[13px] font-semibold text-[#5C6168]"
                      >
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#B9FF2C] text-[#111111]">
                          <Check size={11} strokeWidth={3} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="/signup"
                    className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-[#111111] px-5 text-xs font-bold text-white transition hover:scale-[1.02] hover:bg-[#222]"
                  >
                    {active.cta}
                  </a>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative min-h-[300px] border-t border-[#E8EAED]/80 bg-white lg:min-h-full lg:border-l lg:border-t-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id + modelSrc}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  {visible ? (
                    <ModelViewer
                      src={modelSrc}
                      cameraControls
                      autoRotate
                      disableZoom
                      cameraOrbit={active.orbit}
                      cameraTarget={active.target}
                      fov={active.fov}
                      shadowIntensity={1.15}
                      shadowSoftness={0.85}
                      environmentImage="neutral"
                      exposure={active.exposure}
                      transparent={false}
                      backgroundColor="#FFFFFF"
                      disableMaterialOverrides
                      showArButton={false}
                      interactionPrompt={false}
                      onModelError={() => {
                        if (modelSrc !== FALLBACK_MODEL) setFailedModelSrc(modelSrc);
                      }}
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-white" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
