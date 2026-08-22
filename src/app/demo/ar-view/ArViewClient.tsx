"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";

const ModelViewer = dynamic(() => import("@/components/shared/ModelViewer"), { ssr: false });

export default function ArViewClient({ modelSrc }: { modelSrc: string }) {
  return (
    <main className="relative h-screen w-screen bg-[#0A0B14] overflow-hidden select-none">
      {/* Dynamic 3D/AR Viewer */}
      <div className="absolute inset-0 h-full w-full">
        <ModelViewer
          src={modelSrc}
          cameraControls
          autoRotate={false}
          showArButton={true}
          backgroundColor="#0A0B14"
          transparent={false}
        />
      </div>

      {/* Floating UI controls */}
      <div className="absolute top-4 left-4 z-50">
        <Link
          href="/demo"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg transition hover:bg-white/20 active:scale-95"
        >
          <ArrowLeft size={18} />
        </Link>
      </div>

      {/* Dynamic overlay/helper */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xs text-center pointer-events-none">
        <div className="rounded-2xl bg-black/60 border border-white/10 p-3.5 backdrop-blur-md shadow-2xl">
          <p className="text-[12px] font-bold text-white flex items-center justify-center gap-1.5">
            <Smartphone size={14} className="text-[#B9FF2C]" />
            Real-Scale Web AR Mode
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400 font-semibold leading-relaxed">
            Move device to detect surface or click AR icon
          </p>
        </div>
      </div>
    </main>
  );
}
