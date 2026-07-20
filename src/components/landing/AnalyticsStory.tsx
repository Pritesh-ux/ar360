"use client";

import { motion } from "framer-motion";
import {
  Eye,
  QrCode,
  Smartphone,
  Clock,
  ZoomIn,
  RotateCcw,
  Monitor,
  MapPin,
  Percent,
} from "lucide-react";
import { CARD_SHADOW, DISPLAY, SECTION_PAD } from "./landingMotion";

const metrics = [
  { label: "Views", val: "24.8K", change: "+12.4%", icon: Eye },
  { label: "AR Opens", val: "8.6K", change: "+15.1%", icon: Smartphone },
  { label: "QR Scans", val: "12.3K", change: "+8.2%", icon: QrCode },
  { label: "Avg. Time", val: "2m 18s", change: "+6.4%", icon: Clock },
  { label: "Zoom Count", val: "41.2K", change: "+9.1%", icon: ZoomIn },
  { label: "Rotations", val: "96.4K", change: "+11.0%", icon: RotateCcw },
];

const chartBars = [28, 42, 36, 58, 48, 72, 64, 80, 70, 88, 76, 94];
const heatmap = [0.2, 0.45, 0.7, 0.9, 0.55, 0.35, 0.8, 0.6, 0.4, 0.95, 0.5, 0.3];

const countries = [
  { name: "India", pct: 38 },
  { name: "United States", pct: 22 },
  { name: "UAE", pct: 14 },
  { name: "UK", pct: 11 },
];

const devices = [
  { name: "Mobile", pct: 64 },
  { name: "Desktop", pct: 28 },
  { name: "Tablet", pct: 8 },
];

export default function AnalyticsStory() {
  return (
    <section
      id="analytics-growth"
      className={`border-b border-[#E8EAED] bg-[#F7F8FA] ${SECTION_PAD}`}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
              Measure engagement
            </p>
            <h2
              className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
            >
              Track what customers explore.
            </h2>
            <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-[#6B7078]">
              Views, heatmaps, devices, and conversion signals — per product, ready for decisions.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-[#E8EAED] bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9098]">
                  Conversion
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xl font-bold text-[#111111]">
                  <Percent size={16} className="text-[#84D400]" />
                  4.8%
                </p>
              </div>
              <div className="rounded-2xl border border-[#E8EAED] bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9098]">
                  Engagement
                </p>
                <p className="mt-1 text-xl font-bold text-[#111111]">High</p>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`rounded-[28px] border border-[#E8EAED] bg-white p-5 sm:p-6 ${CARD_SHADOW}`}
          >
            <div className="mb-5 flex items-center justify-between border-b border-[#F0F1F3] pb-3">
              <span className="text-sm font-bold text-[#111111]">Dashboard Overview</span>
              <span className="rounded-full bg-[#B9FF2C] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#111111]">
                Sample
              </span>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {metrics.map((m, i) => {
                const Icon = m.icon;
                return (
                  <motion.div
                    key={m.label}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04, duration: 0.35 }}
                    className="rounded-2xl border border-[#E8EAED] bg-[#F7F8FA] p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#8A9098]">{m.label}</span>
                      <Icon size={11} className="text-[#6B7078]" />
                    </div>
                    <div className="text-[15px] font-bold text-[#111111]">{m.val}</div>
                    <span className="text-[10px] font-bold text-[#3D8B40]">{m.change}</span>
                  </motion.div>
                );
              })}
            </div>

            <div className="mb-5 rounded-2xl border border-[#E8EAED] bg-[#FAFBFC] p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8A9098]">
                Engagement trend
              </p>
              <div className="flex h-24 items-end gap-1.5">
                {chartBars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.03, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="flex-1 rounded-t-md bg-[#B9FF2C]/75 hover:bg-[#B9FF2C]"
                  />
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#8A9098]">
                Interaction heatmap
              </p>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                {heatmap.map((v, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.02 }}
                    className="aspect-square rounded-md"
                    style={{ backgroundColor: `rgba(185,255,44,${0.15 + v * 0.75})` }}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8A9098]">
                  <MapPin size={10} /> Top countries
                </p>
                <div className="space-y-2">
                  {countries.map((c) => (
                    <div key={c.name}>
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-[#6B7078]">
                        <span>{c.name}</span>
                        <span>{c.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF0F2]">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${c.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-[#B9FF2C]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8A9098]">
                  <Monitor size={10} /> Device types
                </p>
                <div className="space-y-2">
                  {devices.map((d) => (
                    <div key={d.name}>
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-[#6B7078]">
                        <span>{d.name}</span>
                        <span>{d.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF0F2]">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${d.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-[#111111]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
