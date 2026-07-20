"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModelViewer from "./LandingModelViewer";
import { Home, Cpu, Archive, Layout, Shirt, Factory } from "lucide-react";
import { CARD_SHADOW, DISPLAY, SECTION_PAD } from "./landingMotion";

const MODEL_PATH = "/models/chair_01.glb";

type ShowroomType = {
  id: string;
  name: string;
  desc: string;
  icon: typeof Home;
  exposure: number;
  shadowIntensity: number;
  orbit: string;
  bgColor: string;
};

const floors: ShowroomType[] = [
  {
    id: "furniture",
    name: "Furniture",
    desc: "Warm interior shadows for couches, chairs, and homeware.",
    icon: Home,
    exposure: 1.25,
    shadowIntensity: 1.45,
    orbit: "45deg 70deg 110%",
    bgColor: "#FFFFFF",
  },
  {
    id: "tiles",
    name: "Tiles",
    desc: "Directional ground light for surfaces and flooring.",
    icon: Layout,
    exposure: 1.05,
    shadowIntensity: 1.2,
    orbit: "20deg 55deg 105%",
    bgColor: "#FFFFFF",
  },
  {
    id: "packaging",
    name: "Packaging",
    desc: "Bright ambient light for boxes, labels, and SKUs.",
    icon: Archive,
    exposure: 1.4,
    shadowIntensity: 0.75,
    orbit: "-30deg 65deg 115%",
    bgColor: "#FFFFFF",
  },
  {
    id: "electronics",
    name: "Electronics",
    desc: "Crisp studio whites for gadgets and appliances.",
    icon: Cpu,
    exposure: 1.15,
    shadowIntensity: 1.0,
    orbit: "70deg 68deg 108%",
    bgColor: "#FFFFFF",
  },
  {
    id: "fashion",
    name: "Fashion",
    desc: "Soft fashion-floor lighting for apparel and accessories.",
    icon: Shirt,
    exposure: 1.3,
    shadowIntensity: 0.95,
    orbit: "-50deg 72deg 112%",
    bgColor: "#FFFFFF",
  },
  {
    id: "industrial",
    name: "Industrial",
    desc: "Harder shadows for tools, fixtures, and equipment.",
    icon: Factory,
    exposure: 0.95,
    shadowIntensity: 1.5,
    orbit: "110deg 60deg 120%",
    bgColor: "#FFFFFF",
  },
];

export default function StudioFloorSection() {
  const [activeFloor, setActiveFloor] = useState(floors[0]);
  const [visible, setVisible] = useState(false);
  const [morphKey, setMorphKey] = useState(0);
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

  function selectFloor(floor: ShowroomType) {
    setActiveFloor(floor);
    setMorphKey((k) => k + 1);
  }

  return (
    <section
      ref={sectionRef}
      id="studio-floor"
      className={`border-b border-[#E8EAED] bg-white ${SECTION_PAD}`}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
            Studio floor
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            Adapts to your product floor.
          </h2>
        </div>

        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {floors.map((floor) => {
            const Icon = floor.icon;
            const isActive = floor.id === activeFloor.id;
            return (
              <button
                key={floor.id}
                type="button"
                onClick={() => selectFloor(floor)}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-bold transition hover:scale-[1.02] ${
                  isActive
                    ? "bg-[#111111] text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                    : "border border-[#E8EAED] bg-[#F7F8FA] text-[#6B7078] hover:border-[#D0D4DA] hover:text-[#111111]"
                }`}
              >
                <Icon size={14} />
                {floor.name}
              </button>
            );
          })}
        </div>

        <div
          className={`relative flex h-[360px] items-center justify-center overflow-hidden rounded-[28px] border border-[#E8EAED] bg-white p-5 sm:h-[420px] ${CARD_SHADOW}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={morphKey}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              {visible ? (
                <ModelViewer
                  src={MODEL_PATH}
                  cameraControls
                  autoRotate
                  disableZoom
                  cameraOrbit={activeFloor.orbit}
                  cameraTarget="0m 0.48m 0m"
                  fov={20}
                  shadowIntensity={activeFloor.shadowIntensity}
                  shadowSoftness={0.9}
                  environmentImage="neutral"
                  exposure={activeFloor.exposure}
                  transparent={false}
                  backgroundColor="#FFFFFF"
                  disableMaterialOverrides
                  showArButton={false}
                  interactionPrompt={false}
                />
              ) : (
                <div className="h-full w-full animate-pulse rounded-2xl bg-white" />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[#E8EAED] bg-white px-4 py-3 shadow-sm sm:left-auto sm:right-5 sm:max-w-sm">
            <p className="text-[13px] font-bold text-[#111111]">{activeFloor.name}</p>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#6B7078]">
              {activeFloor.desc}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
