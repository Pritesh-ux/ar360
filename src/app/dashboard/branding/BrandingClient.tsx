"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImagePlus, Link2, RotateCcw, Save, Sparkles, Upload } from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserButton from "@/components/user-panel/UserButton";
import { UserField, UserInput, UserSelect } from "@/components/user-panel/UserInput";
import { useWorkspace } from "@/lib/enterprise/useWorkspace";

type BrandingConfig = {
  logoUrl: string | null;
  brandName: string | null;
  brandColor: string;
  accentColor: string | null;
  viewerWatermark: boolean;
  removeBranding: boolean;
  customViewerTheme: string;
  viewerTagline: string | null;
  ctaLabel: string | null;
  websiteUrl: string | null;
  loadingMessage: string | null;
  buttonStyle: string;
  headerStyle: string;
  viewerFont: string;
  faviconUrl: string | null;
  showProductTitle: boolean;
  hideInteractionHint: boolean;
};

const DEFAULT_BRANDING: BrandingConfig = {
  logoUrl: null,
  brandName: null,
  brandColor: "#B8FF3C",
  accentColor: "#84D400",
  viewerWatermark: false,
  removeBranding: false,
  customViewerTheme: "default",
  viewerTagline: null,
  ctaLabel: null,
  websiteUrl: null,
  loadingMessage: null,
  buttonStyle: "filled",
  headerStyle: "glass",
  viewerFont: "system",
  faviconUrl: null,
  showProductTitle: true,
  hideInteractionHint: false,
};

const THEMES = [
  { id: "default", label: "Default" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "brand", label: "Brand" },
] as const;

const BUTTON_STYLES = [
  { id: "filled", label: "Filled" },
  { id: "outline", label: "Outline" },
  { id: "soft", label: "Soft" },
] as const;

const HEADER_STYLES = [
  { id: "glass", label: "Glass" },
  { id: "solid", label: "Solid" },
  { id: "minimal", label: "Minimal" },
] as const;

