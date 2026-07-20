"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap, Shield } from "lucide-react";
import HeroViewer from "./HeroViewer";
import { DISPLAY } from "./landingMotion";
import { usePrefersReducedMotion } from "./landingMotion";

const checks = ["3D Viewer", "Web AR", "Permanent QR", "Analytics"];

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [orbitDeg, setOrbitDeg] = useState(25);

  useEffect(() => {
    if (reduced) return;
    function onScroll() {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const view = window.innerHeight;
      const mid = rect.top + rect.height * 0.35;
      const t = 1 - Math.min(Math.max(mid / view, 0), 1);
      setOrbitDeg(18 + t * 28);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative overflow-hidden bg-white pt-24"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-6 pb-12 pt-6 lg:grid-cols-[0.35fr_0.65fr] lg:gap-10 lg:pb-16 lg:pt-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-md"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 rounded-full border border-[#E4E6EA] bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C6168] backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B9FF2C]" />
            3D · AR · QR commerce
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className={`${DISPLAY} mt-4 text-[36px] font-bold leading-[1.05] tracking-tight text-[#111111] sm:text-[48px] lg:text-[56px]`}
          >
            Upload once.
            <br />
            Sell everywhere.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-4 max-w-sm text-[14px] font-medium leading-relaxed text-[#5C6168] sm:text-[15px]"
          >
            Interactive 3D, browser AR, permanent QR, and website embeds — from one product workspace.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#B9FF2C] px-7 text-sm font-bold text-[#111111] shadow-[0_10px_28px_rgba(185,255,44,0.35)] transition hover:scale-[1.02] hover:bg-[#A7F11D]"
            >
              Get Started
            </Link>
            <a
              href="#studio-floor"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#D8DBE0] bg-white px-7 text-sm font-bold text-[#111111] transition hover:scale-[1.02] hover:bg-[#FAFBFC]"
            >
              Watch Demo
            </a>
          </motion.div>

          <motion.ul variants={itemVariants} className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
            {checks.map((label) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5C6168]"
              >
                <span className="grid h-4 w-4 place-items-center rounded-full bg-[#B9FF2C] text-[#111111]">
                  <Check size={10} strokeWidth={3} />
                </span>
                {label}
              </li>
            ))}
          </motion.ul>

          <motion.div
            variants={itemVariants}
            className="mt-6 flex flex-wrap gap-4 border-t border-[#E4E6EA]/80 pt-5 text-[12px] font-semibold text-[#6B7078]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Zap size={14} className="text-[#84D400]" /> Fast setup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield size={14} className="text-[#84D400]" /> No app install
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full"
        >
          <div className="relative overflow-hidden rounded-[28px] border border-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
            <HeroViewer scrollOrbitDeg={orbitDeg} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
