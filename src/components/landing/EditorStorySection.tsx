"use client";

import { useState, useEffect, useRef } from "react";
import ModelViewer from "./LandingModelViewer";
import { Sun, Camera, Palette, Layers, Smartphone, Sparkles } from "lucide-react";
import { DISPLAY, SECTION_PAD } from "./landingMotion";

const MODEL_PATH = "/models/chair_01.glb";

const colorPresets = [
  { label: "Linen", value: "#E8E0D4" },
  { label: "Olive", value: "#8C9B7E" },
  { label: "Crimson", value: "#8A2A2A" },
  { label: "Charcoal", value: "#2A2D34" },
];

const variants = [
  { id: "classic", label: "Classic", color: "#E8E0D4", metal: 0.05, rough: 0.72 },
  { id: "velvet", label: "Velvet", color: "#5C4A6B", metal: 0.05, rough: 0.85 },
  { id: "leather", label: "Leather", color: "#6B4423", metal: 0.15, rough: 0.45 },
];

export default function EditorStorySection() {
  const [exposure, setExposure] = useState(1.1);
  const [baseColor, setBaseColor] = useState("#E8E0D4");
  const [metalness, setMetalness] = useState(0.1);
  const [roughness, setRoughness] = useState(0.6);
  const [orbit, setOrbit] = useState("-35deg 70deg 110%");
  const [showAr, setShowAr] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>("materials");
  const [visible, setVisible] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const panels = [
    { id: "materials", label: "Materials", icon: Palette },
    { id: "lighting", label: "Lighting", icon: Sun },
    { id: "camera", label: "Camera", icon: Camera },
    { id: "variants", label: "Variants", icon: Layers },
    { id: "ar", label: "AR", icon: Smartphone },
  ];

  return (
    <section
      ref={sectionRef}
      id="editor-story"
      className={`relative overflow-hidden border-b border-[#E8EAED] bg-[#F7F8FA] ${SECTION_PAD}`}
    >
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
            Editor mode
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            Customize without complexity.
          </h2>
          <p className="mt-3 text-sm font-medium text-[#6B7078]">
            Floating controls. Live model. Instant feedback.
          </p>
        </div>

        <div className="relative mx-auto max-w-5xl">
          {/* Viewer stage */}
          <div className="relative mx-auto flex h-[420px] items-center justify-center rounded-[28px] border border-[#E8EAED] bg-white sm:h-[480px]">
            {visible ? (
              <ModelViewer
                src={MODEL_PATH}
                cameraControls
                autoRotate={false}
                cameraOrbit={orbit}
                cameraTarget="0m 0.48m 0m"
                fov={21}
                shadowIntensity={1.15}
                shadowSoftness={0.7}
                environmentImage="neutral"
                exposure={exposure}
                baseColor={baseColor}
                metalness={metalness}
                roughness={roughness}
                transparent={false}
                backgroundColor="#FFFFFF"
                showArButton={showAr}
                interactionPrompt={false}
              />
            ) : (
              <div className="h-64 w-64 animate-pulse rounded-full bg-slate-200/60" />
            )}

            {/* Floating left panel */}
            <div className="absolute left-0 top-4 z-10 hidden w-[200px] flex-col gap-2 md:flex lg:left-2">
              <div className="rounded-2xl border border-white/60 bg-white/70 p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                {panels.map((p) => {
                  const Icon = p.icon;
                  const active = activePanel === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePanel(p.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-bold transition hover:scale-[1.01] ${
                        active
                          ? "bg-[#111111] text-white"
                          : "text-[#6B7078] hover:bg-white/80 hover:text-[#111111]"
                      }`}
                    >
                      <Icon size={14} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floating right controls — desktop always; mobile only after tab tap */}
            <div
              className={`absolute right-0 top-4 z-10 w-[min(100%,240px)] md:right-2 ${
                mobilePanelOpen ? "block" : "hidden md:block"
              }`}
            >
              <div className="rounded-2xl border border-white/60 bg-white/75 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                {activePanel === "materials" && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7078]">
                      <Palette size={12} /> Materials
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {colorPresets.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setBaseColor(c.value)}
                          className={`flex items-center gap-2 rounded-xl border p-2 text-left transition hover:scale-[1.02] ${
                            baseColor === c.value
                              ? "border-[#111111] bg-white"
                              : "border-[#E8EAED] bg-white/50"
                          }`}
                        >
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                            style={{ backgroundColor: c.value }}
                          />
                          <span className="truncate text-[11px] font-bold text-[#111111]">
                            {c.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      <label className="flex justify-between text-[10px] font-bold text-[#6B7078]">
                        Metalness <span>{metalness.toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={metalness}
                        onChange={(e) => setMetalness(Number(e.target.value))}
                        className="w-full accent-[#B9FF2C]"
                      />
                      <label className="flex justify-between text-[10px] font-bold text-[#6B7078]">
                        Roughness <span>{roughness.toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={roughness}
                        onChange={(e) => setRoughness(Number(e.target.value))}
                        className="w-full accent-[#B9FF2C]"
                      />
                    </div>
                  </div>
                )}

                {activePanel === "lighting" && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7078]">
                      <Sun size={12} /> Lighting
                    </p>
                    <label className="flex justify-between text-[10px] font-bold text-[#6B7078]">
                      Exposure <span>{exposure.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.4"
                      max="2"
                      step="0.05"
                      value={exposure}
                      onChange={(e) => setExposure(Number(e.target.value))}
                      className="mt-1 w-full accent-[#B9FF2C]"
                    />
                    <div className="mt-3 flex gap-1.5">
                      {[0.85, 1.1, 1.4].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setExposure(v)}
                          className="flex-1 rounded-full bg-[#F4F5F6] py-1.5 text-[10px] font-bold text-[#6B7078] transition hover:bg-[#B9FF2C] hover:text-[#111111]"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activePanel === "camera" && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7078]">
                      <Camera size={12} /> Camera
                    </p>
                    <div className="space-y-2">
                      {[
                        { label: "Front", orbit: "0deg 70deg 110%" },
                        { label: "Three-quarter", orbit: "-35deg 70deg 110%" },
                        { label: "Side", orbit: "90deg 70deg 110%" },
                      ].map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => setOrbit(c.orbit)}
                          className={`w-full rounded-xl border px-3 py-2 text-left text-[12px] font-bold transition hover:scale-[1.01] ${
                            orbit === c.orbit
                              ? "border-[#111111] bg-white"
                              : "border-[#E8EAED] bg-white/50 text-[#6B7078]"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activePanel === "variants" && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7078]">
                      <Layers size={12} /> Variants
                    </p>
                    <div className="space-y-2">
                      {variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setBaseColor(v.color);
                            setMetalness(v.metal);
                            setRoughness(v.rough);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl border border-[#E8EAED] bg-white/50 px-3 py-2 text-left transition hover:border-[#111111] hover:bg-white"
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{ backgroundColor: v.color }}
                          />
                          <span className="text-[12px] font-bold text-[#111111]">{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activePanel === "ar" && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7078]">
                      <Smartphone size={12} /> AR
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAr((v) => !v)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[12px] font-bold transition ${
                        showAr ? "bg-[#B9FF2C] text-[#111111]" : "bg-[#F4F5F6] text-[#6B7078]"
                      }`}
                    >
                      Show AR button
                      <span className="text-[10px]">{showAr ? "ON" : "OFF"}</span>
                    </button>
                    <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#6B7078]">
                      Enables Quick Look / Scene Viewer on supported devices.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile panel tabs — tap again to close */}
            <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full border border-white/60 bg-white/80 p-1 shadow-md backdrop-blur-xl md:hidden">
              {panels.map((p) => {
                const Icon = p.icon;
                const active = mobilePanelOpen && activePanel === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (mobilePanelOpen && activePanel === p.id) {
                        setMobilePanelOpen(false);
                        return;
                      }
                      setActivePanel(p.id);
                      setMobilePanelOpen(true);
                    }}
                    className={`grid h-9 w-9 place-items-center rounded-full transition ${
                      active ? "bg-[#111111] text-white" : "text-[#6B7078]"
                    }`}
                    aria-label={p.label}
                    aria-pressed={active}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#6B7078]">
            <Sparkles size={12} className="text-[#84D400]" />
            Every control updates the live model instantly
          </p>
        </div>
      </div>
    </section>
  );
}
