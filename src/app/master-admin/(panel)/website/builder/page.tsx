"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Palette,
  Box,
  Eye,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";

type Theme = {
  theme_uid: string;
  name: string;
  tokens: any;
  is_active: boolean;
};

type Category = {
  category_uid: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
};

type Showcase = {
  showcase_uid: string;
  category_uid: string;
  name: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  cta_label: string;
  cta_link: string;
  glb_model_uid: string | null;
};

export default function WebsiteBuilderPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  
  const [activeTab, setActiveTab] = useState<"design" | "showcase">("design");
  const [selectedThemeUid, setSelectedThemeUid] = useState("");
  const [selectedShowcaseUid, setSelectedShowcaseUid] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const activeTheme = themes.find((t) => t.theme_uid === selectedThemeUid);
  const activeShowcase = showcases.find((s) => s.showcase_uid === selectedShowcaseUid);

  const fetchBuilderData = () => {
    Promise.all([
      fetch("/api/master-admin/website/builder/themes", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/master-admin/website/builder/showcase", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([themeData, showcaseData]) => {
        if (themeData.themes) {
          setThemes(themeData.themes);
          const active = themeData.themes.find((t: any) => t.is_active) || themeData.themes[0];
          if (active) setSelectedThemeUid(active.theme_uid);
        }
        if (showcaseData.categories) setCategories(showcaseData.categories);
        if (showcaseData.showcases) {
          setShowcases(showcaseData.showcases);
          if (showcaseData.showcases[0]) setSelectedShowcaseUid(showcaseData.showcases[0].showcase_uid);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useDeferredEffect(() => {
    if (typeof window !== "undefined") {
      setPreviewUrl(window.location.origin);
    }
    fetchBuilderData();
  }, []);

  const handleApplyTheme = async (themeUid: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/builder/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", theme_uid: themeUid }),
      });

      if (res.ok) {
        alert("Theme applied successfully!");
        fetchBuilderData();
        refreshPreview();
      } else {
        alert("Failed to apply theme.");
      }
    } catch {
      alert("Error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThemeTokens = async () => {
    if (!activeTheme) return;
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/builder/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeTheme),
      });

      if (res.ok) {
        alert("Theme tokens saved successfully!");
        // Re-apply to push to settings variables
        await handleApplyTheme(activeTheme.theme_uid);
      } else {
        alert("Save failed.");
      }
    } catch {
      alert("Error.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShowcase = async () => {
    if (!activeShowcase) return;
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/builder/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "showcase", ...activeShowcase }),
      });

      if (res.ok) {
        alert("Showcase item saved successfully!");
        fetchBuilderData();
        refreshPreview();
      } else {
        alert("Save failed.");
      }
    } catch {
      alert("Error.");
    } finally {
      setSaving(false);
    }
  };

  const refreshPreview = () => {
    const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement | null;
    if (iframe) iframe.src = iframe.src;
  };

  const updateThemeToken = (key: string, value: string) => {
    setThemes((prev) =>
      prev.map((t) =>
        t.theme_uid === selectedThemeUid
          ? { ...t, tokens: { ...t.tokens, [key]: value } }
          : t
      )
    );
  };

  const updateShowcaseField = (key: keyof Showcase, value: any) => {
    setShowcases((prev) =>
      prev.map((s) => (s.showcase_uid === selectedShowcaseUid ? { ...s, [key]: value } : s))
    );
  };

  const inputClass =
    "h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none focus:border-slate-800 transition";

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <div className="dash-premium-card p-8 text-center text-[13px] font-semibold text-[#667085]">
          Loading Builder Workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="No-Code Website Builder"
        subtitle="Customize colors, layouts, branding themes, and categories with zero code."
        backHref="/master-admin/website"
        backLabel="Back to CMS"
        actions={
          <button
            type="button"
            onClick={refreshPreview}
            className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
          >
            <Eye size={14} />
            Reload Preview
          </button>
        }
      />

      {/* Main Workspace Split screen */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] xl:grid-cols-[1.5fr_1fr]">
        
        {/* Left Side Options Panel */}
        <div className="space-y-3">
          <div className="dash-premium-card overflow-hidden">
            <div className="flex overflow-x-auto border-b border-[#ECECEC] px-2 pt-1">
              {(
                [
                  { id: "design" as const, label: "Design System & Themes" },
                  { id: "showcase" as const, label: "Dynamic Showcases" },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative shrink-0 px-4 py-3.5 text-[13px] font-semibold transition ${
                      active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                    }`}
                  >
                    {tab.label}
                    {active ? (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: Design system */}
          {activeTab === "design" && activeTheme && (
            <div className="dash-premium-card space-y-6 p-6">
              <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                    <Palette size={16} />
                    Active Theme Customization
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Editing: {activeTheme.name}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyTheme(activeTheme.theme_uid)}
                    className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                  >
                    Apply Theme
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveThemeTokens}
                    disabled={saving}
                    className="dash-premium-btn-primary h-9 px-3 text-[11px] disabled:opacity-50"
                  >
                    Save tokens
                  </button>
                </div>
              </div>

              <UserFilterDropdown
                compact
                className="w-full"
                menuWidth={280}
                label="Select Theme Template"
                menuTitle="Theme"
                value={selectedThemeUid}
                options={themes.map((t) => t.theme_uid)}
                onChange={setSelectedThemeUid}
                renderOption={(value) => {
                  const t = themes.find((item) => item.theme_uid === value);
                  return t ? `${t.name}${t.is_active ? " (Active)" : ""}` : value;
                }}
                renderValue={(value) => {
                  const t = themes.find((item) => item.theme_uid === value);
                  return t ? `${t.name}${t.is_active ? " (Active)" : ""}` : value;
                }}
              />

              {/* Color pickers grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Brand Palette Tokens</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500">Primary Branding Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeTheme.tokens.primary || "#B9FF2C"}
                        onChange={(e) => updateThemeToken("primary", e.target.value)}
                        className="h-8 w-8 rounded border cursor-pointer"
                      />
                      <input
                        value={activeTheme.tokens.primary}
                        onChange={(e) => updateThemeToken("primary", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500">Secondary BG/Header</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeTheme.tokens.secondary || "#111111"}
                        onChange={(e) => updateThemeToken("secondary", e.target.value)}
                        className="h-8 w-8 rounded border cursor-pointer"
                      />
                      <input
                        value={activeTheme.tokens.secondary}
                        onChange={(e) => updateThemeToken("secondary", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500">Body Background Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeTheme.tokens.background || "#FFFFFF"}
                        onChange={(e) => updateThemeToken("background", e.target.value)}
                        className="h-8 w-8 rounded border cursor-pointer"
                      />
                      <input
                        value={activeTheme.tokens.background}
                        onChange={(e) => updateThemeToken("background", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography selectors */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Typography Manager</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                    Heading Font (Google Font)
                    <input
                      value={activeTheme.tokens.fontHeading || "Outfit"}
                      onChange={(e) => updateThemeToken("fontHeading", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                    Body Text Font (Google Font)
                    <input
                      value={activeTheme.tokens.fontBody || "Inter"}
                      onChange={(e) => updateThemeToken("fontBody", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>

              {/* Spacing & Borders */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Borders & Styling Tokens</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                    Border Radius (Cards)
                    <input
                      value={activeTheme.tokens.radiusCard || "24px"}
                      onChange={(e) => updateThemeToken("radiusCard", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                    Border Radius (Buttons)
                    <input
                      value={activeTheme.tokens.radiusBtn || "9999px"}
                      onChange={(e) => updateThemeToken("radiusBtn", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Dynamic Showcases */}
          {activeTab === "showcase" && activeShowcase && (
            <div className="dash-premium-card space-y-6 p-6">
              <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
                <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                  <Box size={16} />
                  Product Showcases Manager
                </h3>

                <button
                  type="button"
                  onClick={handleSaveShowcase}
                  disabled={saving}
                  className="dash-premium-btn-primary h-9 px-4 text-[11px] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Showcase"}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <UserFilterDropdown
                  compact
                  className="w-full"
                  menuWidth={240}
                  label="Select Showcase Item to Customize"
                  menuTitle="Showcase"
                  value={selectedShowcaseUid}
                  options={showcases.map((sh) => sh.showcase_uid)}
                  onChange={setSelectedShowcaseUid}
                  renderOption={(value) =>
                    showcases.find((sh) => sh.showcase_uid === value)?.name || value
                  }
                  renderValue={(value) =>
                    showcases.find((sh) => sh.showcase_uid === value)?.name || value
                  }
                />

                <UserFilterDropdown
                  compact
                  className="w-full"
                  menuWidth={240}
                  label="Showcase Category Mapping"
                  menuTitle="Category"
                  value={activeShowcase.category_uid}
                  options={categories.map((cat) => cat.category_uid)}
                  onChange={(value) => updateShowcaseField("category_uid", value)}
                  renderOption={(value) =>
                    categories.find((cat) => cat.category_uid === value)?.name || value
                  }
                  renderValue={(value) =>
                    categories.find((cat) => cat.category_uid === value)?.name || value
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Showcase Title
                  <input
                    value={activeShowcase.title}
                    onChange={(e) => updateShowcaseField("title", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Showcase Subtitle
                  <input
                    value={activeShowcase.subtitle}
                    onChange={(e) => updateShowcaseField("subtitle", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                Detailed Product Description
                <textarea
                  value={activeShowcase.description || ""}
                  onChange={(e) => updateShowcaseField("description", e.target.value)}
                  className="min-h-20 rounded-xl border border-slate-200 p-3.5 text-xs font-semibold"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Button Label
                  <input
                    value={activeShowcase.cta_label}
                    onChange={(e) => updateShowcaseField("cta_label", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Button Link / Path
                  <input
                    value={activeShowcase.cta_link}
                    onChange={(e) => updateShowcaseField("cta_link", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right Iframe Live Preview */}
        <div className="dash-premium-card hidden h-[750px] flex-col p-4 lg:flex">
          <div className="mb-3 flex items-center justify-between border-b border-[#ECECEC] pb-3">
            <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
              <Eye size={16} className="text-emerald-600" />
              Live Preview Screen
            </h3>
            <span className="text-[10px] font-bold text-slate-400 font-mono">Real-time theme rendering</span>
          </div>
          <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50">
            {previewUrl ? (
              <iframe
                id="preview-iframe"
                src={previewUrl}
                className="w-full h-full border-none"
                title="Website CMS Live Preview"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs font-bold text-slate-400">Loading Preview...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
