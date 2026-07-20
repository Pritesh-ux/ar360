"use client";

import {
  Code,
  QrCode,
  Apple,
  Smartphone,
  Box,
  Upload,
  Layers,
  Sun,
  Palette,
  Globe,
  BarChart3,
  ShoppingCart,
} from "lucide-react";
import MotionReveal from "./MotionReveal";
import { CARD_SHADOW, CARD_SHADOW_HOVER, DISPLAY, SECTION_PAD } from "./landingMotion";

const features = [
  { title: "Universal Embed", desc: "Drop an iframe on any storefront.", icon: Code },
  { title: "Permanent QR", desc: "One code for the product lifetime.", icon: QrCode },
  { title: "Apple USDZ", desc: "Quick Look ready on iPhone & iPad.", icon: Apple },
  { title: "Android Scene Viewer", desc: "Native AR without an app install.", icon: Smartphone },
  { title: "GLB Support", desc: "Industry-standard 3D, ready to publish.", icon: Box },
  { title: "Drag & Drop Upload", desc: "From file to live viewer in minutes.", icon: Upload },
  { title: "Variant Switching", desc: "Colors and finishes buyers can explore.", icon: Layers },
  { title: "Lighting Presets", desc: "Studio-grade exposure in one click.", icon: Sun },
  { title: "Material Library", desc: "PBR fabrics, metals, and surfaces.", icon: Palette },
  { title: "CDN Delivery", desc: "Fast global loads for every scan.", icon: Globe },
  { title: "Analytics", desc: "Views, rotates, QR, and AR launches.", icon: BarChart3 },
  { title: "Commerce Ready", desc: "Built for Shopify and custom carts.", icon: ShoppingCart },
];

export default function FeatureStory() {
  return (
    <section
      id="feature-storytelling"
      className={`border-b border-[#E8EAED] bg-[#F7F8FA] ${SECTION_PAD}`}
    >
      <div className="mx-auto max-w-7xl px-6">
        <MotionReveal>
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
              Features
            </p>
            <h2
              className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
            >
              Built for real 3D commerce.
            </h2>
          </div>
        </MotionReveal>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <MotionReveal key={feature.title} delay={index * 0.03} y={10}>
                <article
                  className={`group h-full rounded-[22px] border border-[#E8EAED] bg-white p-5 transition hover:-translate-y-0.5 ${CARD_SHADOW} ${CARD_SHADOW_HOVER}`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#B9FF2C] text-[#111111] transition group-hover:scale-105">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <h3 className="mt-4 text-[14px] font-bold text-[#111111]">{feature.title}</h3>
                  <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-[#6B7078]">
                    {feature.desc}
                  </p>
                </article>
              </MotionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
