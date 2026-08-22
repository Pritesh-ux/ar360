"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  LANDING_DARK_BASE,
  LANDING_GRID_DARK,
  useLandingMotionEnabled,
} from "./landingMotion";

/** Shared dark floor/grid for Footer — clean edge, matched grid. */
export default function LandingDarkBand({ children }: { children: ReactNode }) {
  const bandRef = useRef<HTMLDivElement>(null);
  const motionEnabled = useLandingMotionEnabled();

  const { scrollYProgress } = useScroll({
    target: bandRef,
    offset: ["start end", "end start"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.35 });
  const floorY = useTransform(smooth, [0, 1], motionEnabled ? ["-6%", "6%"] : ["0%", "0%"]);
  const glowX = useTransform(smooth, [0, 1], motionEnabled ? ["-8%", "8%"] : ["0%", "0%"]);

  return (
    <div ref={bandRef} className="relative overflow-hidden text-white" style={{ background: LANDING_DARK_BASE }}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ y: floorY }}
      >
        <div className="absolute inset-x-0 -top-[8%] h-[116%]" style={{ background: LANDING_DARK_BASE }} />
        <div className="absolute inset-x-0 -top-[8%] h-[116%] opacity-[0.12]" style={LANDING_GRID_DARK} />
        <motion.div
          className="absolute left-1/2 top-[28%] h-56 w-56 -translate-x-1/2 rounded-full bg-[#b9ff2c]/16 blur-3xl"
          style={{ x: glowX }}
        />
      </motion.div>

      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
