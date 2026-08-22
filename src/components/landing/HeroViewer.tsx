"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Palette,
  QrCode,
  RotateCcw,
  Smartphone,
  X,
} from "lucide-react";
import { type ViewerMaterial } from "@/components/shared/ModelViewer";
import ModelViewer from "./LandingModelViewer";

const MATERIALS = [
  { id: "linen", label: "Linen", color: "#E8E0D4", metal: 0.05, rough: 0.72 },
  { id: "olive", label: "Olive", color: "#8C9B7E", metal: 0.08, rough: 0.65 },
  { id: "charcoal", label: "Charcoal", color: "#2A2D34", metal: 0.12, rough: 0.55 },
  { id: "crimson", label: "Crimson", color: "#8A2A2A", metal: 0.1, rough: 0.6 },
];

const LIGHTING = [
  { id: "studio", label: "Studio", exposure: 1.12, shadow: 1.1 },
  { id: "bright", label: "Bright", exposure: 1.45, shadow: 0.85 },
  { id: "moody", label: "Moody", exposure: 0.85, shadow: 1.4 },
];

const MOODS = [
  { id: "studio", label: "Studio", bg: "#FFFFFF" },
  { id: "warm", label: "Warm", bg: "#FFFFFF" },
  { id: "cool", label: "Cool", bg: "#FFFFFF" },
];

function isWoodOrHardware(name: string) {
  return /wood|leg|oak|walnut|metal|frame|screw|bolt|hardware|base/i.test(name);
}

type HeroViewerProps = {
  scrollOrbitDeg?: number;
  modelSrc?: string;
};

