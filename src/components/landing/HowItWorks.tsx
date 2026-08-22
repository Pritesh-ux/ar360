"use client";

import * as Lucide from "lucide-react";
import MotionReveal from "./MotionReveal";
import { CARD_SHADOW, CARD_SHADOW_HOVER, DISPLAY, SECTION_PAD } from "./landingMotion";

type HowCard = {
  title: string;
  description: string;
  button_label?: string | null;
};

const defaultSteps = [
  {
    no: "01",
    title: "Upload",
    desc: "Drop a GLB or capture your product. Ready in minutes.",
    icon: "Upload",
  },
  {
    no: "02",
    title: "Customize",
    desc: "Set materials, lighting, camera, and your brand look.",
    icon: "SlidersHorizontal",
  },
  {
    no: "03",
    title: "Publish",
    desc: "One click for a live 3D viewer and permanent QR.",
    icon: "Rocket",
  },
  {
    no: "04",
    title: "Share & Track",
    desc: "Send link or embed — then watch views, scans, and AR.",
    icon: "LineChart",
  },
];

export default function HowItWorks({ items }: { items?: HowCard[] }) {
  const steps =
    items && items.length > 0
      ? items.slice(0, 6).map((item, idx) => ({
          no: String(idx + 1).padStart(2, "0"),
          title: item.title,
          desc: item.description,
          icon: item.button_label || defaultSteps[idx]?.icon || "Sparkles",
        }))
      : defaultSteps;

  return (
    <section
      id="how-it-works"
      className={`relative overflow-hidden border-y border-white/10 text-white ${SECTION_PAD}`}
    >
      {/* Dark floor atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(201,255,87,0.18), transparent 40%), radial-gradient(circle at 82% 35%, rgba(0,178,202,0.32), transparent 46%), linear-gradient(165deg, #0b1220 0%, #0f172a 48%, #082f33 100%)",
        }}
      />
      {/* Wall grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(180deg, black 0%, black 48%, transparent 88%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 48%, transparent 88%)",
        }}
      />
      {/* Perspective floor grid */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute inset-x-[-20%] bottom-0 h-[140%] origin-bottom opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(201,255,87,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,232,0.45) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            transform: "perspective(520px) rotateX(58deg)",
            maskImage: "linear-gradient(180deg, transparent 0%, black 35%, black 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 35%, black 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(8,47,51,0.35) 45%, rgba(2,8,16,0.75) 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <MotionReveal className="overflow-visible" scale={1} y={8}>
          <div className="mx-auto mb-9 max-w-2xl overflow-visible px-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Workflow
            </p>
            <h2
              className={`${DISPLAY} mt-2 overflow-visible pr-[0.12em] text-3xl font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-[40px]`}
            >
              How it works.
            </h2>
            <p className="mt-3 text-[14px] font-medium leading-relaxed text-slate-300">
              From file to live AR in four steps — no extra tools.
            </p>
          </div>
        </MotionReveal>

        <div className="relative mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {steps.map((step, index) => {
              const IconComponent =
                (Lucide as unknown as Record<string, Lucide.LucideIcon>)[step.icon] || Lucide.HelpCircle;
              return (
                <MotionReveal key={step.no} delay={index * 0.05} y={12}>
                  <article
                    className={`group relative flex h-full flex-col rounded-[18px] border border-white/12 bg-white/[0.07] p-3.5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#b9ff2c]/45 hover:bg-white/[0.12] sm:rounded-[22px] sm:p-5 ${CARD_SHADOW} ${CARD_SHADOW_HOVER}`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-[#b9ff2c] shadow-sm transition group-hover:border-[#b9ff2c]/50 sm:h-11 sm:w-11">
                        <IconComponent size={17} strokeWidth={2.1} />
                      </span>
                      <span className="text-[11px] font-black tracking-[0.14em] text-[#b9ff2c] sm:text-[12px]">
                        {step.no}
                      </span>
                    </div>
                    <h3 className="mt-3 text-[13px] font-bold leading-snug text-white sm:mt-4 sm:text-[15px]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-300 sm:mt-1.5 sm:text-[12.5px]">
                      {step.desc}
                    </p>
                  </article>
                </MotionReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
