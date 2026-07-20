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
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [razorpayHealth, setRazorpayHealth] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [emailDelivery, setEmailDelivery] = useState<{
    activeProvider: "smtp" | "resend" | "disabled" | "unconfigured";
    smtp: { enabled: boolean; configured: boolean };
    resend: { enabled: boolean; configured: boolean };
  } | null>(null);

  const [settings, setSettings] = useState({
    companyName: "AR360",
    supportEmail: "support@ar360.com",
    gstNumber: "24ABCDE1234F1Z5",
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

  async function persistSettings(showSuccess = true) {
    const reason = window.prompt("Reason for changing production settings:");
    if (!reason || reason.trim().length < 5) return false;
    const res = await fetch("/api/master-admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, reason: reason.trim(), confirm: true }),
    });
    if (!res.ok) {
      alert("Settings save failed.");
      return false;
    }
    const data = await res.json().catch(() => ({}));
    if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
    if (data.emailDelivery) setEmailDelivery(data.emailDelivery);
    if (showSuccess) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    return true;
  }

  async function testRazorpay() {
    const reason = window.prompt("Reason for provider connectivity test:");
    if (!reason || reason.trim().length < 5) return;
    setTestEmailStatus("Testing Razorpay connectivity…");
    const res = await fetch("/api/master-admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_razorpay", settings, reason, confirm: true }),
    });
    const data = await res.json().catch(() => ({}));
    setTestEmailStatus(data.message || data.error || "Connectivity test completed.");
  }

  async function saveSettings() {
    await persistSettings(true);
  }

  async function sendTestEmail() {
    setTestEmailLoading(true);
    setTestEmailStatus(null);
    try {
      const savedBeforeTest = await persistSettings(false);
      if (!savedBeforeTest) return;
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

  function resetSettings() {
    if (!confirm("Reset settings?")) return;

    setSettings({
      companyName: "AR360",
      supportEmail: "support@ar360.com",
      gstNumber: "24ABCDE1234F1Z5",
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
    });
  }

  const inputClass =
    "h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#A6FF2E] focus:ring-2 focus:ring-[#A6FF2E] transition-all";

  return (
    <div className="min-h-full p-4 md:p-6 2xl:p-8 pb-10 md:pb-12">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-[32px]">
            Settings
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Manage company, billing, SMTP, storage, security and system configuration.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={resetSettings}
            className="inline-flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 shadow-[var(--shadow-sm)]"
          >
            <RotateCcw size={18} />
            Reset
          </button>

          <button
            onClick={saveSettings}
            className="inline-flex items-center gap-2 rounded-[14px] bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-[var(--color-text)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-hover)] transition-all"
          >
            <Save size={18} />
            Save Settings
          </button>
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-2xl">
          <CheckCircle2 size={20} className="text-[#A6FF2E]" />
          Settings saved successfully.
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-[20px] border border-slate-200/60 bg-white p-5 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
          <div className="mb-5 flex items-center gap-3">
            <Building2 className="text-slate-800" />
            <h2 className="text-xl font-black text-slate-950">
              Company Settings
            </h2>
          </div>

          <div className="grid gap-4">
            <select value={settings.razorpayMode} onChange={(e) => setSettings({ ...settings, razorpayMode: e.target.value as "test" | "live" })} className={inputClass}>
              <option value="test">Razorpay Test</option>
              <option value="live">Razorpay Live</option>
            </select>
            <input
              value={settings.companyName}
              onChange={(e) =>
                setSettings({ ...settings, companyName: e.target.value })
              }
              placeholder="Company name"
              className={inputClass}
            />

            <input
              type="password"
              value={settings.razorpayWebhookSecret}
              onChange={(e) => setSettings({ ...settings, razorpayWebhookSecret: e.target.value })}
              placeholder="Dedicated Razorpay Webhook Secret"
              className={inputClass}
            />

            <input value={webhookUrl} readOnly className={inputClass} aria-label="Razorpay webhook URL" />

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
              placeholder="Rollout customer allowlist, comma-separated" className="min-h-20 rounded-[14px] border border-slate-200 p-4 text-sm font-semibold" />
            <label className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
              Checkout kill switch (webhooks remain active)
              <input className="ml-3" type="checkbox" checked={settings.razorpayKillSwitch}
                onChange={(e) => setSettings({ ...settings, razorpayKillSwitch: e.target.checked })} />
            </label>
            <button type="button" onClick={() => void testRazorpay()} className="rounded-[14px] border border-slate-200 px-5 py-3 text-sm font-black">
              Test Razorpay Connectivity
            </button>
            <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
              <p>Webhook backlog: {razorpayHealth?.backlog ?? 0}</p>
              <p>Last event: {razorpayHealth?.lastWebhook?.event_type || "none"} · {razorpayHealth?.lastWebhook?.status || "—"}</p>
              <p>Last failure: {razorpayHealth?.lastWebhook?.last_error || "none"}</p>
            </div>

            <input
              value={settings.supportEmail}
              onChange={(e) =>
                setSettings({ ...settings, supportEmail: e.target.value })
              }
              placeholder="Support email"
              className={inputClass}
            />

            <input
              value={settings.gstNumber}
              onChange={(e) =>
                setSettings({ ...settings, gstNumber: e.target.value })
              }
              placeholder="GST number"
              className={inputClass}
            />

            <select
              value={settings.currency}
              onChange={(e) =>
                setSettings({ ...settings, currency: e.target.value })
              }
              className={inputClass}
            >
              <option>INR</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200/60 bg-white p-5 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
          <div className="mb-5 flex items-center gap-3">
            <CreditCard className="text-slate-800" />
            <h2 className="text-xl font-black text-slate-950">
              Payment Settings
            </h2>
          </div>

          <div className="grid gap-4">
            <input
              value={settings.razorpayKeyId}
              onChange={(e) =>
                setSettings({ ...settings, razorpayKeyId: e.target.value })
              }
              placeholder="Razorpay Key ID"
              className={inputClass}
            />

            <input
              type="password"
              value={settings.razorpayKeySecret}
              onChange={(e) =>
                setSettings({ ...settings, razorpayKeySecret: e.target.value })
              }
              placeholder="Razorpay Key Secret"
              className={inputClass}
            />

            <input
              value={settings.stripeKey}
              onChange={(e) =>
                setSettings({ ...settings, stripeKey: e.target.value })
              }
              placeholder="Stripe key (optional)"
              className={inputClass}
            />

            <div className="rounded-2xl bg-[#A6FF2E]/10 p-4 text-xs font-bold text-slate-700">
              Razorpay Key ID + Secret save karne ke baad dashboard upgrade checkout me wahi keys use hongi.
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200/60 bg-white p-5 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="text-slate-800" />
              <div>
                <h2 className="text-xl font-black text-slate-950">Email Delivery</h2>
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
              className="rounded-[14px] border border-slate-200 bg-white hover:bg-slate-50 px-5 py-3 text-sm font-black text-slate-700 transition disabled:opacity-60"
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

        <div className="rounded-[20px] border border-slate-200/60 bg-white p-5 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
          <div className="mb-5 flex items-center gap-3">
            <Database className="text-slate-800" />
            <h2 className="text-xl font-black text-slate-950">
              Storage Settings
            </h2>
          </div>

          <div className="grid gap-4">
            <select
              value={settings.storageProvider}
              onChange={(e) =>
                setSettings({ ...settings, storageProvider: e.target.value })
              }
              className={inputClass}
            >
              <option>Supabase</option>
              <option>AWS S3</option>
              <option>Cloudflare R2</option>
              <option>Local Storage</option>
            </select>

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

        <div className="rounded-[20px] border border-slate-200/60 bg-white p-5 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
          <div className="mb-5 flex items-center gap-3">
            <Shield className="text-slate-800" />
            <h2 className="text-xl font-black text-slate-950">
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
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200/60 bg-white p-5 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
          <div className="mb-5 flex items-center gap-3">
            <Bell className="text-slate-800" />
            <h2 className="text-xl font-black text-slate-950">
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
    </div>
  );
}