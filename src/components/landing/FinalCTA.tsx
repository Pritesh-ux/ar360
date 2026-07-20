"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MotionReveal from "./MotionReveal";
import ModelViewer from "./LandingModelViewer";
import { DISPLAY, SECTION_PAD } from "./landingMotion";

const MODEL_PATH = "/models/chair_01.glb";

export default function FinalCTA() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`relative overflow-hidden border-b border-[#E8EAED] bg-[#F7F8FA] ${SECTION_PAD}`}
    >
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <MotionReveal y={14}>
          <div ref={hostRef} className="relative mx-auto mb-6 h-[200px] w-full max-w-md sm:h-[240px]">
            {visible ? (
              <ModelViewer
                src={MODEL_PATH}
                cameraControls={false}
                autoRotate
                disableZoom
                cameraOrbit="25deg 68deg 120%"
                cameraTarget="0m 0.4m 0m"
                fov={26}
                shadowIntensity={1}
                shadowSoftness={0.9}
                environmentImage="neutral"
                exposure={1.1}
                transparent={false}
                backgroundColor="#FFFFFF"
                disableMaterialOverrides
                showArButton={false}
                interactionPrompt={false}
              />
            ) : (
              <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-white" />
            )}
          </div>

          <h2
            className={`${DISPLAY} text-3xl font-bold leading-[1.08] tracking-tight text-[#111111] sm:text-5xl lg:text-[52px]`}
          >
            Turn Every Product Into
            <br />
            An Interactive Experience.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm font-medium leading-relaxed text-[#6B7078]">
            Launch interactive 3D, browser AR, and permanent QR from one workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#B9FF2C] px-8 text-sm font-bold text-[#111111] shadow-[0_12px_32px_rgba(185,255,44,0.35)] transition hover:scale-[1.02] hover:bg-[#A7F11D]"
            >
              Start Free
            </Link>
            <a
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-[#D8DBE0] bg-white px-8 text-sm font-bold text-[#111111] transition hover:scale-[1.02] hover:bg-[#FAFBFC]"
            >
              Book Demo
            </a>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}
