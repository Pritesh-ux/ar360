"use client";

import { useEffect, useState } from "react";
import AppImage from "@/components/shared/AppImage";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import Link from "next/link";
import { ArrowRight, HelpCircle, Smartphone, ScanLine } from "lucide-react";
import { DISPLAY, LANDING_GRID_LIGHT } from "@/components/landing/landingMotion";

const ModelViewer = dynamic(() => import("@/components/shared/ModelViewer"), { ssr: false });

export default function DemoClient({ modelSrc }: { modelSrc: string }) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    const arViewUrl = `${window.location.origin}/demo/ar-view`;
    QRCode.toDataURL(arViewUrl, { margin: 2, scale: 8, color: { dark: "#0A0B14", light: "#FFFFFF" } })
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(""));
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#F4F6F8] pt-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.42]" style={LANDING_GRID_LIGHT} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 70% 20%, rgba(185,255,44,0.16), transparent 58%), radial-gradient(ellipse 40% 35% at 12% 70%, rgba(0,178,202,0.08), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-8 sm:pb-20 sm:pt-10">
        <div className="mb-8 max-w-2xl sm:mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">Live demo</p>
          <h1
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.08] tracking-tight text-[#111111] sm:text-4xl lg:text-[44px]`}
          >
            3D & AR Viewer Demo
          </h1>
          <p className="mt-3 max-w-lg text-sm font-medium leading-relaxed text-[#5C6168]">
            Rotate the model, then scan the QR to place it in your space with browser AR — no app
            install.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr] lg:gap-6">
          <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:h-[560px]">
            <ModelViewer src={modelSrc} cameraControls autoRotate />
            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-[#E8EAED] bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#5C6168] backdrop-blur">
              Interactive 3D
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[28px] border border-[#E8EAED] bg-white/95 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] sm:p-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#111111]">
                <Smartphone size={20} className="text-[#84D400]" />
                AR placement
              </h2>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#6B7078]">
                Place this product in your room with WebAR. Works on modern iOS and Android browsers.
              </p>
            </div>

            <div className="hidden flex-1 flex-col items-center justify-center rounded-2xl border border-[#E8EAED] bg-[#FAFBFC] p-5 text-center sm:flex">
              {qrCodeUrl ? (
                <AppImage
                  src={qrCodeUrl}
                  alt="AR View QR Code"
                  className="h-44 w-44 rounded-xl border border-[#E8EAED] bg-white shadow-sm"
                />
              ) : (
                <div className="h-44 w-44 animate-pulse rounded-xl bg-[#EEF0F3]" />
              )}
              <p className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#111111]">
                <ScanLine size={14} className="text-[#84D400]" />
                Scan to place in AR
              </p>
              <p className="mt-1 max-w-[240px] text-[11px] font-medium leading-relaxed text-[#8A9098]">
                Open your phone camera and point it at this QR code.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:hidden">
              <Link
                href="/demo/ar-view"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#B9FF2C] text-sm font-bold text-[#0A0B14] transition hover:scale-[1.01] hover:bg-[#A7F11D]"
              >
                <Smartphone size={16} />
                Launch Web AR
              </Link>
              <p className="text-center text-[11px] font-medium leading-relaxed text-[#8A9098]">
                Opens the full-screen viewer and starts AR on this device.
              </p>
            </div>

            <div className="border-t border-[#E8EAED] pt-4">
              <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-[#111111]">
                <HelpCircle size={14} className="text-[#84D400]" />
                How it works
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1.5 text-[12px] font-medium leading-relaxed text-[#6B7078]">
                <li>Scan the code (or tap Launch) on your phone.</li>
                <li>Allow camera access if the browser asks.</li>
                <li>Point at the floor and move slightly to detect surface.</li>
                <li>The object appears in real scale in your space.</li>
              </ol>
            </div>

            <Link
              href="/signup"
              className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#0A0B14] px-5 text-[13px] font-bold text-white transition hover:scale-[1.01] hover:bg-[#1a1b24]"
            >
              Start free
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
