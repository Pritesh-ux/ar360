"use client";

import { useEffect, useState } from "react";
import { Save, Settings, Menu, Plus, Trash2, RotateCcw, Megaphone } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  DEFAULT_LANDING_NAVBAR,
  DEFAULT_LANDING_FOOTER,
  toNavEditorItems,
} from "@/lib/website/default-navigation";

type NavItem = {
  nav_uid?: string;
  menu_type: "navbar" | "footer";
  label: string;
  link_url: string;
  sort_order: number;
};

const POPUP_TEXT_FIELDS = [
  {
    key: "free_trial_popup_badge",
    label: "Offer badge",
    hint: "Small pill above the heading.",
    rows: 1,
  },
  {
    key: "free_trial_popup_title",
    label: "Heading",
    hint: "Press Enter for a new line. Wrap words in *asterisks* to colour them lime.",
    rows: 2,
  },
  {
    key: "free_trial_popup_description",
    label: "Description",
    hint: "One or two sentences under the heading.",
    rows: 3,
  },
  {
    key: "free_trial_popup_primary_label",
    label: "Primary button text",
    hint: "Goes to the signup page.",
    rows: 1,
  },
  {
    key: "free_trial_popup_secondary_label",
    label: "Secondary button text",
    hint: "Goes to the demo page.",
    rows: 1,
  },
  {
    key: "free_trial_popup_scan_title",
    label: "QR card heading",
    hint: "Shown next to the scan QR code.",
    rows: 1,
  },
  {
    key: "free_trial_popup_scan_note",
    label: "QR card note",
    hint: "Small line under the QR heading.",
    rows: 1,
  },
] as const;

