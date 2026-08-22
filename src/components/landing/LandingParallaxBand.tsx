"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { LANDING_GRID_LIGHT, useLandingMotionEnabled } from "./landingMotion";

/** One shared floor/grid — wrap consecutive sections to avoid overlapping BGs / seams. */
export default function LandingParallaxBand({ children }: { children: ReactNode }) {
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
    <div ref={bandRef} className="relative overflow-hidden bg-[#F4F6F8]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ y: floorY }}
      >
        <div
          className="absolute inset-x-0 -top-[8%] h-[116%]"
          style={{
            background:
              "radial-gradient(ellipse 65% 40% at 50% 18%, rgba(185,255,44,0.2), transparent 55%), radial-gradient(ellipse 45% 35% at 12% 72%, rgba(0,178,202,0.1), transparent 50%), radial-gradient(ellipse 40% 30% at 88% 48%, rgba(185,255,44,0.08), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-x-0 -top-[8%] h-[116%] opacity-[0.42]"
          style={LANDING_GRID_LIGHT}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[38%] origin-bottom overflow-hidden opacity-[0.28]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.12) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            transform: "perspective(640px) rotateX(58deg)",
            maskImage: "linear-gradient(180deg, transparent 0%, black 35%, black 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 35%, black 100%)",
          }}
        />
        <motion.div
          className="absolute left-1/2 top-[16%] h-64 w-64 -translate-x-1/2 rounded-full bg-[#b9ff2c]/26 blur-3xl"
          style={{ x: glowX }}
        />
        <motion.div
          className="absolute left-[18%] top-[58%] h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl"
          style={{ x: glowX }}
        />
      </motion.div>

      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
