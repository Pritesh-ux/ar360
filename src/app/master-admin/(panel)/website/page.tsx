"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Sliders,
  Image as ImageIcon,
  Box,
  Settings as SettingsIcon,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";

type Statistics = {
  pages: number;
  sections: number;
  assets: number;
  models: number;
  cards: number;
  lastUpdated: string;
};

export default function WebsiteDashboardPage() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/master-admin/website/dashboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.statistics) setStats(data.statistics);
      })
      .catch((err) => console.error("Failed to load statistics", err))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      title: "Visual Editor",
      description: "Click-to-edit live preview with draft, publish, media, use cases, and style presets.",
      count: stats?.sections ?? 0,
      href: "/master-admin/website/landing",
      icon: Sliders,
      color: "bg-blue-50 text-blue-600",
      primary: true,
    },
    {
      title: "Assets",
      description: "Upload and manage images for the landing page, popup, and use-case covers.",
      count: stats?.assets ?? 0,
      href: "/master-admin/website/assets",
      icon: ImageIcon,
      color: "bg-violet-50 text-violet-600",
      primary: false,
    },
    {
      title: "GLB Models",
      description: "Hero and use-case 3D models used on the public landing page.",
      count: stats?.models ?? 0,
      href: "/master-admin/website/models",
      icon: Box,
      color: "bg-amber-50 text-amber-600",
      primary: false,
    },
    {
      title: "Policies",
      description: "Privacy, Terms, Refund, and other legal CMS pages.",
      count: stats?.pages ?? 0,
      href: "/master-admin/website/policy",
      icon: FileText,
      color: "bg-emerald-50 text-emerald-600",
      primary: false,
    },
    {
      title: "Global Settings",
      description: "Company info, socials, and navigation defaults.",
      count: null as number | null,
      href: "/master-admin/website/settings",
      icon: SettingsIcon,
      color: "bg-slate-100 text-slate-700",
      primary: false,
    },
  ];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Website"
        subtitle="Primary control: Visual Landing Editor. Assets, models, policies, and global settings stay available as secondary tools."
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="dash-premium-card h-44 animate-pulse p-5" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className="dash-premium-card dash-premium-card--lift group relative p-5 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className={`rounded-xl p-3 ${card.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-2xl font-black text-[#0F1412] transition-transform group-hover:scale-105">
                      {card.count == null ? "—" : card.count}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-[#0F1412]">{card.title}</h3>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-[#667085]">
                    {card.description}
                  </p>
                  <Link
                    href={card.href}
                    className="absolute inset-0 rounded-[20px]"
                    aria-label={`Manage ${card.title}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="dash-premium-card flex flex-col justify-between p-6 lg:col-span-2">
              <div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[#FAFAFB] p-2.5 text-[#374151]">
                    <SettingsIcon size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0F1412]">General Site Configuration</h2>
                    <p className="text-xs font-medium text-[#667085]">
                      Edit business profiles, custom links, sitemaps, and global SEO.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFB] p-4">
                    <h4 className="text-xs font-bold text-[#111827]">SEO & Metadata</h4>
                    <p className="mt-1 text-[11px] font-medium text-[#667085]">
                      Set default title templates, tags, canonical URLs, and index flags.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFB] p-4">
                    <h4 className="text-xs font-bold text-[#111827]">Navigation Menus</h4>
                    <p className="mt-1 text-[11px] font-medium text-[#667085]">
                      Configure drag-drop link routing for Navbar and Footer slots.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#ECECEC] pt-5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#667085]">
                  <Clock size={14} />
                  Last system modification:{" "}
                  {stats ? new Date(stats.lastUpdated).toLocaleDateString() : "Loading..."}
                </div>
                <Link
                  href="/master-admin/website/settings"
                  className="dash-premium-btn-primary h-10 px-4 text-[12px]"
                >
                  Configure
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            <div className="dash-premium-card flex flex-col justify-between bg-[#FAFAFB] p-6">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black text-[#0F1412]">
                  <TrendingUp size={16} className="text-[#84D400]" />
                  Visual Landing Editor
                </h3>
                <p className="mt-2 text-xs font-medium leading-relaxed text-[#667085]">
                  Save a draft, preview it authenticated, then publish. Public visitors only see
                  published content; restore from version history anytime.
                </p>
              </div>
              <Link
                href="/master-admin/website/landing"
                className="dash-premium-btn-primary mt-6 h-10 w-full text-[12px]"
              >
                Open Visual Editor
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