export default function WebsiteSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    company_name: "",
    support_email: "",
    contact_phone: "",
    contact_email: "",
    gst_number: "",
    address: "",
    copyright: "",
    social_linkedin: "",
    social_instagram: "",
    social_x: "",
    free_trial_popup_badge: "",
    free_trial_popup_title: "",
    free_trial_popup_description: "",
    free_trial_popup_primary_label: "",
    free_trial_popup_secondary_label: "",
    free_trial_popup_scan_title: "",
    free_trial_popup_scan_note: "",
  });

  const [navigation, setNavigation] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/master-admin/website/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        if (data.navigation) setNavigation(data.navigation);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/master-admin/website/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, navigation }),
      });

      if (res.ok) {
        alert("Settings and Navigation saved successfully!");
      } else {
        alert("Failed to save settings.");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const addNavItem = (type: "navbar" | "footer") => {
    const newItem: NavItem = {
      menu_type: type,
      label: "New Link",
      link_url: "/",
      sort_order: navigation.filter((n) => n.menu_type === type).length + 1,
    };
    setNavigation((prev) => [...prev, newItem]);
  };

  const removeNavItem = (index: number) => {
    setNavigation((prev) => prev.filter((_, i) => i !== index));
  };

  const updateNavItem = (index: number, key: keyof NavItem, val: any) => {
    setNavigation((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: val } : item)),
    );
  };

  function restoreLandingNavbar() {
    const footer = navigation.filter((item) => item.menu_type === "footer");
    setNavigation([...toNavEditorItems(DEFAULT_LANDING_NAVBAR), ...footer]);
  }

  function restoreLandingFooter() {
    const navbar = navigation.filter((item) => item.menu_type === "navbar");
    setNavigation([...navbar, ...toNavEditorItems(DEFAULT_LANDING_FOOTER)]);
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-800 transition";

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <div className="dash-premium-card p-8 text-center text-[13px] font-semibold text-[#667085]">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Website Settings & Navigation"
        backHref="/master-admin/website"
        backLabel="Back to CMS Dashboard"
        actions={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="dash-premium-btn-primary h-10 px-4 text-[12px] disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="dash-premium-card space-y-6 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F1412]">
            <Settings size={20} className="text-slate-700" />
            General Information
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Company Name
              <input
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Support Email
              <input
                value={settings.support_email}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Contact Phone
              <input
                value={settings.contact_phone}
                onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Contact Email
              <input
                value={settings.contact_email}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              GST Registration No.
              <input
                value={settings.gst_number}
                onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Footer Copyright Text
              <input
                value={settings.copyright}
                onChange={(e) => setSettings({ ...settings, copyright: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
            Physical Office Address
            <textarea
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="min-h-20 rounded-xl border border-slate-200 p-3.5 text-sm font-semibold"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              Instagram Profile Link
              <input
                value={settings.social_instagram || ""}
                onChange={(e) => setSettings({ ...settings, social_instagram: e.target.value })}
                placeholder="https://instagram.com/..."
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              X (Twitter) Profile Link
              <input
                value={settings.social_x || ""}
                onChange={(e) => setSettings({ ...settings, social_x: e.target.value })}
                placeholder="https://x.com/..."
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              LinkedIn Profile Link
              <input
                value={settings.social_linkedin}
                onChange={(e) => setSettings({ ...settings, social_linkedin: e.target.value })}
                placeholder="https://linkedin.com/..."
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="dash-premium-card space-y-6 p-6">
          <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F1412]">
              <Menu size={20} className="text-slate-700" />
              Menu Navigation Tree
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Navbar Links</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restoreLandingNavbar}
                  className="dash-premium-btn-secondary h-8 gap-1 px-3 text-[10px]"
                >
                  <RotateCcw size={10} />
                  Landing defaults
                </button>
                <button
                  type="button"
                  onClick={() => addNavItem("navbar")}
                  className="dash-premium-btn-secondary h-8 gap-1 px-3 text-[10px]"
                >
                  <Plus size={10} />
                  Add Link
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {navigation
                .map((item, originalIndex) => ({ item, originalIndex }))
                .filter(({ item }) => item.menu_type === "navbar")
                .map(({ item, originalIndex }) => (
                  <div key={originalIndex} className="flex items-center gap-2.5">
                    <input
                      value={item.label}
                      onChange={(e) => updateNavItem(originalIndex, "label", e.target.value)}
                      placeholder="Label"
                      className="h-9 w-1/3 rounded-lg border border-slate-200 px-3 text-xs font-bold"
                    />
                    <input
                      value={item.link_url}
                      onChange={(e) => updateNavItem(originalIndex, "link_url", e.target.value)}
                      placeholder="e.g. /demo or /#features"
                      className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"
                    />
                    <input
                      type="number"
                      value={item.sort_order}
                      onChange={(e) => updateNavItem(originalIndex, "sort_order", Number(e.target.value))}
                      className="h-9 w-14 rounded-lg border border-slate-200 px-2 text-center text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => removeNavItem(originalIndex)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Footer Links</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restoreLandingFooter}
                  className="dash-premium-btn-secondary h-8 gap-1 px-3 text-[10px]"
                >
                  <RotateCcw size={10} />
                  Landing defaults
                </button>
                <button
                  type="button"
                  onClick={() => addNavItem("footer")}
                  className="dash-premium-btn-secondary h-8 gap-1 px-3 text-[10px]"
                >
                  <Plus size={10} />
                  Add Link
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {navigation
                .map((item, originalIndex) => ({ item, originalIndex }))
                .filter(({ item }) => item.menu_type === "footer")
                .map(({ item, originalIndex }) => (
                  <div key={originalIndex} className="flex items-center gap-2.5">
                    <input
                      value={item.label}
                      onChange={(e) => updateNavItem(originalIndex, "label", e.target.value)}
                      placeholder="Label"
                      className="h-9 w-1/3 rounded-lg border border-slate-200 px-3 text-xs font-bold"
                    />
                    <input
                      value={item.link_url}
                      onChange={(e) => updateNavItem(originalIndex, "link_url", e.target.value)}
                      placeholder="e.g. /privacy"
                      className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"
                    />
                    <input
                      type="number"
                      value={item.sort_order}
                      onChange={(e) => updateNavItem(originalIndex, "sort_order", Number(e.target.value))}
                      className="h-9 w-14 rounded-lg border border-slate-200 px-2 text-center text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => removeNavItem(originalIndex)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-premium-card space-y-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F1412]">
            <Megaphone size={20} className="text-slate-700" />
            Landing free-trial popup text
          </h2>
          <p className="mt-1 text-[12px] font-medium text-[#667085]">
            Landing page ke free-trial popup ka pura text yahan se badlo. Save karte hi live ho jata
            hai. Kisi bhi word ko *asterisks* me wrap karo to wo lime colour me dikhega.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {POPUP_TEXT_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-xs font-bold text-slate-500">
              {field.label}
              {field.rows > 1 ? (
                <textarea
                  value={settings[field.key] ?? ""}
                  rows={field.rows}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-800"
                />
              ) : (
                <input
                  value={settings[field.key] ?? ""}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  className={inputClass}
                />
              )}
              <span className="text-[11px] font-medium text-[#667085]">{field.hint}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
