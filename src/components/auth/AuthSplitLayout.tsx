"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import ModelViewer from "@/components/shared/ModelViewer";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AUTH_BRAND, AUTH_DEMO_MODEL } from "@/components/auth/constants";

export { AUTH_BRAND, AUTH_DEMO_MODEL };

type AuthSplitLayoutProps = {
  children: ReactNode;
  modelSrc?: string;
  progressLabel?: string;
  footer?: ReactNode;
  stepKey?: string;
};

export function AuthSplitLayout({
  children,
  modelSrc = AUTH_DEMO_MODEL,
  progressLabel,
  footer,
  stepKey = "panel",
}: AuthSplitLayoutProps) {
  return (
    <div className="auth-premium min-h-screen bg-white text-[#0a0a0a]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative min-h-[44vh] overflow-hidden bg-white lg:min-h-screen">
          <div className="absolute left-6 top-6 z-20 lg:left-10 lg:top-10">
            <BrandLogo href="/" tone="light" variant="wordmark" />
          </div>

          {progressLabel ? (
            <div className="absolute right-6 top-7 z-20 text-[13px] font-medium tracking-wide text-[#737373] lg:right-10 lg:top-11">
              {progressLabel}
            </div>
          ) : null}

          {/* Full-bleed model viewer — white background */}
          <div className="absolute inset-0 bg-white">
            <ModelViewer
              src={modelSrc}
              autoRotate
              cameraControls
              disableZoom
              interactionPrompt={false}
              showArButton={false}
              backgroundColor="#ffffff"
              transparent={false}
              environmentImage="neutral"
              shadowIntensity={1.2}
              shadowSoftness={1}
              exposure={1.05}
              cameraOrbit="25deg 67deg 105%"
              cameraTarget="0m 0.45m 0m"
              fov={28}
              disableMaterialOverrides
            />
          </div>
        </aside>

        <section className="relative flex min-h-[56vh] flex-col justify-center bg-white px-6 py-12 sm:px-10 lg:min-h-screen lg:px-16 lg:py-16">
          <div className="mx-auto w-full max-w-[460px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
            {footer ? <div className="mt-10">{footer}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
