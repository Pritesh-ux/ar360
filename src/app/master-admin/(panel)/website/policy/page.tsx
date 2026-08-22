"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Globe,
  Plus,
  Save,
  XCircle,
} from "lucide-react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useMasterAdminToast } from "@/components/features/master-admin/MasterAdminToastContext";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import "@/components/dashboard/dashboard-premium.css";

type LandingPolicySettings = {
  landingPrivacyPolicy: string;
  landingTermsOfService: string;
  landingHeroModel: string;
  landingAddress: string;
  landingFurnitureModel: string;
  landingTilesModel: string;
  landingShoesModel: string;
  landingPackagingModel: string;
  landingElectronicsModel: string;
  landingJewelryModel: string;
  landingFashionModel: string;
  landingAutomotiveModel: string;
};

type PageItem = {
  page_uid: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  updated_at: string;
};

const EMPTY: LandingPolicySettings = {
  landingPrivacyPolicy: "",
  landingTermsOfService: "",
  landingHeroModel: "",
  landingAddress: "",
  landingFurnitureModel: "",
  landingTilesModel: "",
  landingShoesModel: "",
  landingPackagingModel: "",
  landingElectronicsModel: "",
  landingJewelryModel: "",
  landingFashionModel: "",
  landingAutomotiveModel: "",
};

