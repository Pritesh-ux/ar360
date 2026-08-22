"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { DISPLAY, LANDING_GRID_LIGHT, useLandingMotionEnabled } from "./landingMotion";

const HeroViewer = dynamic(() => import("./HeroViewer"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[420px] w-full animate-pulse rounded-[28px] bg-[#F0F1F3] sm:min-h-[520px] lg:min-h-[560px]" />
  ),
});

const checks = ["3D Viewer", "Web AR", "Permanent QR", "Analytics"];

export default function HeroSection({
  modelSrc,
  title,
  subtitle,
  description,
  buttons,
}: {
  modelSrc?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  buttons?: { label: string; href: string; style: string }[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const motionEnabled = useLandingMotionEnabled();
  const [orbitDeg, setOrbitDeg] = useState(25);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.35 });
  const bgY = useTransform(smooth, [0, 1], motionEnabled ? ["0%", "18%"] : ["0%", "0%"]);
  const glowX = useTransform(smooth, [0, 1], motionEnabled ? ["0%", "12%"] : ["0%", "0%"]);
  const contentY = useTransform(smooth, [0, 1], motionEnabled ? [0, 56] : [0, 0]);
  const viewerY = useTransform(smooth, [0, 1], motionEnabled ? [0, 36] : [0, 0]);

  useEffect(() => {
    if (!motionEnabled) return;
    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const view = window.innerHeight;
        const mid = rect.top + rect.height * 0.35;
        const t = 1 - Math.min(Math.max(mid / view, 0), 1);
        const next = Math.round(18 + t * 28);
        setOrbitDeg((prev) => (prev === next ? prev : next));
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [motionEnabled]);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { y: 12 },
    visible: {
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative overflow-hidden bg-white pt-24"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ y: bgY }}
      >
        <div
          className="absolute inset-x-0 -top-[10%] h-[120%] opacity-[0.4]"
          style={LANDING_GRID_LIGHT}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 40% at 70% 35%, rgba(185,255,44,0.16), transparent 58%), radial-gradient(ellipse 40% 35% at 15% 70%, rgba(0,178,202,0.08), transparent 55%)",
          }}
        />
        <motion.div
          className="absolute right-[18%] top-[28%] h-64 w-64 rounded-full bg-[#b9ff2c]/20 blur-3xl"
          style={{ x: glowX }}
        />
      </motion.div>

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-6 pb-12 pt-6 lg:grid-cols-[0.35fr_0.65fr] lg:gap-10 lg:pb-16 lg:pt-8">
        <motion.div style={{ y: contentY }} className="will-change-transform">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-md text-center lg:mx-0 lg:text-left"
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-2 rounded-full border border-[#E4E6EA] bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C6168] backdrop-blur-sm sm:text-[11px]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b9ff2c]" />
              {subtitle || "3D · AR · QR commerce"}
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className={`${DISPLAY} mt-4 text-[34px] font-bold leading-[1.06] tracking-tight text-[#111111] sm:text-[48px] lg:text-[56px]`}
            >
              {title || "Upload once. Sell everywhere."}
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-4 max-w-sm text-[14px] font-medium leading-relaxed text-[#5C6168] sm:text-[15px]"
            >
              {description ||
                "Interactive 3D, browser AR, permanent QR, and website embeds — from one product workspace."}
            </motion.p>

            <motion.div variants={itemVariants} className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {buttons && buttons.length > 0 ? (
                buttons.map((btn, index) => {
                  const isPrimary = btn.style === "primary";
                  const href = btn.href?.includes("editor-story") ? "/demo" : btn.href;
                  return href.startsWith("/") ? (
                    <Link
                      key={index}
                      href={href}
                      className={
                        isPrimary
                          ? "inline-flex h-11 items-center justify-center rounded-full bg-[#b9ff2c] px-7 text-sm font-bold text-[#111111] shadow-[0_10px_28px_rgba(185,255,44,0.35)] transition hover:scale-[1.02] hover:bg-[#a3f020]"
                          : "inline-flex h-11 items-center justify-center rounded-full border border-[#D8DBE0] bg-white px-7 text-sm font-bold text-[#111111] transition hover:scale-[1.02] hover:bg-[#FAFBFC]"
                      }
                    >
                      {btn.label}
                    </Link>
                  ) : (
                    <a
                      key={index}
                      href={href}
                      className={
                        isPrimary
                          ? "inline-flex h-11 items-center justify-center rounded-full bg-[#b9ff2c] px-7 text-sm font-bold text-[#111111] shadow-[0_10px_28px_rgba(185,255,44,0.35)] transition hover:scale-[1.02] hover:bg-[#a3f020]"
                          : "inline-flex h-11 items-center justify-center rounded-full border border-[#D8DBE0] bg-white px-7 text-sm font-bold text-[#111111] transition hover:scale-[1.02] hover:bg-[#FAFBFC]"
                      }
                    >
                      {btn.label}
                    </a>
                  );
                })
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-[#b9ff2c] px-7 text-sm font-bold text-[#111111] shadow-[0_10px_28px_rgba(185,255,44,0.35)] transition hover:scale-[1.02] hover:bg-[#a3f020]"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/demo"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-[#D8DBE0] bg-white px-7 text-sm font-bold text-[#111111] transition hover:scale-[1.02] hover:bg-[#FAFBFC]"
                  >
                    Watch Demo
                  </Link>
                </>
              )}
            </motion.div>

            <motion.ul variants={itemVariants} className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 lg:justify-start">
              {checks.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5C6168]"
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[#b9ff2c] text-[#111111]">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {label}
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: viewerY }} className="relative w-full will-change-transform">
          <motion.div
            initial={{ y: 12, scale: 0.99 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-[28px] border border-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
          >
            <HeroViewer scrollOrbitDeg={orbitDeg} modelSrc={modelSrc} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
