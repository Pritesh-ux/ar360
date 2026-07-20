"use client";

import { useEffect, useState, type RefObject } from "react";

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

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** Shared landing section vertical rhythm (~15–20% tighter than py-20/24). */
export const SECTION_PAD = "py-14 sm:py-16";
export const SECTION_PAD_TIGHT = "py-12 sm:py-14";
export const CARD_SHADOW = "shadow-[0_12px_40px_rgba(15,23,42,0.05)]";
export const CARD_SHADOW_HOVER = "hover:shadow-[0_18px_48px_rgba(15,23,42,0.09)]";
export const DISPLAY = "font-[family-name:var(--font-auth-display)]";
