"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Box, Play } from "lucide-react";
import ModelViewer from "@/components/shared/ModelViewer";

type Props = ComponentProps<typeof ModelViewer>;

function isResourceConstrainedMobile() {
  const mobileViewport = window.matchMedia("(max-width: 767px)").matches;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const touchAppleDevice = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return mobileViewport || mobileAgent || touchAppleDevice;
}

/**
 * Landing previews use a large textured GLB. Mobile browsers, especially
 * iOS Safari, can terminate the tab when several WebGL viewers allocate GPU
 * textures together. Keep those previews opt-in on constrained devices.
 */
export default function LandingModelViewer(props: Props) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [loadRequested, setLoadRequested] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(isResourceConstrainedMobile());
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (isMobile === false || (isMobile && loadRequested)) {
    return (
      <ModelViewer
        {...props}
        autoRotate={isMobile ? false : props.autoRotate}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[inherit] w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#FFFFFF_0%,#F4F5F6_72%)] p-6">
      <div className="max-w-[240px] text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#DDE1E5] bg-white text-[#6B7078] shadow-sm">
          <Box size={28} strokeWidth={1.6} />
        </span>
        <p className="mt-4 text-sm font-bold text-[#111111]">Interactive 3D preview</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-[#6B7078]">
          Load the preview when you are ready.
        </p>
        {isMobile && (
          <button
            type="button"
            onClick={() => setLoadRequested(true)}
            className="mx-auto mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-xs font-bold text-white transition active:scale-[0.98]"
          >
            <Play size={13} fill="currentColor" />
            Load 3D
          </button>
        )}
      </div>
    </div>
  );
}
