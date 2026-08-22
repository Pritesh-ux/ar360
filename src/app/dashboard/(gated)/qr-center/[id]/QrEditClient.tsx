"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Download,
  Eye,
  Copy,
  Check,
  RotateCcw,
  Image as ImageIcon,
  HelpCircle,
  ExternalLink,
  Laptop,
  Smartphone,
  Scan,
} from "lucide-react";
import QrCodePreview, { downloadQrSvg, type QrPreviewItem } from "@/components/user-panel/QrCodePreview";
import UserButton from "@/components/user-panel/UserButton";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import { useUserPanelToast } from "@/components/user-panel/UserPanelToastContext";

export default function QrEditClient({ qrId }: { qrId: string }) {
  const router = useRouter();
  const { showToast } = useUserPanelToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<(QrPreviewItem & { name: string; expiresAt: string | null }) | null>(null);
  const [original, setOriginal] = useState<(QrPreviewItem & { name: string; expiresAt: string | null }) | null>(null);
  const [allowCustomLogo, setAllowCustomLogo] = useState(false);

  // Preview Mode: desktop | mobile | ar
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | "ar">("desktop");

  useEffect(() => {
    async function loadQr() {
      try {
        const [res, entitlementRes] = await Promise.all([
          fetch(`/api/qr-codes/${qrId}`),
          fetch("/api/billing/entitlement?action=custom_branding", { cache: "no-store" }),
        ]);
        if (!res.ok) {
          throw new Error("Failed to load QR code.");
        }
        const data = await res.json();
        const entitlement = await entitlementRes.json().catch(() => ({}));
        setAllowCustomLogo(Boolean(entitlement?.entitlement?.allowed));
        if (data.success && data.qrCode) {
          setDraft(data.qrCode);
          setOriginal(JSON.parse(JSON.stringify(data.qrCode)));
        } else {
          throw new Error(data.error || "Failed to load QR code.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load QR code.");
      } finally {
        setLoading(false);
      }
    }
    loadQr();
  }, [qrId]);

  async function saveChanges() {
    if (!draft || saving) return;
    setSaving(true);
    setSavedFlash(false);
    setError(null);
    try {
      const res = await fetch(`/api/qr-codes/${qrId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          expiresAt: draft.expiresAt,
          foregroundColor: draft.foregroundColor,
          backgroundColor: draft.backgroundColor,
          patternStyle: draft.patternStyle,
          cornerStyle: draft.cornerStyle,
          logoUrl: draft.logoUrl || null,
          logoSize: draft.logoSize,
          frameEnabled: draft.frameEnabled,
          frameStyle: draft.frameStyle,
          frameColor: draft.frameColor,
          frameText: draft.frameText,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save changes.");
      }
      setOriginal(JSON.parse(JSON.stringify(draft)));
      setSavedFlash(true);
      setNotice("QR changes saved");
      showToast("QR changes saved successfully", "ok");
      window.setTimeout(() => {
        setNotice("");
        setSavedFlash(false);
        router.push("/dashboard/qr-center");
      }, 1600);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes.";
      setError(message);
      showToast(message, "err");
    } finally {
      setSaving(false);
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft({ ...draft, logoUrl: String(reader.result || "") });
    };
    reader.readAsDataURL(file);
  };

  function resetToOriginal() {
    if (original) {
      setDraft(JSON.parse(JSON.stringify(original)));
    }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setNotice(`${label} copied`);
    showToast(`${label} copied`, "info");
    window.setTimeout(() => setNotice(""), 1200);
  }

  if (loading) {
    return (
      <UserWorkspaceLoading
        label="Loading QR Editor"
        hint="Please wait while we prepare the QR configurator..."
      />
    );
  }

  if (error && !draft) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="font-semibold text-red-600">{error}</p>
        <Link
          href="/dashboard/qr-center"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#84D400] px-4 py-2 text-sm font-bold text-[#102000] hover:bg-[#78C400]"
        >
          <ArrowLeft size={16} /> Back to QR Center
        </Link>
      </div>
    );
  }

  if (!draft) return null;

  const isChanged = JSON.stringify(draft) !== JSON.stringify(original);

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Top Header Section */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-[#ECECEC] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/qr-center"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#ECECEC] bg-white text-[#737373] hover:text-[#111111] hover:bg-[#FAFAFA] transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-[#111111]">Configure QR Code</h2>
              <span className="inline-flex h-2 w-2 rounded-full bg-[#84D400]" />
            </div>
            <p className="text-[12px] text-[#737373] mt-0.5">Design, brand and customize your 3D viewer QR code experience.</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/dashboard/support")}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-3.5 text-xs font-bold text-[#525252] hover:bg-[#FAFAFA]"
          >
            <HelpCircle size={14} /> Help
          </button>
        </div>
      </div>

      {/* Main Grid Layout (3 Columns on Desktop) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Column 1: Live Preview & Destination URL */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-bold text-[#111111]">Live Preview</h3>
                <p className="text-[11px] text-[#737373] mt-0.5">Scan to view 3D product in AR</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-[#EEF9E0] px-2.5 py-1 text-[11px] font-bold text-[#5FA800]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#84D400] animate-pulse" />
                Live
              </div>
            </div>

            {/* Simulated Card Frame Container */}
            <div className="relative flex flex-col items-center justify-center rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] py-5 px-4 transition-colors duration-200">
              <div className="relative flex flex-col items-center rounded-2xl border border-[#ECECEC] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] max-w-[250px] w-full">
                <QrCodePreview item={draft} size={220} />
                
                {/* Floating Action Pill */}
                <div className="mt-4 flex items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-3 py-1 shadow-sm text-[11px] font-bold text-[#111111]">
                  <Scan size={12} className="text-[#84D400]" />
                  Scan Me
                </div>
              </div>
            </div>

            {/* Selector Tabs: Desktop / Mobile / AR View */}
            <div className="mt-4 flex rounded-xl border border-[#ECECEC] bg-[#FAFAFA] p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPreviewMode("desktop")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
                  previewMode === "desktop" ? "bg-white text-[#111111] shadow-sm" : "text-[#737373]"
                }`}
              >
                <Laptop size={12} /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("mobile")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
                  previewMode === "mobile" ? "bg-white text-[#111111] shadow-sm" : "text-[#737373]"
                }`}
              >
                <Smartphone size={12} /> Mobile
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("ar")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
                  previewMode === "ar" ? "bg-white text-[#111111] shadow-sm" : "text-[#737373]"
                }`}
              >
                <ExternalLink size={12} /> AR View
              </button>
            </div>

            {/* Public Link Box */}
            <div className="mt-5 border-t border-[#ECECEC] pt-4">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-[#525252] flex items-center gap-1">
                  Public link
                  <HelpCircle size={12} className="text-[#A3A3A3]" />
                </label>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" /> Active
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-xs font-semibold text-[#525252]">
                  {draft.destinationUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyText(draft.destinationUrl, "Public link")}
                  className="shrink-0 text-[#737373] hover:text-[#111111]"
                  title="Copy public link"
                >
                  <Copy size={13} />
                </button>
              </div>

              {/* Tag Badges */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["3D Viewer", "AR Mode", "Web Preview", "Smart Redirect"].map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#FAFAFA] border border-[#ECECEC] px-2 py-0.5 text-[10px] font-bold text-[#737373]"
                  >
                    <span className="h-1 w-1 rounded-full bg-[#84D400]" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Download Buttons */}
            <div className="mt-6 flex flex-col gap-2">
              <UserButton
                className="h-11 w-full rounded-xl bg-[#84D400] font-bold text-[#102000] hover:bg-[#78C400]"
                icon={<Download size={15} />}
                onClick={() => downloadQrSvg(draft, `${draft.name}-qr.svg`)}
              >
                Download SVG File
              </UserButton>
              <UserButton
                variant="outline"
                className="h-10 w-full rounded-xl text-xs font-bold"
                icon={<Eye size={14} />}
                onClick={() => window.open(draft.destinationUrl, "_blank")}
              >
                Test Redirect Link
              </UserButton>
            </div>
          </div>
        </div>

        {/* Column 2: General Info & Design Style */}
        <div className="flex flex-col gap-5">
          {/* General Information Card */}
          <div className="rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-3 mb-4">
              General Information
            </h3>

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-[#525252]">
                QR Code Campaign Name
                <input
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#ECECEC] bg-white px-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#84D400]"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Main QR"
                />
              </label>

              <label className="block text-xs font-semibold text-[#525252]">
                Expires on (Optional)
                <input
                  type="datetime-local"
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#ECECEC] bg-white px-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#84D400]"
                  value={draft.expiresAt ? draft.expiresAt.slice(0, 16) : ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </label>

              {/* Status Banner */}
              <div
                className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                  draft.expiresAt
                    ? "border-amber-100 bg-amber-50 text-amber-800"
                    : "border-emerald-100 bg-emerald-50 text-emerald-800"
                }`}
              >
                <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                  draft.expiresAt ? "bg-amber-500" : "bg-emerald-500"
                }`} />
                <div className="text-[11px] leading-relaxed">
                  <p className="font-bold">
                    {draft.expiresAt ? "QR Code will expire soon" : "Your QR will remain active"}
                  </p>
                  <p className="mt-0.5 text-[#737373]">
                    {draft.expiresAt
                      ? `Valid until ${new Date(draft.expiresAt).toLocaleDateString()} at ${new Date(draft.expiresAt).toLocaleTimeString()}`
                      : "There is no validity expiration limit configured."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Design Style Card */}
          <div className="rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-3 mb-4">
              Design Style
            </h3>

            <div className="space-y-4">
              {/* Pattern Styles Grid */}
              <div>
                <p className="text-xs font-semibold text-[#525252] mb-2">QR Pattern Shape</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "classic", label: "Classic Square" },
                    { id: "dots", label: "Circular Dots" },
                    { id: "diamond", label: "Diamond Grid" },
                    { id: "rounded", label: "Smooth Rounded" },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, patternStyle: style.id })}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold text-left transition ${
                        draft.patternStyle === style.id
                          ? "border-[#84D400] bg-[#EEF9E0] text-[#111111]"
                          : "border-[#ECECEC] bg-white text-[#737373] hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded border border-[#C8CDD4] flex-shrink-0 flex items-center justify-center ${
                        draft.patternStyle === style.id ? "bg-[#84D400] border-[#84D400]" : ""
                      }`}>
                        {draft.patternStyle === style.id && <span className="h-1.5 w-1.5 bg-white rounded-full" />}
                      </span>
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eye Styles Grid */}
              <div>
                <p className="text-xs font-semibold text-[#525252] mb-2">Corner Eye Design</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "square", label: "Square" },
                    { id: "rounded", label: "Rounded" },
                    { id: "circle", label: "Circle" },
                  ].map((eye) => (
                    <button
                      key={eye.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, cornerStyle: eye.id })}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-[10px] font-bold text-center transition ${
                        draft.cornerStyle === eye.id
                          ? "border-[#84D400] bg-[#EEF9E0] text-[#111111]"
                          : "border-[#ECECEC] bg-white text-[#737373] hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <span className={`h-4 w-4 border border-[#525252] flex items-center justify-center ${
                        eye.id === "circle" ? "rounded-full" : eye.id === "rounded" ? "rounded-sm" : ""
                      }`}>
                        <span className={`h-2 w-2 bg-[#525252] ${
                          eye.id === "circle" ? "rounded-full" : eye.id === "rounded" ? "rounded-sm" : ""
                        }`} />
                      </span>
                      {eye.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Customization */}
              <div className="grid grid-cols-2 gap-3 border-t border-[#ECECEC] pt-4">
                <label className="block text-xs font-semibold text-[#525252]">
                  Foreground Color
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-10 shrink-0 rounded-lg border border-[#ECECEC] bg-white cursor-pointer"
                      value={draft.foregroundColor}
                      onChange={(e) => setDraft({ ...draft, foregroundColor: e.target.value.toUpperCase() })}
                    />
                    <input
                      type="text"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#ECECEC] bg-white px-2.5 text-xs font-bold text-[#111111] uppercase outline-none focus:border-[#84D400]"
                      value={draft.foregroundColor}
                      onChange={(e) => setDraft({ ...draft, foregroundColor: e.target.value })}
                    />
                  </div>
                </label>

                <label className="block text-xs font-semibold text-[#525252]">
                  Background Color
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-10 shrink-0 rounded-lg border border-[#ECECEC] bg-white cursor-pointer"
                      value={draft.backgroundColor}
                      onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value.toUpperCase() })}
                    />
                    <input
                      type="text"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#ECECEC] bg-white px-2.5 text-xs font-bold text-[#111111] uppercase outline-none focus:border-[#84D400]"
                      value={draft.backgroundColor}
                      onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Brand Logo & Frame Options */}
        <div className="flex flex-col gap-5">
          {/* Brand Logo Card */}
          <div className="rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-3 mb-4">
              Brand Logo
            </h3>

            <div className="space-y-4">
              <p className="rounded-xl border border-[#E8F5C8] bg-[#F7FCEE] px-3 py-2 text-[12px] font-medium leading-relaxed text-[#3F5F00]">
                Default center logo is <span className="font-bold">AR360 Studio</span>.
                {allowCustomLogo
                  ? " Upload your logo below to replace it on this QR."
                  : " Custom logos unlock with a plan that includes custom branding."}
              </p>

              {allowCustomLogo ? (
                <>
                  <div>
                    <span className="block text-xs font-semibold text-[#525252] mb-1.5">Upload Logo File (PNG / SVG)</span>
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#C8CDD4] bg-[#FAFAFA] p-4 text-center cursor-pointer hover:bg-slate-50 transition">
                      <ImageIcon size={20} className="text-[#84D400]" />
                      <span className="text-xs font-bold text-[#525252]">Click to upload brand logo</span>
                      <span className="text-[10px] text-[#A3A3A3]">Supports PNG, JPG, SVG</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/svg+xml"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </label>
                  </div>

                  <div className="relative flex items-center my-3">
                    <div className="flex-grow border-t border-[#ECECEC]"></div>
                    <span className="flex-shrink mx-3 text-[10px] text-[#A3A3A3] font-bold uppercase">or</span>
                    <div className="flex-grow border-t border-[#ECECEC]"></div>
                  </div>

                  <label className="block text-xs font-semibold text-[#525252]">
                    Logo Image URL (PNG / SVG)
                    <div className="mt-1.5 flex gap-2">
                      <input
                        className="h-10 min-w-0 flex-grow rounded-xl border border-[#ECECEC] bg-white px-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#84D400]"
                        value={draft.logoUrl?.startsWith("data:") ? "" : draft.logoUrl}
                        onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                        placeholder="https://example.com/logo.png"
                      />
                      {draft.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, logoUrl: "" })}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </label>

                  {draft.logoUrl && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-semibold text-[#525252]">
                        Logo Scale Size
                        <div className="mt-1.5 flex items-center gap-3">
                          <input
                            type="range"
                            min="10"
                            max="28"
                            className="flex-1 accent-[#84D400]"
                            value={draft.logoSize}
                            onChange={(e) => setDraft({ ...draft, logoSize: Number(e.target.value) })}
                          />
                          <span className="w-8 text-right font-bold text-xs text-[#111111]">{draft.logoSize}%</span>
                        </div>
                      </label>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href="/dashboard/billing"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DCE7C2] bg-[#F7FCEE] px-4 text-xs font-bold text-[#3F5F00] hover:bg-[#EEF9E0]"
                >
                  Upgrade for custom QR logo
                </Link>
              )}
            </div>
          </div>

          {/* Frame Options Card */}
          <div className="rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-3 mb-4">
              Frame Options
            </h3>

            <div className="space-y-4">
              <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-[#ECECEC] p-3 hover:bg-[#FAFAFA] transition">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#84D400] focus:ring-[#84D400] accent-[#84D400] cursor-pointer"
                  checked={draft.frameEnabled}
                  onChange={(e) => setDraft({ ...draft, frameEnabled: e.target.checked })}
                />
                <div>
                  <p className="text-xs font-bold text-[#111111]">Enable outer scanner frame</p>
                  <p className="text-[10px] text-[#737373] mt-0.5">Adds a template badge around the code container.</p>
                </div>
              </label>

              {draft.frameEnabled && (
                <div className="space-y-3.5 pt-2 border-t border-[#ECECEC]">
                  <label className="block text-xs font-semibold text-[#525252]">
                    Frame Border Design
                    <select
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#ECECEC] bg-white px-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#84D400]"
                      value={draft.frameStyle}
                      onChange={(e) => setDraft({ ...draft, frameStyle: e.target.value })}
                    >
                      <option value="simple">Simple Frame</option>
                      <option value="corners">Focus Corners</option>
                      <option value="dotted">Dotted Outline</option>
                      <option value="dashed">Dashed Outline</option>
                      <option value="gradient">Gradient Glow</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-[#525252]">
                    Frame Color Accent
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        className="h-10 w-10 shrink-0 rounded-lg border border-[#ECECEC] bg-white cursor-pointer"
                        value={draft.frameColor}
                        onChange={(e) => setDraft({ ...draft, frameColor: e.target.value.toUpperCase() })}
                      />
                      <input
                        type="text"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-[#ECECEC] bg-white px-2.5 text-xs font-bold text-[#111111] uppercase outline-none focus:border-[#84D400]"
                        value={draft.frameColor}
                        onChange={(e) => setDraft({ ...draft, frameColor: e.target.value })}
                      />
                    </div>
                  </label>

                  <label className="block text-xs font-semibold text-[#525252]">
                    Frame Display Text
                    <input
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#ECECEC] bg-white px-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#84D400]"
                      value={draft.frameText}
                      onChange={(e) => setDraft({ ...draft, frameText: e.target.value })}
                      placeholder="Scan to view in 3D / AR"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Persistent Bottom Controls Bar (Matches Reference Layout) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#ECECEC] bg-white py-3 px-6 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[#525252]">
            <span className={`h-2.5 w-2.5 rounded-full ${isChanged ? "bg-amber-400" : "bg-emerald-400"}`} />
            {isChanged ? "You have unsaved changes" : "All changes match the database"}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetToOriginal}
              disabled={!isChanged}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-4 text-xs font-bold text-[#737373] hover:text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <RotateCcw size={14} /> Reset Design
            </button>

            <Link
              href="/dashboard/qr-center"
              className="flex h-10 items-center justify-center rounded-xl border border-[#ECECEC] bg-white px-4 text-xs font-bold text-[#737373] hover:text-[#111111] hover:bg-[#FAFAFA] transition"
            >
              Cancel
            </Link>

            <UserButton
              variant="ghost"
              loading={saving && !savedFlash}
              disabled={saving || savedFlash}
              icon={savedFlash ? <Check size={14} /> : <Save size={14} />}
              className={`h-10 rounded-xl border-transparent px-6 text-xs font-bold shadow-sm ${
                savedFlash
                  ? "bg-[#111111] text-white hover:bg-[#111111]"
                  : "bg-[#84D400] text-[#102000] hover:bg-[#78C400]"
              }`}
              onClick={() => void saveChanges()}
            >
              {savedFlash ? "Saved!" : saving ? "Saving…" : "Save QR Changes"}
            </UserButton>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {notice ? (
        <div className="fixed bottom-20 left-1/2 z-[100050] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#B6FF38] bg-[#0F1412] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.28)] md:bottom-8">
          <Check size={16} className="text-[#B6FF38]" />
          {notice}
        </div>
      ) : null}
    </div>
  );
}