export default function HeroViewer({ scrollOrbitDeg = 25, modelSrc = "/models/chair_01.glb" }: HeroViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [materialId, setMaterialId] = useState(MATERIALS[0].id);
  const [lightId, setLightId] = useState(LIGHTING[0].id);
  const [moodId, setMoodId] = useState(MOODS[0].id);
  const [showQr, setShowQr] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewerMaterials, setViewerMaterials] = useState<ViewerMaterial[]>([]);
  const [showMobileMaterials, setShowMobileMaterials] = useState(false);

  const material = MATERIALS.find((m) => m.id === materialId) || MATERIALS[0];
  const lighting = LIGHTING.find((l) => l.id === lightId) || LIGHTING[0];
  const mood = MOODS.find((m) => m.id === moodId) || MOODS[0];

  const fabricIndices = useMemo(() => {
    if (!viewerMaterials.length) return [0];
    const fabric = viewerMaterials
      .filter((m) => !isWoodOrHardware(m.name || ""))
      .map((m) => m.index);
    return fabric.length ? fabric : viewerMaterials.map((m) => m.index);
  }, [viewerMaterials]);

  const allMaterialSettings = useMemo(() => {
    const map: Record<
      number,
      {
        baseColor: string;
        metalness: number;
        roughness: number;
        emissiveColor: string;
      }
    > = {};
    for (const index of fabricIndices) {
      map[index] = {
        baseColor: material.color,
        metalness: material.metal,
        roughness: material.rough,
        emissiveColor: "#000000",
      };
    }
    return map;
  }, [fabricIndices, material]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    // Mount once when near viewport — never unmount/remount (that reloads GLB
    // and fights model-viewer's IntersectionObserver → bail-out loop + memory).
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "120px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = hostRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const orbit = `${scrollOrbitDeg}deg 68deg 115%`;

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded-[28px] sm:min-h-[520px] lg:min-h-[560px]"
      style={{ background: mood.bg }}
    >
      <div className="absolute inset-0 select-none">
        {mounted ? (
          <>
            <ModelViewer
              src={modelSrc}
              loading="eager"
              showLoadProgress={false}
              cameraControls
              autoRotate={autoRotate}
              cameraOrbit={orbit}
              cameraTarget="0m 0.4m 0m"
              fov={24}
              shadowIntensity={lighting.shadow}
              shadowSoftness={0.9}
              environmentImage="neutral"
              exposure={lighting.exposure}
              transparent={false}
              backgroundColor="#FFFFFF"
              selectedMaterialIndex={fabricIndices[0] ?? 0}
              baseColor={material.color}
              metalness={material.metal}
              roughness={material.rough}
              allMaterialSettings={allMaterialSettings}
              showArButton
              interactionPrompt={false}
              onMaterialsLoaded={(mats) => setViewerMaterials(mats)}
              onLoadProgress={(p) => {
                setProgress(p);
                if (p >= 100) setLoading(false);
              }}
              onModelReady={() => setLoading(false)}
            />
            {loading && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[150px] rounded-full bg-white/90 p-3 text-center shadow-md backdrop-blur-sm">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-[#B6FF38] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="mt-2 block text-[10px] font-bold text-slate-500">
                    Loading {progress}%
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-[#F0F1F3]" />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 sm:p-4">
        <div className="pointer-events-auto hidden flex-wrap gap-1.5 md:flex">
          {MATERIALS.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.label}
              onClick={() => setMaterialId(m.id)}
              className={`h-8 w-8 rounded-full border-2 shadow-sm transition hover:scale-110 ${
                materialId === m.id
                  ? "scale-110 border-[#111111] ring-2 ring-[#b9ff2c]/60"
                  : "border-white"
              }`}
              style={{ backgroundColor: m.color }}
              aria-label={`Fabric ${m.label}`}
              aria-pressed={materialId === m.id}
            />
          ))}
        </div>

        <div className="pointer-events-auto relative md:hidden">
          <button
            type="button"
            onClick={() => setShowMobileMaterials((v) => !v)}
            className={`grid h-9 w-9 place-items-center rounded-full border shadow-sm backdrop-blur-md transition ${
              showMobileMaterials
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-[#E8EAED]/80 bg-white/85 text-[#111111]"
            }`}
            title="Materials"
            aria-expanded={showMobileMaterials}
            aria-label="Toggle materials"
          >
            <Palette size={14} />
          </button>
          {showMobileMaterials ? (
            <div className="absolute left-0 top-11 flex gap-1.5 rounded-2xl border border-[#E8EAED]/80 bg-white/95 p-2 shadow-lg backdrop-blur-md">
              {MATERIALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={m.label}
                  onClick={() => setMaterialId(m.id)}
                  className={`h-8 w-8 rounded-full border-2 shadow-sm transition ${
                    materialId === m.id
                      ? "scale-110 border-[#111111] ring-2 ring-[#b9ff2c]/60"
                      : "border-white"
                  }`}
                  style={{ backgroundColor: m.color }}
                  aria-label={`Fabric ${m.label}`}
                  aria-pressed={materialId === m.id}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#E8EAED]/80 bg-white/85 text-[#111111] shadow-sm backdrop-blur-md transition hover:scale-105 hover:bg-white"
            title={autoRotate ? "Pause rotation" : "Auto rotate"}
          >
            <RotateCcw size={14} className={autoRotate ? "text-[#b9ff2c]" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#E8EAED]/80 bg-white/85 text-[#111111] shadow-sm backdrop-blur-md transition hover:scale-105 hover:bg-white"
            title="QR preview"
          >
            <QrCode size={14} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#E8EAED]/80 bg-white/85 text-[#111111] shadow-sm backdrop-blur-md transition hover:scale-105 hover:bg-white"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2.5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="hidden flex-wrap gap-1 md:flex">
            {LIGHTING.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLightId(l.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:scale-[1.02] ${
                  lightId === l.id
                    ? "bg-[#111111] text-white"
                    : "bg-[#F4F5F6] text-[#6B7078] hover:text-[#111111]"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="hidden flex-wrap gap-1 md:flex">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMoodId(m.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:scale-[1.02] ${
                  moodId === m.id
                    ? "bg-[#b9ff2c] text-[#111111]"
                    : "bg-[#F4F5F6] text-[#6B7078] hover:text-[#111111]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6B7078] md:ml-auto">
            <Smartphone size={12} className="text-[#b9ff2c]" />
            Drag · Zoom · AR
          </span>
        </div>
      </div>

      {showQr && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#111111]/35 p-6 backdrop-blur-sm">
          <div className="relative w-full max-w-[240px] rounded-[24px] border border-[#E8EAED] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#F4F5F6] text-[#6B7078] transition hover:bg-[#EEF0F2]"
            >
              <X size={14} />
            </button>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7078]">
              QR Preview
            </p>
            <div className="mx-auto mt-4 grid place-items-center rounded-2xl border border-[#E8EAED] bg-[#F7F8FA] p-5">
              <QrCode size={120} className="text-[#111111]" strokeWidth={1.4} />
            </div>
            <p className="mt-3 text-center text-[12px] font-medium text-[#6B7078]">
              Scan to open AR viewer
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
