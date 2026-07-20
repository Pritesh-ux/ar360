"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Sparkles,
  Sliders,
  Rocket,
  Share2,
  LineChart,
  TrendingUp,
} from "lucide-react";
import { DISPLAY, SECTION_PAD, useScrollProgress } from "./landingMotion";

const steps = [
  { no: "01", title: "Upload", desc: "Drop a GLB or capture a product.", icon: Upload },
  { no: "02", title: "AI Optimize", desc: "Clean meshes and prep for web.", icon: Sparkles },
  { no: "03", title: "Customize", desc: "Materials, light, camera, brand.", icon: Sliders },
  { no: "04", title: "Publish", desc: "One click to live viewer + QR.", icon: Rocket },
  { no: "05", title: "Share", desc: "Link, embed, and print-ready codes.", icon: Share2 },
  { no: "06", title: "Track", desc: "Views, rotates, scans, AR opens.", icon: LineChart },
  { no: "07", title: "Scale", desc: "Grow products without new tools.", icon: TrendingUp },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useScrollProgress(sectionRef);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className={`border-y border-[#E8EAED] bg-white ${SECTION_PAD}`}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-9 max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
            Workflow
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            How it works.
          </h2>
        </div>

        <div className="relative mx-auto max-w-5xl">
          {/* Desktop connecting line */}
          <div className="absolute left-0 right-0 top-[36px] hidden h-[2px] bg-[#EEF0F2] md:block">
            <div
              className="h-full bg-[#B9FF2C] transition-[width] duration-150 ease-out"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 md:gap-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const lit = progress >= index / Math.max(steps.length - 1, 1) - 0.05;
              return (
                <motion.div
                  key={step.no}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: index * 0.04, duration: 0.4 }}
                  className="relative flex flex-col items-center text-center"
                >
                  <div
                    className={`relative z-10 mb-3 grid h-12 w-12 place-items-center rounded-full border bg-white shadow-sm transition ${
                      lit
                        ? "border-[#B9FF2C] text-[#111111]"
                        : "border-[#E8EAED] text-[#8A9098]"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#B9FF2C] text-[9px] font-black text-[#111111]">
                      {step.no}
                    </span>
                  </div>
                  <h3 className="text-[13px] font-bold text-[#111111]">{step.title}</h3>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#6B7078]">
                    {step.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
