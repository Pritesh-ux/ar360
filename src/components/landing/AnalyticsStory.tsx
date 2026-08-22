"use client";

import { motion } from "framer-motion";
import {
  Eye,
  QrCode,
  Smartphone,
  Box,
  HardDrive,
  Upload,
  ArrowUpRight,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { CARD_SHADOW, DISPLAY, SECTION_PAD } from "./landingMotion";
import LandingContentParallax from "./LandingContentParallax";

type StatCard = {
  title: string;
  description: string;
};

export default function AnalyticsStory({
  items,
  title,
  subtitle,
  description,
}: {
  items?: StatCard[];
  title?: string;
  subtitle?: string;
  description?: string;
}) {
  const defaultStats = [
    { title: "+40%", description: "Conversion Rate Increase" },
    { title: "-25%", description: "Product Returns Decrease" },
  ];
  const displayStats = items && items.length > 0 ? items : defaultStats;

  return (
    <section
      id="analytics-growth"
      className={`bg-transparent ${SECTION_PAD}`}
    >
      <LandingContentParallax className="mx-auto max-w-7xl px-6">
        <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B7078] sm:text-[11px]">
              {subtitle || "Measure engagement"}
            </p>
            <h2
              className={`${DISPLAY} mt-2 text-[32px] font-bold leading-[1.08] tracking-tight text-[#111111] sm:text-[40px]`}
            >
              {title || "Track what customers explore."}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] font-medium leading-relaxed text-[#6B7078] lg:mx-0 lg:text-sm">
              {description ||
                "Views, heatmaps, devices, and conversion signals — per product, ready for decisions."}
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3 lg:justify-start">
              {displayStats.map((stat, idx) => (
                <div key={idx} className="rounded-2xl border border-[#E8EAED] bg-white px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A9098]">
                    {stat.description}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xl font-bold text-[#111111]">
                    {stat.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`rounded-[32px] border border-[#E4E7DF] bg-[#F8F9F3] p-4 sm:p-5 ${CARD_SHADOW}`}
          >
            {/* Dashboard Mock Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E7DF] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#66706B]">
                    Workspace Live
                  </span>
                </div>
                <h3 className="mt-1 text-[16px] font-black text-[#07090A]">
                  Welcome back, AR360
                </h3>
                <p className="text-[10px] font-bold text-[#66706B]">
                  Pro plan · Last 30 days
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#E4E7DF] bg-white px-2.5 text-[11px] font-bold text-[#07090A] shadow-sm transition hover:bg-[#F5F7F1]"
                >
                  Last 30 days
                  <ChevronDown size={12} className="text-[#66706B]" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#b9ff2c] px-3 text-[11px] font-black text-[#07090A] shadow-sm hover:bg-[#a3f020] transition-all"
                >
                  <Upload size={12} strokeWidth={2.5} />
                  Upload 3D Model
                </button>
              </div>
            </div>

            {/* Metrics Cards Grid (Matching actual UserMetricCard) */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { title: "Total Products", value: "14", change: "+3 new", icon: Box },
                { title: "Total Views", value: "24,800", change: "+12.4%", icon: Eye, trendUp: true },
                { title: "AR Opens", value: "8,600", change: "+15.1%", icon: Smartphone, trendUp: true },
                { title: "QR Scans", value: "12,300", change: "+8.2%", icon: QrCode, trendUp: true },
                { title: "Storage Used", value: "28.4 MB", change: "2.8% of 1GB", icon: HardDrive },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.title}
                    className="rounded-2xl border border-[#E4E7DF] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[#66706B]">
                          {m.title}
                        </p>
                        <p className="mt-1 text-[18px] font-black tracking-tight text-[#07090A] sm:text-[20px]">
                          {m.value}
                        </p>
                        {m.change && (
                          <div className="mt-1 flex items-center gap-0.5 text-[9px] font-bold">
                            {m.trendUp && <TrendingUp size={10} className="text-[#22C55E]" />}
                            <span className={m.trendUp ? "text-[#22C55E]" : "text-[#66706B]"}>
                              {m.change}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#EEFFD2] text-[#07090A]">
                        <Icon size={13} strokeWidth={2} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chart and Activity side-by-side Grid */}
            <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
              {/* Left Side: Mock UserChartCard */}
              <div className="rounded-2xl border border-[#E4E7DF] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-[12px] font-black text-[#07090A]">Analytics Overview</h4>
                  <div className="flex gap-0.5 rounded-lg bg-[#F5F7F1] p-0.5">
                    {["Views", "AR Opens", "QR Scans"].map((tab) => (
                      <span
                        key={tab}
                        className={`rounded-md px-2 py-1 text-[9px] font-bold ${
                          tab === "Views"
                            ? "bg-white text-[#07090A] shadow-sm"
                            : "text-[#66706B]"
                        }`}
                      >
                        {tab}
                      </span>
                    ))}
                  </div>
                </div>

                {/* SVG Area Line Chart with gradient fill */}
                <div className="relative h-36 w-full">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
                  >
                    <defs>
                      <linearGradient id="landingChartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b9ff2c" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#b9ff2c" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {[20, 40, 60, 80].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="100"
                        y2={y}
                        stroke="#E4E7DF"
                        strokeWidth="0.3"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}

                    {/* Chart line area fill */}
                    <path
                      d="M 0 80 C 15 80, 20 50, 35 50 C 50 50, 55 75, 70 75 C 85 75, 90 20, 100 20 L 100 100 L 0 100 Z"
                      fill="url(#landingChartFill)"
                    />

                    {/* Chart path line */}
                    <path
                      d="M 0 80 C 15 80, 20 50, 35 50 C 50 50, 55 75, 70 75 C 85 75, 90 20, 100 20"
                      fill="none"
                      stroke="#a3f020"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Pulse point at current max hover */}
                    <circle cx="85" cy="35" r="2.5" fill="#a3f020" className="animate-pulse" />
                    <line
                      x1="85"
                      y1="8"
                      x2="85"
                      y2="100"
                      stroke="#C5F031"
                      strokeWidth="0.5"
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>

                  {/* Tooltip mockup */}
                  <div
                    className="absolute z-10 rounded-xl border border-[#E4E7DF] bg-white px-2 py-1 text-[9px] shadow-[0_4px_14px_rgba(5,7,6,0.06)]"
                    style={{
                      left: "81%",
                      top: "14%",
                      transform: "translateX(-50%)",
                    }}
                  >
                    <p className="font-bold text-[#66706B]">Jul 20</p>
                    <p className="mt-0.5 text-[11px] font-black text-[#07090A]">2,480 views</p>
                  </div>

                  <div className="mt-1 flex justify-between text-[8px] font-bold text-[#66706B]">
                    <span>Jul 01</span>
                    <span>Jul 21</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Mock Recent Activity */}
              <div className="flex flex-col justify-between overflow-hidden rounded-[22px] border border-[#E4E7DF] bg-white p-3 sm:p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div>
                  <h4 className="mb-2.5 px-0.5 text-[12px] font-black text-[#07090A]">Recent Activity</h4>
                  <div className="space-y-2.5">
                    {[
                      {
                        title: "Chair GLB Uploaded",
                        desc: "Optimized successfully (1.4MB)",
                        time: "2 hours ago",
                      },
                      {
                        title: "AR Session Started",
                        desc: "iPhone 15 Pro • Bangalore, IN",
                        time: "4 hours ago",
                      },
                      {
                        title: "QR Code Generated",
                        desc: "Catalog Poster #4 QR",
                        time: "1 day ago",
                      },
                    ].map((act, i) => (
                      <div
                        key={i}
                        className="flex min-h-[58px] items-center justify-between gap-2 overflow-hidden rounded-[18px] border border-[#E4E7DF] bg-white/80 px-3 py-2.5 transition-all hover:border-[#D7DDCF] hover:bg-[#F8FAF4]"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-[#07090A]">
                            {act.title}
                          </p>
                          <p className="mt-0.5 truncate text-[9px] font-semibold text-[#66706B]">
                            {act.desc}
                          </p>
                          <p className="mt-0.5 text-[8px] font-bold text-[#66706B]/80">
                            {act.time}
                          </p>
                        </div>
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F5F7F1] text-[#66706B] transition-colors hover:text-[#07090A]">
                          <ArrowUpRight size={10} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </LandingContentParallax>
    </section>
  );
}
