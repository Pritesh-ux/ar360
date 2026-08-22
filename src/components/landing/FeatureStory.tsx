"use client";

import { useRef } from "react";
import * as Lucide from "lucide-react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  CARD_SHADOW,
  CARD_SHADOW_HOVER,
  DISPLAY,
  SECTION_PAD,
  useLandingMotionEnabled,
} from "./landingMotion";

type FeatureCard = {
  title: string;
  description: string;
  button_label?: string | null;
  sort_order?: number;
};

const defaultFeatures = [
  { title: "Universal Embed", desc: "Drop an iframe on any storefront.", icon: "Code" },
  { title: "Permanent QR", desc: "One code for the product lifetime.", icon: "QrCode" },
  { title: "GLB Support", desc: "Industry-standard 3D, ready to publish.", icon: "Box" },
  { title: "Drag & Drop Upload", desc: "From file to live viewer in minutes.", icon: "Upload" },
  { title: "Variant Switching", desc: "Colors and finishes buyers can explore.", icon: "Layers" },
  { title: "Analytics", desc: "Views, rotates, QR, and AR launches.", icon: "BarChart3" },
];

export default function FeatureStory({
  items,
  title,
  subtitle,
}: {
  items?: FeatureCard[];
  title?: string;
  subtitle?: string;
}) {
  const fromCms = (items || [])
    .filter((i) => i.title && i.description)
    .filter((i) => {
      const order = Number(i.sort_order ?? 0);
      return Number.isFinite(order) ? order < 100 : true;
    })
    .slice(0, 6)
    .map((i) => ({
      title: i.title,
      desc: i.description,
      icon: i.button_label || "Sparkles",
    }));
  const displayFeatures = fromCms.length >= 4 ? fromCms : defaultFeatures;
  const motionEnabled = useLandingMotionEnabled();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  // Same spring as LandingParallaxBand so content + floor feel locked
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.35 });
  // One shared content speed — no per-card stagger (that caused mismatched drift)
  const contentY = useTransform(smooth, [0, 1], motionEnabled ? [28, -28] : [0, 0]);

  return (
    <section
      ref={sectionRef}
      id="feature-storytelling"
      className={`relative bg-transparent ${SECTION_PAD}`}
    >
      <motion.div
        style={{ y: contentY }}
        className="relative mx-auto max-w-7xl px-6 will-change-transform"
      >
        <div className="mx-auto mb-8 max-w-3xl overflow-visible px-2 text-center sm:mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B7078] sm:text-[11px]">
            {subtitle || "Features"}
          </p>
          <h2
            className={`${DISPLAY} mt-2 overflow-visible pr-[0.08em] text-[32px] font-bold leading-[1.08] tracking-[-0.02em] text-[#111111] sm:pr-[0.12em] sm:text-[40px]`}
          >
            {title || "Simple tools to sell in 3D & AR."}
          </h2>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          {displayFeatures.map((feature) => {
            const IconComponent =
              (Lucide as unknown as Record<string, Lucide.LucideIcon>)[feature.icon] || Lucide.HelpCircle;
            return (
              <article
                key={feature.title}
                className={`group h-full rounded-[18px] border border-[#D8DCE3] bg-white p-3.5 transition hover:-translate-y-0.5 sm:rounded-[22px] sm:p-5 ${CARD_SHADOW} ${CARD_SHADOW_HOVER}`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b9ff2c] text-[#111111] transition group-hover:scale-105 sm:h-10 sm:w-10">
                  <IconComponent size={15} strokeWidth={2} />
                </span>
                <h3 className="mt-3 text-[13px] font-bold leading-snug text-[#111111] sm:mt-4 sm:text-[14px]">
                  {feature.title}
                </h3>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#6B7078] sm:mt-1.5 sm:text-[12px]">
                  {feature.desc}
                </p>
              </article>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
