"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Save,
  Eye,
  Layout,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";

type GLBModel = {
  model_uid: string;
  name: string;
};

type LandingSection = {
  section_uid: string;
  section_key: string;
  title: string;
  subtitle: string;
  description: string;
  background: string;
  visibility: boolean;
  sort_order: number;
  glb_model_uid: string | null;
  buttons: any[];
  glb_settings: any;
};

export default function SectionsEditorPage() {
  const [sections, setSections] = useState<LandingSection[]>([]);
  const [models, setModels] = useState<GLBModel[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const active = sections.find((s) => s.section_uid === selectedUid);

  useDeferredEffect(() => {
    if (typeof window !== "undefined") {
      setPreviewUrl(window.location.origin);
    }

    Promise.all([
      fetch("/api/master-admin/website/sections", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/master-admin/website/models", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([secData, modData]) => {
        if (secData.sections) {
          setSections(secData.sections);
          if (secData.sections[0]) setSelectedUid(secData.sections[0].section_uid);
        }
        if (modData.models) setModels(modData.models);
      })
      .catch((err) => console.error("Failed to load CMS data", err))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key: keyof LandingSection, value: any) => {
    if (!active) return;
    setSections((prev) =>
      prev.map((s) => (s.section_uid === selectedUid ? { ...s, [key]: value } : s))
    );
  };

  const updateGlbSetting = (key: string, value: any) => {
    if (!active) return;
    const currentSettings = active.glb_settings || {};
    updateField("glb_settings", { ...currentSettings, [key]: value });
  };

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(active),
      });

      if (res.ok) {
        alert("Section settings saved successfully!");
        // Refresh preview iframe
        const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement | null;
        if (iframe) iframe.src = iframe.src;
      } else {
        const err = await res.json();
        alert(err.error || "Save failed.");
      }
    } catch {
      alert("Failed to save section.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <div className="dash-premium-card p-8 text-center text-[13px] font-semibold text-[#667085]">
          Loading sections editor...
        </div>
      </div>
    );
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Landing Page CMS"
        subtitle="Modify layouts, custom buttons, model positions, and look of sections in real-time."
        backHref="/master-admin/website"
        backLabel="Back to CMS Dashboard"
      />

      {/* Split screen content */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.4fr_1fr]">
        
        {/* Left Form controls */}
        <div className="space-y-3">
          <div className="dash-premium-card space-y-4 p-5">
            <UserFilterDropdown
              compact
              className="w-full"
              menuWidth={320}
              label="Select Section to Edit"
              menuTitle="Section"
              value={selectedUid}
              options={sections.map((s) => s.section_uid)}
              onChange={setSelectedUid}
              renderOption={(value) => {
                const s = sections.find((item) => item.section_uid === value);
                return s ? `${s.section_key.toUpperCase()} - ${s.title || "Untitled"}` : value;
              }}
              renderValue={(value) => {
                const s = sections.find((item) => item.section_uid === value);
                return s ? `${s.section_key.toUpperCase()} - ${s.title || "Untitled"}` : value;
              }}
            />
          </div>

          {active && (
            <div className="dash-premium-card space-y-6 p-6">
              <div className="flex items-center justify-between border-b border-[#ECECEC] pb-4">
                <h2 className="text-lg font-bold text-[#0F1412]">
                  Editing Section:{" "}
                  <span className="uppercase text-[#84D400]">{active.section_key}</span>
                </h2>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="dash-premium-btn-primary h-10 px-4 text-[12px] disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              {/* Title & Subtitle */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Section Title
                  <input
                    value={active.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Section Subtitle / Eyebrow
                  <input
                    value={active.subtitle}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                  />
                </label>
              </div>

              {/* Description */}
              <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                Description
                <textarea
                  value={active.description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm font-semibold"
                />
              </label>

              {/* Layout styling & Visibility */}
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Background Style
                  <input
                    value={active.background}
                    onChange={(e) => updateField("background", e.target.value)}
                    placeholder="e.g. bg-white, bg-slate-50"
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Sort Order
                  <input
                    type="number"
                    value={active.sort_order}
                    onChange={(e) => updateField("sort_order", Number(e.target.value))}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 h-10 text-xs font-bold text-slate-600 bg-slate-50/50 mt-5">
                  Visible on site
                  <input
                    type="checkbox"
                    checked={active.visibility}
                    onChange={(e) => updateField("visibility", e.target.checked)}
                    className="h-5 w-5 rounded border-slate-200 text-slate-900 focus:ring-[#A6FF2E]"
                  />
                </label>
              </div>

              {/* GLB Model Selection & Custom Config */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Layout size={16} />
                  3D GLB Model Settings
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <UserFilterDropdown
                    compact
                    className="w-full"
                    menuWidth={280}
                    label="Showcase GLB Model"
                    menuTitle="GLB Model"
                    value={active.glb_model_uid || "none"}
                    options={["none", ...models.map((m) => m.model_uid)]}
                    onChange={(value) => updateField("glb_model_uid", value === "none" ? null : value)}
                    renderOption={(value) =>
                      value === "none"
                        ? "None (Disable 3D viewer in this section)"
                        : models.find((m) => m.model_uid === value)?.name || value
                    }
                    renderValue={(value) =>
                      value === "none"
                        ? "None (Disable 3D viewer)"
                        : models.find((m) => m.model_uid === value)?.name || value
                    }
                  />

                  <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                    Camera Exposure
                    <input
                      type="number"
                      step="0.1"
                      value={active.glb_settings?.exposure ?? 1.0}
                      onChange={(e) => updateGlbSetting("exposure", Number(e.target.value))}
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex items-center justify-between rounded-xl border p-3 text-xs font-bold bg-slate-50/50">
                    Auto-Rotate
                    <input
                      type="checkbox"
                      checked={active.glb_settings?.autoRotate ?? true}
                      onChange={(e) => updateGlbSetting("autoRotate", e.target.checked)}
                      className="h-5 w-5 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border p-3 text-xs font-bold bg-slate-50/50">
                    Camera Controls
                    <input
                      type="checkbox"
                      checked={active.glb_settings?.cameraControls ?? true}
                      onChange={(e) => updateGlbSetting("cameraControls", e.target.checked)}
                      className="h-5 w-5 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border p-3 text-xs font-bold bg-slate-50/50">
                    WebAR Button
                    <input
                      type="checkbox"
                      checked={active.glb_settings?.arButton ?? true}
                      onChange={(e) => updateGlbSetting("arButton", e.target.checked)}
                      className="h-5 w-5 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Iframe Live Preview */}
        <div className="dash-premium-card hidden h-[750px] flex-col p-4 lg:flex">
          <div className="mb-3 flex items-center justify-between border-b border-[#ECECEC] pb-3">
            <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
              <Eye size={16} className="text-emerald-600" />
              Live Split Preview
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Updates instantly on save</span>
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