export default function LandingPolicySettingsPage() {
  const { showToast } = useMasterAdminToast();
  const [settings, setSettings] = useState<LandingPolicySettings>(EMPTY);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useDeferredEffect(() => {
    void Promise.all([
      fetch("/api/master-admin/settings", { cache: "no-store" }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load settings.");
        return data.settings || {};
      }),
      fetch("/api/master-admin/website/pages", { cache: "no-store" }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        return (data.pages || []) as PageItem[];
      }),
    ])
      .then(([next, pageRows]) => {
        setSettings((prev) => ({
          ...prev,
          landingPrivacyPolicy: String(next.landingPrivacyPolicy || ""),
          landingTermsOfService: String(next.landingTermsOfService || ""),
          landingHeroModel: String(next.landingHeroModel || ""),
          landingAddress: String(next.landingAddress || ""),
          landingFurnitureModel: String(next.landingFurnitureModel || ""),
          landingTilesModel: String(next.landingTilesModel || ""),
          landingShoesModel: String(next.landingShoesModel || ""),
          landingPackagingModel: String(next.landingPackagingModel || ""),
          landingElectronicsModel: String(next.landingElectronicsModel || ""),
          landingJewelryModel: String(next.landingJewelryModel || ""),
          landingFashionModel: String(next.landingFashionModel || ""),
          landingAutomotiveModel: String(next.landingAutomotiveModel || ""),
        }));
        setPages(pageRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          reason: "Update landing page and policy settings",
          settings,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      if (data.settings) {
        setSettings((prev) => ({
          ...prev,
          landingPrivacyPolicy: String(data.settings.landingPrivacyPolicy || prev.landingPrivacyPolicy),
          landingTermsOfService: String(data.settings.landingTermsOfService || prev.landingTermsOfService),
          landingHeroModel: String(data.settings.landingHeroModel || prev.landingHeroModel),
          landingAddress: String(data.settings.landingAddress || prev.landingAddress),
          landingFurnitureModel: String(data.settings.landingFurnitureModel || prev.landingFurnitureModel),
          landingTilesModel: String(data.settings.landingTilesModel || prev.landingTilesModel),
          landingShoesModel: String(data.settings.landingShoesModel || prev.landingShoesModel),
          landingPackagingModel: String(data.settings.landingPackagingModel || prev.landingPackagingModel),
          landingElectronicsModel: String(data.settings.landingElectronicsModel || prev.landingElectronicsModel),
          landingJewelryModel: String(data.settings.landingJewelryModel || prev.landingJewelryModel),
          landingFashionModel: String(data.settings.landingFashionModel || prev.landingFashionModel),
          landingAutomotiveModel: String(data.settings.landingAutomotiveModel || prev.landingAutomotiveModel),
        }));
      }
      showToast("Policy settings saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      showToast(msg, "err");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]";
  const textareaClass =
    "min-h-36 w-full rounded-[14px] border border-[#ECECEC] bg-white p-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]";

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Policies & Pages"
        subtitle="Footer, hero/use-case models, Privacy/Terms HTML, and legal CMS pages — all in one place."
        backHref="/master-admin/website"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/master-admin/website/pages/new"
              className="dash-premium-btn-secondary h-10 px-4 text-[12px]"
            >
              <Plus size={15} />
              Create page
            </Link>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={loading || saving}
              className="dash-premium-btn-primary h-10 px-4 text-[12px] disabled:opacity-60"
            >
              <Save size={15} />
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        }
      />

      {error ? (
        <div className="dash-premium-card border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="dash-premium-card h-64 animate-pulse p-5" />
      ) : (
        <>
          <section className="dash-premium-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECECEC] px-5 py-4">
              <div className="flex items-center gap-3">
                <FileText className="text-slate-700" size={18} />
                <div>
                  <h2 className="text-[15px] font-black text-[#111827]">CMS legal & custom pages</h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Privacy, Terms, Refunds, About, and other published site pages.
                  </p>
                </div>
              </div>
            </div>
            {pages.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                No CMS pages yet. Create Privacy, Terms, or custom pages here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-[#667085]">
                  <thead>
                    <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                      <th className="px-5 py-3">Title</th>
                      <th className="px-5 py-3">Slug</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECECEC] font-semibold text-[#374151]">
                    {pages.map((page) => (
                      <tr key={page.page_uid} className="hover:bg-[#FAFAFB]">
                        <td className="px-5 py-3 font-bold text-[#0F1412]">{page.title}</td>
                        <td className="px-5 py-3 font-mono text-xs">/{page.slug}</td>
                        <td className="px-5 py-3">
                          {page.status === "published" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                              <CheckCircle2 size={12} />
                              Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-1 text-xs font-bold text-[#667085]">
                              <XCircle size={12} />
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <a
                              href={`/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dash-premium-btn-secondary grid h-9 w-9 place-items-center p-0"
                              title="View live page"
                            >
                              <Eye size={16} />
                            </a>
                            <Link
                              href={`/master-admin/website/pages/${page.page_uid}`}
                              className="dash-premium-btn-primary h-9 px-3 text-[11px]"
                            >
                              Edit
                              <ChevronRight size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dash-premium-card space-y-6 p-5">
            <div className="flex items-center gap-3">
              <Globe className="text-slate-800" />
              <div>
                <h2 className="text-lg font-black text-[#111827]">Landing policy settings</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Footer address, hero/use-case GLB paths, and legal HTML used by the public site.
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">General Info</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Footer Address
                  <input
                    value={settings.landingAddress}
                    onChange={(e) => setSettings({ ...settings, landingAddress: e.target.value })}
                    placeholder="e.g. AR360 Studio · India"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Hero Section GLB Model Path
                  <input
                    value={settings.landingHeroModel}
                    onChange={(e) => setSettings({ ...settings, landingHeroModel: e.target.value })}
                    placeholder="e.g. /models/chair_01.glb"
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Use Cases GLB Models (Landing Page Tabs)
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                {(
                  [
                    ["landingFurnitureModel", "Furniture", "/models/use-cases/furniture.glb"],
                    ["landingTilesModel", "Tiles", "/models/use-cases/tiles.glb"],
                    ["landingShoesModel", "Shoes", "/models/use-cases/shoes.glb"],
                    ["landingPackagingModel", "Packaging", "/models/use-cases/packaging.glb"],
                    ["landingElectronicsModel", "Electronics", "/models/use-cases/electronics.glb"],
                    ["landingJewelryModel", "Jewelry", "/models/use-cases/jewelry.glb"],
                    ["landingFashionModel", "Fashion", "/models/use-cases/fashion.glb"],
                    ["landingAutomotiveModel", "Automotive", "/models/use-cases/automotive.glb"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label key={key} className="flex flex-col gap-1 text-xs font-bold text-slate-400">
                    {label} Tab GLB Model
                    <input
                      value={settings[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                      placeholder={placeholder}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Legal Policies HTML Content
              </h3>
              <div className="grid gap-4">
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Privacy Policy HTML
                  <textarea
                    value={settings.landingPrivacyPolicy}
                    onChange={(e) => setSettings({ ...settings, landingPrivacyPolicy: e.target.value })}
                    placeholder="HTML Content of Privacy Policy..."
                    className={textareaClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Terms of Service HTML
                  <textarea
                    value={settings.landingTermsOfService}
                    onChange={(e) => setSettings({ ...settings, landingTermsOfService: e.target.value })}
                    placeholder="HTML Content of Terms of Service..."
                    className={textareaClass}
                  />
                </label>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
