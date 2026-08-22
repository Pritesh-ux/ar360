"use client";

import { useEffect, useState, type RefObject } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";

/**
 * Returns 0–1 progress of how far `ref` has scrolled through the viewport.
 * Useful for sticky storytelling and timeline fills.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let raf = 0;

    function update() {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = Math.max(rect.height - window.innerHeight, 1);
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(scrolled / total);
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);

  return progress;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useDeferredEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Keep landing parallax for larger screens only.
 * On phones it creates visible gaps because transformed sections no longer feel aligned.
 */
export function useLandingMotionEnabled(minWidth = 1024) {
  const reduced = usePrefersReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useDeferredEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const apply = () => setEnabled(mq.matches && !reduced);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [minWidth, reduced]);

  return enabled;
}

/** Shared landing section vertical rhythm — extra compact on phones to avoid large visual gaps. */
export const SECTION_PAD = "py-6 sm:py-10";
export const SECTION_PAD_TIGHT = "py-5 sm:py-8";
export const CARD_SHADOW = "shadow-[0_12px_40px_rgba(15,23,42,0.05)]";
export const CARD_SHADOW_HOVER = "hover:shadow-[0_18px_48px_rgba(15,23,42,0.09)]";
export const DISPLAY = "font-[family-name:var(--font-auth-display)]";

/** Shared light/dark grid (scrolls with section — not viewport-fixed). */
export const LANDING_GRID_SIZE = "30px 30px";
export const LANDING_GRID_LIGHT = {
  backgroundImage:
    "linear-gradient(rgba(15,23,42,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.09) 1px, transparent 1px)",
  backgroundSize: LANDING_GRID_SIZE,
};
export const LANDING_GRID_DARK = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.11) 1px, transparent 1px)",
  backgroundSize: LANDING_GRID_SIZE,
};
export const LANDING_DARK_BASE =
  "radial-gradient(circle at 18% 18%, rgba(201,255,87,0.22), transparent 42%), radial-gradient(circle at 82% 78%, rgba(0,178,202,0.38), transparent 48%), linear-gradient(165deg, #0b1220 0%, #0f172a 55%, #082f33 100%)";