const FONTS = [
  { id: "system", label: "System" },
  { id: "sans", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
] as const;

function validHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function fontStack(id: string) {
  if (id === "sans") return 'var(--font-auth-body), "Instrument Sans", system-ui, sans-serif';
  if (id === "serif") return 'Georgia, "Times New Roman", serif';
  if (id === "display") return 'var(--font-auth-display), Outfit, system-ui, sans-serif';
  return "system-ui, -apple-system, Segoe UI, sans-serif";
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_24px_rgba(28,38,18,0.04)] sm:p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-[#111111]">{title}</h2>
        {description ? <p className="mt-1 text-xs font-medium text-[#737373]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E4E8DF] bg-[#FBFFF5] px-3.5 py-3 text-left transition hover:border-[#CFE3A5]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#111111]">{label}</span>
        <span className="mt-0.5 block text-xs font-medium text-[#737373]">{description}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-[#84D400]" : "bg-[#D8DED0]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ChoiceGroup({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition ${
              active
                ? "border-[#84D400] bg-[#EEF9E0] text-[#3D6600]"
                : "border-[#E4E8DF] bg-white text-[#525252] hover:border-[#CFE3A5] hover:text-[#111111]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function LivePreview({ branding }: { branding: BrandingConfig }) {
  const primary = validHex(branding.brandColor) ? branding.brandColor : "#B8FF3C";
  const accent = validHex(branding.accentColor || "") ? branding.accentColor! : "#84D400";
  const dark = branding.customViewerTheme === "dark";
  const brandWash = branding.customViewerTheme === "brand";

  const headerClass =
    branding.headerStyle === "solid"
      ? dark
        ? "border-white/10 bg-[#1C1F22]"
        : "border-[#E4E8DF] bg-white"
      : branding.headerStyle === "minimal"
        ? "border-transparent bg-transparent"
        : dark
          ? "border-white/10 bg-white/10 backdrop-blur-xl"
          : "border-white/70 bg-white/90 backdrop-blur-xl";

  const ctaClass =
    branding.buttonStyle === "outline"
      ? "border-2 bg-transparent"
      : branding.buttonStyle === "soft"
        ? "border border-transparent"
        : "border border-transparent";

  const ctaStyle =
    branding.buttonStyle === "outline"
      ? { borderColor: primary, color: dark ? "#fff" : "#102000", backgroundColor: "transparent" }
      : branding.buttonStyle === "soft"
        ? { backgroundColor: `color-mix(in srgb, ${primary} 22%, white)`, color: "#102000" }
        : { backgroundColor: primary, color: "#102000" };

  return (
    <div
      className={`overflow-hidden rounded-[22px] border shadow-[0_12px_34px_rgba(28,38,18,0.08)] transition ${
        dark ? "border-white/10 bg-[#101214] text-white" : "border-[#E4E8DF] bg-white text-[#111111]"
      }`}
      style={{
        fontFamily: fontStack(branding.viewerFont),
        ...(brandWash
          ? {
              background: `linear-gradient(165deg, color-mix(in srgb, ${primary} 20%, white) 0%, white 50%, #F4F7EE 100%)`,
            }
          : {}),
      }}
    >
      <div className={`flex items-center gap-2.5 border-b px-3 py-2.5 ${headerClass}`}>
        <div
          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl p-1"
          style={{ backgroundColor: dark ? "#1C1F22" : "#fff", boxShadow: `0 0 0 1px ${primary}55` }}
        >
          {branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-[10px] font-black" style={{ color: primary }}>
              {(branding.brandName || "AR").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight">{branding.brandName || "Your Brand"}</p>
          <p className={`truncate text-[10px] ${dark ? "text-white/50" : "text-[#737373]"}`}>
            {branding.viewerTagline ||
              (branding.showProductTitle ? "Product title · 3D / AR" : "3D / AR Viewer")}
          </p>
        </div>
      </div>

      <div
        className="relative grid h-[140px] place-items-center overflow-hidden"
        style={{
          background: dark
            ? "radial-gradient(circle at 50% 35%, #2A2E34 0%, #101214 70%)"
            : `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${primary} 26%, white) 0%, transparent 55%), #F2F5EC`,
        }}
      >
        {!branding.hideInteractionHint ? (
          <div
            className={`absolute top-2 rounded-full px-2.5 py-1 text-[9px] font-semibold ${
              dark ? "bg-white/10 text-white/70" : "bg-white/85 text-[#525252]"
            }`}
          >
            Drag · Pinch · AR
          </div>
        ) : null}
        <div
          className="h-16 w-20 rounded-2xl opacity-90"
          style={{
            background: `linear-gradient(145deg, ${primary}, ${accent})`,
            boxShadow: `0 16px 32px ${primary}44`,
            transform: "perspective(320px) rotateX(10deg) rotateY(-16deg)",
          }}
        />
        {branding.viewerWatermark ? (
          <div
            className={`absolute bottom-2 left-2 rounded-lg px-2 py-1 text-[10px] font-bold backdrop-blur-md ${
              dark ? "bg-white/10 text-white" : "bg-white/85 text-[#3F4638]"
            }`}
          >
            {(branding.brandName || "Brand").slice(0, 14)}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 p-3">
        <p className={`text-center text-[10px] ${dark ? "text-white/45" : "text-[#8A9184]"}`}>
          {branding.loadingMessage || "Preparing premium 3D experience"}
        </p>
        <button
          type="button"
          className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-black ${ctaClass}`}
          style={ctaStyle}
        >
          <Sparkles size={13} />
          {branding.ctaLabel || "View in AR"}
        </button>
        {!branding.removeBranding ? (
          <p className={`text-center text-[9px] font-semibold ${dark ? "text-white/35" : "text-[#A3AA9C]"}`}>
            Powered by AR360
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function BrandingClient({ enabled }: { enabled: boolean }) {
  const { workspaceUid, workspaces, loading: workspaceLoading, error: workspaceError, refresh } =
    useWorkspace();
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const workspace = workspaces.find((item) => item.workspace_uid === workspaceUid);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  const loadBranding = useCallback(async () => {
    if (!workspaceUid || !enabled) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/enterprise/branding?workspaceUid=${encodeURIComponent(workspaceUid)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load branding.");
      setBranding({ ...DEFAULT_BRANDING, ...(data.branding || {}) });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load branding.");
    } finally {
      setLoading(false);
    }
  }, [enabled, workspaceUid]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadBranding(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadBranding]);

  function update<K extends keyof BrandingConfig>(key: K, value: BrandingConfig[K]) {
    setBranding((current) => ({ ...current, [key]: value }));
  }

  async function uploadAsset(kind: "logo" | "favicon", file?: File) {
    if (!file || !workspaceUid) return;
    setUploading(kind);
    try {
      const form = new FormData();
      form.set("workspaceUid", workspaceUid);
      form.set("kind", kind);
      form.set("logo", file);
      const response = await fetch("/api/enterprise/branding/logo", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      if (kind === "logo") {
        update("logoUrl", data.logoUrl || null);
        showToast("Logo uploaded. Save branding to apply it.");
      } else {
        update("faviconUrl", data.faviconUrl || null);
        showToast("Favicon uploaded. Save branding to apply it.");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function saveBranding() {
    if (!workspaceUid) return;
    if (!validHex(branding.brandColor) || (branding.accentColor && !validHex(branding.accentColor))) {
      showToast("Use a valid 6-digit hex color.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/enterprise/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceUid, ...branding }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save branding.");
      showToast("Branding saved. Open a published viewer to see it live.");
      refresh();
      await loadBranding();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save branding.");
    } finally {
      setSaving(false);
    }
  }

  function resetBranding() {
    setBranding(DEFAULT_BRANDING);
    showToast("Defaults restored locally. Save to apply.");
  }

  if (!enabled) {
    return (
      <div className="space-y-4">
        <UserPageHeader
          title="Branding"
          subtitle="Custom logo, colors, and white-label viewer are available on Pro and above."
        />
        <section className="rounded-[22px] border border-[#E4E8DF] bg-[linear-gradient(120deg,#FFFFFF_0%,#FBFFF5_100%)] p-6 shadow-[0_12px_34px_rgba(28,38,18,0.06)]">
          <p className="text-sm font-medium text-[#525252]">
            Upgrade your plan to unlock enterprise branding for the public AR viewer.
          </p>
          <Link
            href="/dashboard/subscription"
            className="mt-4 inline-flex h-11 items-center rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] shadow-sm hover:bg-[#78C400]"
          >
            View plans
          </Link>
        </section>
      </div>
    );
  }

  if (workspaceLoading || loading) {
    return (
      <div className="space-y-4">
        <UserPageHeader title="Branding" subtitle="Loading workspace branding…" />
        <div className="grid min-h-[28vh] place-items-center rounded-[22px] border border-[#E4E8DF] bg-white text-sm font-medium text-[#737373] shadow-[0_12px_34px_rgba(28,38,18,0.06)]">
          Loading branding…
        </div>
      </div>
    );
  }

  if (workspaceError || !workspaceUid) {
    return (
      <div className="space-y-4">
        <UserPageHeader title="Branding" />
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {workspaceError || "No workspace is available for this account."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UserPageHeader
        title="Branding"
        subtitle={`${workspace?.name || "Workspace"} · Customize the public AR viewer identity, chrome, and white-label options.`}
        actions={
          <>
            <UserButton
              variant="outline"
              disabled={saving}
              icon={<RotateCcw size={16} />}
              onClick={resetBranding}
              className="h-11 rounded-2xl border-[#ECECEC] px-4 font-semibold"
            >
              Reset
            </UserButton>
            <UserButton
              disabled={saving}
              loading={saving}
              icon={<Save size={16} />}
              onClick={() => void saveBranding()}
              className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] shadow-sm hover:bg-[#78C400]"
            >
              {saving ? "Saving…" : "Save Changes"}
            </UserButton>
          </>
        }
      />

      {toast ? (
        <div className="rounded-[20px] border border-[#C8E6A0] bg-[#EEF9E0] px-5 py-3 text-sm font-medium text-[#3D6600]">
          {toast}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-4">
          <Panel title="Identity" description="Name, tagline, logo, and browser tab icon.">
            <div className="grid gap-4 sm:grid-cols-2">
              <UserField label="Brand name">
                <UserInput
                  value={branding.brandName || ""}
                  maxLength={180}
                  placeholder="Your company name"
                  onChange={(event) => update("brandName", event.target.value)}
                />
              </UserField>
              <UserField label="Tagline">
                <UserInput
                  value={branding.viewerTagline || ""}
                  maxLength={240}
                  placeholder="Experience products in AR"
                  onChange={(event) => update("viewerTagline", event.target.value)}
                />
              </UserField>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl border border-[#E4E8DF] bg-[#FBFFF5] p-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E4E8DF] bg-white">
                  {branding.logoUrl ? (
                    <Image
                      src={branding.logoUrl}
                      alt="Brand logo"
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <ImagePlus size={16} className="text-[#8A9184]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111111]">Logo</p>
                  <p className="text-[11px] font-medium text-[#737373]">PNG / JPG / WebP · 2 MB</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-[#111111] px-3 text-xs font-semibold text-white">
                      <Upload size={12} />
                      {uploading === "logo" ? "…" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={Boolean(uploading)}
                        className="hidden"
                        onChange={(event) => void uploadAsset("logo", event.target.files?.[0])}
                      />
                    </label>
                    {branding.logoUrl ? (
                      <button
                        type="button"
                        onClick={() => update("logoUrl", null)}
                        className="h-8 rounded-xl px-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-[#E4E8DF] bg-[#FBFFF5] p-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E4E8DF] bg-white">
                  {branding.faviconUrl ? (
                    <Image
                      src={branding.faviconUrl}
                      alt="Favicon"
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <ImagePlus size={16} className="text-[#8A9184]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111111]">Favicon</p>
                  <p className="text-[11px] font-medium text-[#737373]">Browser tab icon</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-[#111111] px-3 text-xs font-semibold text-white">
                      <Upload size={12} />
                      {uploading === "favicon" ? "…" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={Boolean(uploading)}
                        className="hidden"
                        onChange={(event) => void uploadAsset("favicon", event.target.files?.[0])}
                      />
                    </label>
                    {branding.faviconUrl ? (
                      <button
                        type="button"
                        onClick={() => update("faviconUrl", null)}
                        className="h-8 rounded-xl px-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Look" description="Theme, colors, typography, and chrome style.">
            <div className="space-y-4">
              <UserField label="Viewer theme">
                <ChoiceGroup
                  options={THEMES}
                  value={branding.customViewerTheme}
                  onChange={(id) => update("customViewerTheme", id)}
                />
              </UserField>

              <div className="grid gap-4 sm:grid-cols-2">
                <UserField label="Primary color" hint="CTA & actions">
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={validHex(branding.brandColor) ? branding.brandColor : "#B8FF3C"}
                      onChange={(event) => update("brandColor", event.target.value.toUpperCase())}
                      className="h-11 w-12 shrink-0 cursor-pointer rounded-[14px] border border-[#ECECEC] bg-white p-1"
                      aria-label="Primary color"
                    />
                    <UserInput
                      value={branding.brandColor}
                      maxLength={7}
                      className="max-w-[9rem] font-mono"
                      onChange={(event) => update("brandColor", event.target.value.toUpperCase())}
                    />
                  </div>
                </UserField>
                <UserField label="Accent color" hint="Hover / secondary">
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={validHex(branding.accentColor || "") ? branding.accentColor! : "#84D400"}
                      onChange={(event) => update("accentColor", event.target.value.toUpperCase())}
                      className="h-11 w-12 shrink-0 cursor-pointer rounded-[14px] border border-[#ECECEC] bg-white p-1"
                      aria-label="Accent color"
                    />
                    <UserInput
                      value={branding.accentColor || ""}
                      maxLength={7}
                      placeholder="#84D400"
                      className="max-w-[9rem] font-mono"
                      onChange={(event) => update("accentColor", event.target.value.toUpperCase())}
                    />
                  </div>
                </UserField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <UserField label="Viewer font">
                  <UserSelect
                    value={branding.viewerFont}
                    onChange={(event) => update("viewerFont", event.target.value)}
                  >
                    {FONTS.map((font) => (
                      <option key={font.id} value={font.id}>
                        {font.label}
                      </option>
                    ))}
                  </UserSelect>
                </UserField>
                <UserField label="Header style">
                  <ChoiceGroup
                    options={HEADER_STYLES}
                    value={branding.headerStyle}
                    onChange={(id) => update("headerStyle", id)}
                  />
                </UserField>
              </div>

              <UserField label="AR button style">
                <ChoiceGroup
                  options={BUTTON_STYLES}
                  value={branding.buttonStyle}
                  onChange={(id) => update("buttonStyle", id)}
                />
              </UserField>
            </div>
          </Panel>

          <Panel title="Actions" description="CTA copy, loading message, and brand website link.">
            <div className="grid gap-4 sm:grid-cols-2">
              <UserField label="AR button label">
                <UserInput
                  value={branding.ctaLabel || ""}
                  maxLength={80}
                  placeholder="View in AR"
                  onChange={(event) => update("ctaLabel", event.target.value)}
                />
              </UserField>
              <UserField label="Loading message">
                <UserInput
                  value={branding.loadingMessage || ""}
                  maxLength={120}
                  placeholder="Preparing 3D experience"
                  onChange={(event) => update("loadingMessage", event.target.value)}
                />
              </UserField>
            </div>
            <div className="mt-4">
              <UserField label="Website URL" hint="Optional link from the brand name in the viewer.">
                <div className="relative max-w-lg">
                  <Link2
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9184]"
                  />
                  <UserInput
                    className="pl-10"
                    value={branding.websiteUrl || ""}
                    maxLength={500}
                    placeholder="https://yourbrand.com"
                    onChange={(event) => update("websiteUrl", event.target.value)}
                  />
                </div>
              </UserField>
            </div>
          </Panel>

          <Panel title="White-label & chrome" description="Control watermarks, hints, and AR360 attribution.">
            <div className="grid gap-3">
              <Switch
                label="Brand watermark"
                description="Corner mark in the viewer"
                checked={branding.viewerWatermark}
                onChange={(value) => update("viewerWatermark", value)}
              />
              <Switch
                label='Remove "Powered by AR360"'
                description="Fully white-label public viewer"
                checked={branding.removeBranding}
                onChange={(value) => update("removeBranding", value)}
              />
              <Switch
                label="Show product title"
                description="Under the brand name when a brand name is set"
                checked={branding.showProductTitle}
                onChange={(value) => update("showProductTitle", value)}
              />
              <Switch
                label="Hide interaction tip"
                description='Hide the "Drag · Pinch · View in AR" chip'
                checked={branding.hideInteractionHint}
                onChange={(value) => update("hideInteractionHint", value)}
              />
            </div>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-3">
          <section className="rounded-[22px] border border-[#E4E8DF] bg-[linear-gradient(120deg,#FFFFFF_0%,#FBFFF5_100%)] p-4 shadow-[0_12px_34px_rgba(28,38,18,0.06)]">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5F8F00]">
              Live preview
            </p>
            <LivePreview branding={branding} />
          </section>
        </aside>
      </div>
    </div>
  );
}
