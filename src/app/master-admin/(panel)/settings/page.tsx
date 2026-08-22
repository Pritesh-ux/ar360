"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Mail,
  CreditCard,
  Database,
  Shield,
  Bell,
  Save,
  RotateCcw,
  Copy,
  AlertTriangle,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { useMasterAdminToast } from "@/components/features/master-admin/MasterAdminToastContext";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import ViewportPortal from "@/components/shared/ViewportPortal";
import "@/components/dashboard/dashboard-premium.css";

function detectRazorpayModeFromKey(keyId: string): "test" | "live" | null {
  if (keyId.startsWith("rzp_live_")) return "live";
  if (keyId.startsWith("rzp_test_")) return "test";
  return null;
}

export default function SettingsPage() {
  const { showToast } = useMasterAdminToast();
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [hostingerDetectStatus, setHostingerDetectStatus] = useState<string | null>(null);
  const [hostingerDetectLoading, setHostingerDetectLoading] = useState(false);
  const [razorpayTestStatus, setRazorpayTestStatus] = useState<string | null>(null);
  const [razorpayTestLoading, setRazorpayTestLoading] = useState(false);
  const [razorpayHealth, setRazorpayHealth] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saveError, setSaveError] = useState("");
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState<{
    activeProvider: "smtp" | "resend" | "disabled" | "unconfigured";
    smtp: { enabled: boolean; configured: boolean };
    resend: { enabled: boolean; configured: boolean };
  } | null>(null);

  // Custom justification modal state
  const [justificationOpen, setJustificationOpen] = useState(false);
  const [justificationTitle, setJustificationTitle] = useState("");
  const [justificationDescription, setJustificationDescription] = useState("");
  const [justificationReason, setJustificationReason] = useState("");
  const [justificationAction, setJustificationAction] = useState<((reason: string) => Promise<void>) | null>(null);

  const [settings, setSettings] = useState({
    companyName: "AR360 Studio",
    supportEmail: "support@ar360.studio",
    gstNumber: "",
    sellerAddress: "India",
    sellerState: "Gujarat",
    currency: "INR",
    razorpayKeyId: "",
    razorpayKeySecret: "",
    razorpayWebhookSecret: "",
    razorpayMode: "test" as "test" | "live",
    razorpayReconciliationEnabled: true,
    razorpayRolloutAllowlist: "",
    razorpayKillSwitch: false,
    nativeSubscriptionCheckoutEnabled: false,
    nativeSubscriptionRolloutPercent: 0,
    legacyOneTimeRenewalsEnabled: false,
    stripeKey: "",
    smtpHost: "",
    smtpEmail: "",
    smtpPort: 587,
    smtpPassword: "",
    smtpEnabled: true,
    resendEnabled: false,
    resendApiKey: "",
    resendFromEmail: "",
    resendReplyTo: "",
    storageProvider: "Supabase",
    maxLoginAttempts: 5,
    lockMinutes: 30,
    autoDeleteExpiredData: true,
    expiryWarningDays: 7,
    storageWarningPercent: 80,
    bandwidthWarningPercent: 80,
    maintenanceMode: false,
    emailNotifications: true,
    objectCaptureEnabled: true,
    platformStorageLimitGb: 50,
    platformBandwidthLimitGb: 4096,
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
  });

  useEffect(() => {
    let active = true;
    fetch("/api/master-admin/settings", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((data) => {
        if (active && data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          setEmailDelivery(data.emailDelivery || null);
          setRazorpayHealth(data.razorpayHealth || null);
          setWebhookUrl(data.webhookUrl || "");
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function requestJustification(title: string, description: string, action: (reason: string) => Promise<void>) {
    setJustificationTitle(title);
    setJustificationDescription(description);
    setJustificationReason("");
    setJustificationAction(() => action);
    setJustificationOpen(true);
  }

  async function handleJustificationSubmit() {
    const trimmed = justificationReason.trim();
    if (trimmed.length < 5) return;
    if (justificationAction) {
      await justificationAction(trimmed);
    }
    setJustificationOpen(false);
    setJustificationAction(null);
  }

  async function detectHostingerPlan(apply = true) {
    setHostingerDetectLoading(true);
    setHostingerDetectStatus(null);
    try {
      const res = await fetch("/api/master-admin/storage/detect-hostinger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHostingerDetectStatus(data.error || "Hostinger detect failed.");
        showToast(data.error || "Hostinger detect failed.", "err");
        return;
      }
      const detected = data.detected || {};
      if (data.settings) {
        setSettings((prev) => ({
          ...prev,
          storageProvider: data.settings.storageProvider || "Hostinger VPS",
          platformStorageLimitGb: Number(data.settings.platformStorageLimitGb || prev.platformStorageLimitGb),
          platformBandwidthLimitGb: Number(data.settings.platformBandwidthLimitGb || prev.platformBandwidthLimitGb),
        }));
      } else if (detected) {
        setSettings((prev) => ({
          ...prev,
          storageProvider: "Hostinger VPS",
          platformStorageLimitGb: Number(detected.platformStorageLimitGb || 50),
          platformBandwidthLimitGb: Number(detected.platformBandwidthLimitGb || 4096),
        }));
      }
      const msg = `Hostinger detected: ${detected.platformStorageLimitGb || 50} GB disk · ${detected.platformBandwidthLimitGb || 4096} GB bandwidth${
        detected.diskUsedGb != null ? ` · used ${detected.diskUsedGb} GB` : ""
      }`;
      setHostingerDetectStatus(msg);
      showToast(msg);
    } catch {
      setHostingerDetectStatus("Hostinger detect request failed.");
      showToast("Hostinger detect request failed.", "err");
    } finally {
      setHostingerDetectLoading(false);
    }
  }

  async function executePersistSettings(reason: string, showSuccess = true) {
    setSaveError("");
    const res = await fetch("/api/master-admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, reason: reason.trim(), confirm: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaveError(typeof data.error === "string" ? data.error : "Settings save failed.");
      showToast(typeof data.error === "string" ? data.error : "Settings save failed.", "err");
      return false;
    }
    if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
    if (data.emailDelivery) setEmailDelivery(data.emailDelivery);
    if (data.razorpayHealth) setRazorpayHealth(data.razorpayHealth);
    if (showSuccess) {
      showToast("Settings saved successfully.");
    }
    return true;
  }

  async function testRazorpay() {
    requestJustification(
      "Save & Test Razorpay",
      "Current form values will be saved, then Razorpay API connectivity will be tested with those keys.",
      async (reason) => {
        setRazorpayTestLoading(true);
        setRazorpayTestStatus("Saving keys and testing Razorpay…");
        setSaveError("");
        try {
          const res = await fetch("/api/master-admin/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "test_razorpay", settings, reason, confirm: true }),
          });
          const data = await res.json().catch(() => ({}));
          if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
          if (data.razorpayHealth) setRazorpayHealth(data.razorpayHealth);
          if (!res.ok) {
            setSaveError(typeof data.error === "string" ? data.error : "Connectivity test failed.");
            setRazorpayTestStatus(data.error || "Connectivity test failed.");
            return;
          }
          setRazorpayTestStatus(data.message || "Connectivity test completed.");
          showToast(data.message || "Razorpay connectivity test completed.");
        } catch {
          setRazorpayTestStatus("Connectivity test request failed.");
          showToast("Connectivity test request failed.", "err");
        } finally {
          setRazorpayTestLoading(false);
        }
      }
    );
  }

  async function saveSettings() {
    requestJustification(
      "Save Production Settings",
      "Please verify your changes and enter a brief reason for changing production configuration parameters:",
      async (reason) => {
        const success = await executePersistSettings(reason, true);
        if (!success) {
          /* saveError already set */
        }
      }
    );
  }

  function applyRazorpayKeyId(value: string) {
    const trimmed = value.trim();
    const mode = detectRazorpayModeFromKey(trimmed);
    setSettings((prev) => ({
      ...prev,
      razorpayKeyId: trimmed,
      ...(mode ? { razorpayMode: mode } : {}),
    }));
  }

  function prepareLiveCheckoutDefaults() {
    setSettings((prev) => ({
      ...prev,
      razorpayMode: "live",
      nativeSubscriptionCheckoutEnabled: true,
      nativeSubscriptionRolloutPercent: 100,
      razorpayKillSwitch: false,
      razorpayReconciliationEnabled: true,
    }));
  }

  async function copyWebhookUrl() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch {
      setSaveError("Could not copy webhook URL.");
    }
  }

  async function sendTestEmail() {
    requestJustification(
      "Save Settings & Test Email",
      "Settings will be saved before testing. Please enter a brief justification for modifying settings:",
      async (reason) => {
        setTestEmailLoading(true);
        setTestEmailStatus(null);
        try {
          const savedBeforeTest = await executePersistSettings(reason, false);
          if (!savedBeforeTest) {
            setTestEmailStatus("Save settings failed before email test.");
            return;
          }
          const res = await fetch("/api/master-admin/settings/test-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: settings.supportEmail || settings.smtpEmail }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setTestEmailStatus(data.error || "Test email failed.");
            return;
          }
          setTestEmailStatus(
            data.delivered
              ? `Live email sent via ${String(data.mode).toUpperCase()} to ${data.to}`
              : data.mode === "skipped"
                ? "Email notifications are disabled."
                : "No live provider is configured. Email was logged only.",
          );
        } catch {
          setTestEmailStatus("Test email request failed.");
        } finally {
          setTestEmailLoading(false);
        }
      }
    );
  }

  function resetSettings() {
    if (!confirm("Reset settings?")) return;

    setSettings({
      companyName: "AR360 Studio",
      supportEmail: "support@ar360.studio",
      gstNumber: "",
      sellerAddress: "India",
      sellerState: "Gujarat",
      currency: "INR",
      razorpayKeyId: "",
      razorpayKeySecret: "",
      razorpayWebhookSecret: "",
      razorpayMode: "test",
      razorpayReconciliationEnabled: true,
      razorpayRolloutAllowlist: "",
      razorpayKillSwitch: false,
      nativeSubscriptionCheckoutEnabled: false,
      nativeSubscriptionRolloutPercent: 0,
      legacyOneTimeRenewalsEnabled: false,
      stripeKey: "",
      smtpHost: "",
      smtpEmail: "",
      smtpPort: 587,
      smtpPassword: "",
      smtpEnabled: true,
      resendEnabled: false,
      resendApiKey: "",
      resendFromEmail: "",
      resendReplyTo: "",
      storageProvider: "Supabase",
      maxLoginAttempts: 5,
      lockMinutes: 30,
      autoDeleteExpiredData: true,
      expiryWarningDays: 7,
      storageWarningPercent: 80,
      bandwidthWarningPercent: 80,
      maintenanceMode: false,
      emailNotifications: true,
      objectCaptureEnabled: true,
      platformStorageLimitGb: 50,
      platformBandwidthLimitGb: 4096,
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
    });
  }

  const inputClass =
    "h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]";

  const textareaClass =
    "min-h-24 w-full rounded-[14px] border border-[#ECECEC] bg-white p-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]";

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Settings"
        subtitle="Manage company, billing, SMTP, storage, security and system configuration."
        actions={
          <>
            <button type="button" onClick={resetSettings} className="dash-premium-btn-secondary h-10 px-4 text-[12px]">
              <RotateCcw size={15} />
              Reset
            </button>
            <button type="button" onClick={saveSettings} className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <Save size={15} strokeWidth={2.2} />
              Save Settings
            </button>
          </>
        }
      />

      {saveError ? (
        <div className="flex items-start gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="dash-premium-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <Building2 className="text-slate-800" />
            <div>
              <h2 className="text-lg font-black text-[#111827]">
                Company &amp; invoice seller
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Yeh details tax invoices (PDF/HTML) pe From / seller block me print hoti hain.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <input
              value={settings.companyName}
              onChange={(e) =>
                setSettings({ ...settings, companyName: e.target.value })
              }
              placeholder="Legal company / seller name"
              className={inputClass}
            />

            <input
              value={settings.supportEmail}
              onChange={(e) =>
                setSettings({ ...settings, supportEmail: e.target.value })
              }
              placeholder="Support / billing email"
              className={inputClass}
            />

            <textarea
              value={settings.sellerAddress}
              onChange={(e) =>
                setSettings({ ...settings, sellerAddress: e.target.value })
              }
              placeholder="Full seller address (street, city, PIN)"
              className={textareaClass}
              rows={3}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <input
                value={settings.sellerState}
                onChange={(e) =>
                  setSettings({ ...settings, sellerState: e.target.value })
                }
                placeholder="State (e.g. Gujarat)"
                className={inputClass}
              />
              <input
                value={settings.gstNumber}
                onChange={(e) =>
                  setSettings({ ...settings, gstNumber: e.target.value })
                }
                placeholder="GSTIN"
                className={inputClass}
              />
            </div>

            <UserFilterDropdown
              hideLabel
              compact
              className="w-full"
              menuWidth={160}
              label="Currency"
              menuTitle="Currency"
              value={settings.currency}
              options={["INR", "USD", "EUR"]}
              onChange={(value) => setSettings({ ...settings, currency: value })}
            />
          </div>
        </div>

        <div className="dash-premium-card p-5 xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CreditCard className="text-slate-800" />
              <div>
                <h2 className="text-lg font-black text-[#111827]">Razorpay payments</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Panel mein keys save karo — checkout aur webhooks yahi se chalenge (env fallback only jab panel empty ho).
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${
                settings.razorpayMode === "live"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {settings.razorpayMode === "live" ? "Live mode" : "Test mode"}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-3">
              <UserFilterDropdown
                hideLabel
                compact
                className="w-full"
                menuWidth={220}
                label="Razorpay mode"
                menuTitle="Razorpay mode"
                value={settings.razorpayMode}
                options={["test", "live"]}
                onChange={(value) =>
                  setSettings({ ...settings, razorpayMode: value as "test" | "live" })
                }
                renderOption={(value) => (value === "live" ? "Live (real money)" : "Test (sandbox)")}
                renderValue={(value) => (value === "live" ? "Live (real money)" : "Test (sandbox)")}
              />
              <input
                value={settings.razorpayKeyId}
                onChange={(e) => applyRazorpayKeyId(e.target.value)}
                placeholder="Razorpay Key ID (rzp_test_… or rzp_live_…)"
                className={inputClass}
                autoComplete="off"
              />
              <input
                type="password"
                value={settings.razorpayKeySecret}
                onChange={(e) =>
                  setSettings({ ...settings, razorpayKeySecret: e.target.value })
                }
                placeholder="Razorpay Key Secret"
                className={inputClass}
                autoComplete="new-password"
              />
              <input
                type="password"
                value={settings.razorpayWebhookSecret}
                onChange={(e) => setSettings({ ...settings, razorpayWebhookSecret: e.target.value })}
                placeholder="Razorpay Webhook Secret (same mode as keys)"
                className={inputClass}
                autoComplete="new-password"
              />
              <div className="flex gap-2">
                <input value={webhookUrl} readOnly className={`${inputClass} flex-1`} aria-label="Razorpay webhook URL" />
                <button
                  type="button"
                  onClick={() => void copyWebhookUrl()}
                  className="dash-premium-btn-secondary inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[12px]"
                >
                  <Copy size={14} />
                  {webhookCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">
                Razorpay Dashboard → {settings.razorpayMode === "live" ? "Live" : "Test"} → Webhooks → add this URL,
                then paste the webhook signing secret above.
              </p>
            </div>

            <div className="grid gap-3 content-start">
              <div className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-3 text-[12px] font-semibold text-slate-700">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Go-live checklist</p>
                <ul className="mt-2 space-y-1.5">
                  <li className={settings.razorpayMode === "live" ? "text-emerald-700" : "text-amber-700"}>
                    {settings.razorpayMode === "live" ? "✓" : "○"} Mode = Live
                  </li>
                  <li className={settings.razorpayKeyId.startsWith("rzp_live_") ? "text-emerald-700" : "text-slate-600"}>
                    {settings.razorpayKeyId.startsWith("rzp_live_") ? "✓" : "○"} Live Key ID pasted
                  </li>
                  <li className={settings.razorpayKeySecret ? "text-emerald-700" : "text-slate-600"}>
                    {settings.razorpayKeySecret ? "✓" : "○"} Key Secret saved
                  </li>
                  <li className={settings.razorpayWebhookSecret ? "text-emerald-700" : "text-slate-600"}>
                    {settings.razorpayWebhookSecret ? "✓" : "○"} Live Webhook Secret saved
                  </li>
                  <li className={settings.nativeSubscriptionCheckoutEnabled && !settings.razorpayKillSwitch ? "text-emerald-700" : "text-slate-600"}>
                    {settings.nativeSubscriptionCheckoutEnabled && !settings.razorpayKillSwitch ? "✓" : "○"} Checkout on + kill switch off
                  </li>
                  <li className={settings.nativeSubscriptionRolloutPercent >= 100 ? "text-emerald-700" : "text-slate-600"}>
                    {settings.nativeSubscriptionRolloutPercent >= 100 ? "✓" : "○"} Rollout 100% (or use allowlist)
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={prepareLiveCheckoutDefaults}
                  className="dash-premium-btn-secondary mt-3 h-9 px-3 text-[11px]"
                >
                  Apply live checkout defaults
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-xl border p-3 text-xs font-bold">Checkout enabled
                  <input className="ml-3" type="checkbox" checked={settings.nativeSubscriptionCheckoutEnabled}
                    onChange={(e) => setSettings({ ...settings, nativeSubscriptionCheckoutEnabled: e.target.checked })} />
                </label>
                <label className="rounded-xl border p-3 text-xs font-bold">Reconciliation enabled
                  <input className="ml-3" type="checkbox" checked={settings.razorpayReconciliationEnabled}
                    onChange={(e) => setSettings({ ...settings, razorpayReconciliationEnabled: e.target.checked })} />
                </label>
              </div>
              <input type="number" min={0} max={100} value={settings.nativeSubscriptionRolloutPercent}
                onChange={(e) => setSettings({ ...settings, nativeSubscriptionRolloutPercent: Number(e.target.value) })} placeholder="Checkout rollout percentage" className={inputClass} />
              <textarea value={settings.razorpayRolloutAllowlist}
                onChange={(e) => setSettings({ ...settings, razorpayRolloutAllowlist: e.target.value })}
                placeholder="Rollout customer allowlist, comma-separated (optional)" className={textareaClass} />
              <label className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
                Checkout kill switch (webhooks remain active)
                <input className="ml-3" type="checkbox" checked={settings.razorpayKillSwitch}
                  onChange={(e) => setSettings({ ...settings, razorpayKillSwitch: e.target.checked })} />
              </label>
              <button
                type="button"
                disabled={razorpayTestLoading}
                onClick={() => void testRazorpay()}
                className="dash-premium-btn-primary h-10 px-4 text-[12px] disabled:opacity-60"
              >
                {razorpayTestLoading ? "Saving & testing…" : "Save keys & test connectivity"}
              </button>
              {razorpayTestStatus && (
                <p className="text-xs font-semibold text-slate-600">{razorpayTestStatus}</p>
              )}
              <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                <p>Webhook backlog: {razorpayHealth?.backlog ?? 0}</p>
                <p>Last event: {razorpayHealth?.lastWebhook?.event_type || "none"} · {razorpayHealth?.lastWebhook?.status || "—"}</p>
                <p>Last failure: {razorpayHealth?.lastWebhook?.last_error || "none"}</p>
              </div>
              <input
                value={settings.stripeKey}
                onChange={(e) =>
                  setSettings({ ...settings, stripeKey: e.target.value })
                }
                placeholder="Stripe key (optional)"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="dash-premium-card p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="text-slate-800" />
              <div>
                <h2 className="text-lg font-black text-[#111827]">Email Delivery</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  SMTP first, Resend live fallback second.
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${
                emailDelivery?.activeProvider === "smtp"
                  ? "bg-blue-50 text-blue-700"
                  : emailDelivery?.activeProvider === "resend"
                    ? "bg-[#A6FF2E]/20 text-[#477500]"
                    : emailDelivery?.activeProvider === "disabled"
                      ? "bg-slate-100 text-slate-500"
                      : "bg-amber-50 text-amber-700"
              }`}
            >
              {emailDelivery?.activeProvider === "smtp"
                ? "SMTP Active"
                : emailDelivery?.activeProvider === "resend"
                  ? "Resend Live"
                  : emailDelivery?.activeProvider === "disabled"
                    ? "Email Off"
                    : "Not Configured"}
            </span>
          </div>

          <div className="grid gap-4">
            <label className="flex items-center justify-between rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-700">
              Send transactional emails
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) =>
                  setSettings({ ...settings, emailNotifications: e.target.checked })
                }
                className="h-5 w-5 accent-[#84D400]"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 p-4">
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-black text-slate-900">SMTP provider</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                    Enabled and configured SMTP always gets first priority.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.smtpEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, smtpEnabled: e.target.checked })
                  }
                  className="h-5 w-5 accent-[#84D400]"
                />
              </label>

              <div className={`mt-4 grid gap-3 ${settings.smtpEnabled ? "" : "pointer-events-none opacity-45"}`}>
                <input
                  value={settings.smtpHost}
                  onChange={(e) =>
                    setSettings({ ...settings, smtpHost: e.target.value })
                  }
                  placeholder="SMTP host — smtp.gmail.com"
                  className={inputClass}
                />
                <input
                  value={settings.smtpEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, smtpEmail: e.target.value })
                  }
                  placeholder="SMTP email / username"
                  className={inputClass}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={settings.smtpPort}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpPort: Number(e.target.value) || 587 })
                    }
                    placeholder="SMTP port"
                    className={inputClass}
                  />
                  <input
                    type="password"
                    value={settings.smtpPassword}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpPassword: e.target.value })
                    }
                    placeholder="SMTP password / app password"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#DCECBF] bg-[#FBFFF4] p-4">
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-black text-slate-900">Resend live fallback</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                    SMTP off or incomplete ho to emails Resend API se jayenge.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.resendEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, resendEnabled: e.target.checked })
                  }
                  className="h-5 w-5 accent-[#84D400]"
                />
              </label>

              <div className={`mt-4 grid gap-3 ${settings.resendEnabled ? "" : "pointer-events-none opacity-45"}`}>
                <input
                  type="password"
                  value={settings.resendApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, resendApiKey: e.target.value })
                  }
                  placeholder="Resend API key — re_..."
                  className={inputClass}
                />
                <input
                  value={settings.resendFromEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, resendFromEmail: e.target.value })
                  }
                  placeholder="From — AR360 <mail@yourdomain.com>"
                  className={inputClass}
                />
                <input
                  value={settings.resendReplyTo}
                  onChange={(e) =>
                    setSettings({ ...settings, resendReplyTo: e.target.value })
                  }
                  placeholder="Reply-to email (optional)"
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={sendTestEmail}
              disabled={testEmailLoading}
              className="dash-premium-btn-secondary h-10 px-4 text-[12px] disabled:opacity-60"
            >
              {testEmailLoading ? "Sending…" : "Save & Send Live Test"}
            </button>

            {testEmailStatus ? (
              <p className="text-xs font-semibold text-slate-600">{testEmailStatus}</p>
            ) : null}

            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
              Priority: SMTP enabled + configured → SMTP. Otherwise Resend enabled + configured → Resend Live.
              Resend sender domain must be verified in your Resend account.
            </p>
          </div>
        </div>

        <div className="dash-premium-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <Database className="text-slate-800" />
            <h2 className="text-lg font-black text-[#111827]">
              Storage Settings
            </h2>
          </div>

          <div className="grid gap-4">
            <UserFilterDropdown
              hideLabel
              compact
              className="w-full"
              menuWidth={260}
              label="Storage provider"
              menuTitle="Storage provider"
              value={
                ["Hostinger VPS", "Local Storage", "Local", "Supabase", "AWS S3", "Cloudflare R2"].includes(
                  settings.storageProvider,
                )
                  ? settings.storageProvider === "Local"
                    ? "Local Storage"
                    : settings.storageProvider
                  : "Hostinger VPS"
              }
              options={["Hostinger VPS", "Local Storage", "Supabase", "AWS S3", "Cloudflare R2"]}
              onChange={(value) => {
                setSettings({ ...settings, storageProvider: value });
                if (/hostinger/i.test(value)) {
                  void detectHostingerPlan(true);
                }
              }}
            />

            <button
              type="button"
              disabled={hostingerDetectLoading}
              onClick={() => void detectHostingerPlan(true)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D8F5A0] bg-[#F4FFE6] px-4 text-[12px] font-bold text-[#3D6600] hover:bg-[#EAF9C8] disabled:opacity-60"
            >
              {hostingerDetectLoading ? "Detecting Hostinger plan…" : "Auto-detect Hostinger plan"}
            </button>
            {hostingerDetectStatus ? (
              <p className="text-[12px] font-semibold text-slate-600">{hostingerDetectStatus}</p>
            ) : (
              <p className="text-[11px] font-medium text-slate-400">
                Selects Hostinger VPS and fills disk/bandwidth from your live server (e.g. 50 GB / 4 TB).
              </p>
            )}

            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase tracking-wide">
              Platform Storage Limit (GB)
              <input
                type="number"
                min="1"
                value={settings.platformStorageLimitGb}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platformStorageLimitGb: Number(e.target.value) || 0,
                  })
                }
                placeholder="Platform storage limit in GB"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase tracking-wide">
              Platform Bandwidth Limit (GB)
              <input
                type="number"
                min="1"
                value={settings.platformBandwidthLimitGb}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platformBandwidthLimitGb: Number(e.target.value) || 0,
                  })
                }
                placeholder="Platform bandwidth limit in GB"
                className={inputClass}
              />
            </label>

            <label className="flex items-center justify-between rounded-[14px] bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-600 border border-slate-100 select-none">
              Auto delete expired customer data
              <input
                type="checkbox"
                checked={settings.autoDeleteExpiredData}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    autoDeleteExpiredData: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-slate-200 text-slate-900 focus:ring-[#A6FF2E]"
              />
            </label>
          </div>
        </div>

        <div className="dash-premium-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <Shield className="text-slate-800" />
            <h2 className="text-lg font-black text-[#111827]">
              Security Settings
            </h2>
          </div>

          <div className="grid gap-4">
            <input
              type="number"
              value={settings.maxLoginAttempts}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxLoginAttempts: Number(e.target.value),
                })
              }
              placeholder="Max login attempts"
              className={inputClass}
            />

            <input
              type="number"
              value={settings.lockMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  lockMinutes: Number(e.target.value),
                })
              }
              placeholder="Lock duration minutes"
              className={inputClass}
            />

            <label className="flex items-center justify-between rounded-[14px] bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-600 border border-slate-100 select-none">
              Maintenance Mode
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maintenanceMode: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-slate-200 text-slate-900 focus:ring-[#A6FF2E]"
              />
            </label>

            <label className="flex items-center justify-between rounded-[14px] bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-600 border border-slate-100 select-none">
              Object Capture (global)
              <input
                type="checkbox"
                checked={settings.objectCaptureEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    objectCaptureEnabled: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-slate-200 text-slate-900 focus:ring-[#A6FF2E]"
              />
            </label>
            {!settings.objectCaptureEnabled && (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-amber-700 border border-amber-200">
                Object Capture is disabled globally. All users will lose access regardless of their plan settings. The sidebar link will be hidden and API requests will be blocked.
              </p>
            )}
          </div>
        </div>

        <div className="dash-premium-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <Bell className="text-slate-800" />
            <h2 className="text-lg font-black text-[#111827]">
              Alert Settings
            </h2>
          </div>

          <div className="grid gap-4">
            <input
              type="number"
              value={settings.expiryWarningDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  expiryWarningDays: Number(e.target.value),
                })
              }
              placeholder="Expiry warning days"
              className={inputClass}
            />

            <input
              type="number"
              value={settings.storageWarningPercent}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  storageWarningPercent: Number(e.target.value),
                })
              }
              placeholder="Storage warning %"
              className={inputClass}
            />

            <input
              type="number"
              value={settings.bandwidthWarningPercent}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bandwidthWarningPercent: Number(e.target.value),
                })
              }
              placeholder="Bandwidth warning %"
              className={inputClass}
            />

            <label className="flex items-center justify-between rounded-[14px] bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-600 border border-slate-100 select-none">
              Email Notifications
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    emailNotifications: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-slate-200 text-slate-900 focus:ring-[#A6FF2E]"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Custom Justification Modal Overlay */}
      {justificationOpen && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setJustificationOpen(false)} />
          <div className="relative w-full max-w-md rounded-[20px] border border-[#ECECEC] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-4">
              <h3 className="text-lg font-black text-slate-950">
                {justificationTitle}
              </h3>
              <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-normal">
                {justificationDescription}
              </p>
            </div>
            
            <div className="mb-5">
              <textarea
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                placeholder="Type your justification (at least 5 characters)..."
                className={`${textareaClass} min-h-24 text-[12px]`}
              />
              {justificationReason.trim().length > 0 && justificationReason.trim().length < 5 && (
                <p className="mt-1 text-[10px] font-bold text-red-500">
                  Reason must be at least 5 characters (currently {justificationReason.trim().length}).
                </p>
              )}
            </div>
            
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setJustificationOpen(false)}
                className="dash-premium-btn-secondary h-9 px-4 text-[12px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justificationReason.trim().length < 5}
                onClick={() => void handleJustificationSubmit()}
                className="dash-premium-btn-primary h-9 px-4 text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}
    </div>
  );
}