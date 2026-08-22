"use client";

import Link from "next/link";
import AppImage from "@/components/shared/AppImage";
import { useCallback, useState, type FormEvent } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Shield,
  Star,
  Upload,
  X,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import { UserField, UserInput } from "@/components/user-panel/UserInput";
import { DomainsTab } from "./SettingsExtendedPanels";

export type SettingsFormState = {
  fullName: string;
  email: string;
  photo: string;
  companyName: string;
  phone: string;
  country: string;
  gst: string;
  website: string;
  address: string;
  city: string;
  zip: string;
  state: string;
  timezone: string;
};

type VerificationState = {
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
};

type Props = {
  form: SettingsFormState;
  updateField: <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => void;
  uploadPhoto: (file?: File) => void;
  showToast: (message: string) => void;
  planName: string;
  renewalDate?: string | null;
  subStatus: string;
  isTrial: boolean;
  joinedLabel?: string;
  domainConnected?: boolean;
  paymentAdded?: boolean;
  allowCustomDomain?: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function AvatarCircle({
  photo,
  name,
  size = "md",
}: {
  photo?: string;
  name: string;
  size?: "md" | "lg" | "xl";
}) {
  const cls =
    size === "xl"
      ? "h-28 w-28 text-4xl"
      : size === "lg"
        ? "h-16 w-16 text-2xl"
        : "h-12 w-12 text-base";
  if (photo) {
    return <AppImage src={photo} alt={name} className={`${cls} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${cls} grid shrink-0 place-items-center rounded-full bg-[#EEF9E0] font-black text-[#3D6600]`}
    >
      {initials(name)}
    </div>
  );
}

function HealthItem({
  label,
  ok,
  pending,
}: {
  label: string;
  ok: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#374151]">
      {ok ? (
        <CheckCircle2 size={16} className="shrink-0 text-[#5AA700]" />
      ) : pending ? (
        <AlertTriangle size={16} className="shrink-0 text-amber-500" />
      ) : (
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[#D4D4D4] text-[9px] text-[#A3A3A3]">
          ·
        </span>
      )}
      <span>
        {label}
        {!ok && pending ? <span className="ml-1 font-medium text-amber-600">Pending</span> : null}
      </span>
    </div>
  );
}

function PasswordChangeModal({
  open,
  onClose,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validation = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password cannot be the same as current password.");
      return;
    }
    const { length, uppercase, lowercase, number, special } = validation;
    if (!length || !uppercase || !lowercase || !number || !special) {
      setError("New password does not meet the requirements.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update password.");
        return;
      }
      showToast("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      onClose();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-change-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="password-change-title" className="text-base font-bold text-[#111111]">
              Change password
            </h3>
            <p className="mt-0.5 text-xs text-[#737373]">Update your account password.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#F5F5F5]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
              {error}
            </div>
          ) : null}

          <UserField label="Current password">
            <div className="relative">
              <UserInput
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </UserField>

          <UserField label="New password">
            <div className="relative">
              <UserInput
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </UserField>

          <UserField label="Confirm new password">
            <div className="relative">
              <UserInput
                type={showConfirm ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </UserField>

          {newPassword ? (
            <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFA] p-3 text-xs">
              <p className="mb-2 font-semibold text-[#525252]">New password must contain:</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    ["Min 8 chars", validation.length],
                    ["1 uppercase", validation.uppercase],
                    ["1 lowercase", validation.lowercase],
                    ["1 number", validation.number],
                    ["1 special char", validation.special],
                  ] as const
                ).map(([label, ok]) => (
                  <div
                    key={label}
                    className={`flex items-center gap-1.5 ${ok ? "font-medium text-green-600" : "text-[#A3A3A3]"}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-green-600" : "bg-[#D4D4D4]"}`}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#ECECEC] px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-xl bg-[#B6FF38] px-5 text-sm font-bold text-[#102000] hover:bg-[#A8F030] disabled:opacity-60"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsProfileView({
  form,
  updateField,
  uploadPhoto,
  showToast,
  planName,
  renewalDate,
  subStatus,
  isTrial,
  joinedLabel,
  domainConnected = false,
  paymentAdded = false,
  allowCustomDomain = false,
}: Props) {
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState<"idle" | "verify">("idle");

  const loadVerification = useCallback(async () => {
    const res = await fetch("/api/account/verification", { cache: "no-store" });
    if (!res.ok) return;
    const body = await res.json();
    setVerification(body.verification || null);
  }, []);

  useDeferredEffect(() => {
    void loadVerification();
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "email") {
      showToast("Email verified successfully");
      window.history.replaceState({}, "", "/dashboard/settings?tab=profile");
      void loadVerification();
    }
  }, [loadVerification, showToast]);

  async function runVerification(action: string, extra: Record<string, string> = {}) {
    setBusy(action);
    try {
      const res = await fetch("/api/account/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, phone: form.phone, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Request failed");
      if (action === "send_email") showToast("Verification email sent — check your inbox");
      if (action === "send_phone") showToast("Phone code emailed to you");
      if (action === "confirm_phone") {
        showToast("Phone verified");
        setPhoneCode("");
      }
      await loadVerification();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(null);
    }
  }

  async function requestEnable2fa() {
    setBusy("2fa_request");
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable_request", password: twoFactorPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Could not start 2FA setup");
        return;
      }
      setTwoFactorStep("verify");
      showToast(data.message || "Enter the verification code");
    } finally {
      setBusy(null);
    }
  }

  async function confirmEnable2fa() {
    setBusy("2fa_confirm");
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable_confirm", code: twoFactorCode }),
      });
      if (res.ok) {
        setTwoFactorStep("idle");
        setTwoFactorPassword("");
        setTwoFactorCode("");
        setTwoFactorOpen(false);
        showToast("Two-factor authentication enabled");
        await loadVerification();
      } else {
        const data = await res.json();
        showToast(data.error || "Invalid code");
      }
    } finally {
      setBusy(null);
    }
  }

  async function disable2fa() {
    setBusy("2fa_disable");
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: twoFactorPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorPassword("");
        setTwoFactorOpen(false);
        showToast("Two-factor authentication disabled");
        await loadVerification();
      } else {
        showToast(data.error || "Could not disable 2FA");
      }
    } finally {
      setBusy(null);
    }
  }

  const emailOk = Boolean(verification?.emailVerified);
  const phoneOk = Boolean(verification?.phoneVerified);
  const twoOk = Boolean(verification?.twoFactorEnabled);
  const checks = [emailOk, phoneOk, domainConnected, paymentAdded, twoOk];
  const healthPct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const activePlan = subStatus === "active" && !isTrial;

  function scrollToPhone() {
    document.getElementById("settings-verify-phone")?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("settings-phone")?.focus();
  }

  function openTwoFactor() {
    setTwoFactorOpen(true);
    setTimeout(() => {
      document.getElementById("settings-2fa")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  return (
    <div className="space-y-4">
      <PasswordChangeModal open={passwordOpen} onClose={() => setPasswordOpen(false)} showToast={showToast} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-start gap-4">
            <AvatarCircle photo={form.photo} name={form.fullName || "User"} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold text-[#111111]">
                  {form.fullName || "Your name"}
                </h2>
                {emailOk ? (
                  <span className="rounded-full bg-[#EEF9E0] px-2.5 py-0.5 text-[11px] font-bold text-[#3D6600]">
                    Verified
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm text-[#737373]">{form.email}</p>
              <p className="mt-1 text-xs font-medium text-[#A3A3A3]">
                {form.country || "India"}
                {joinedLabel ? ` · Joined ${joinedLabel}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EEF9E0] text-[#5AA700]">
              <Star size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A3A3A3]">
                Current plan
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#111111]">{planName}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    activePlan
                      ? "bg-[#EEF9E0] text-[#3D6600]"
                      : isTrial
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {activePlan ? "Active" : isTrial ? "Trial" : subStatus}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-[#737373]">
                {isTrial ? "Ends" : "Renews"} {renewalDate || "—"}
              </p>
              <Link
                href="/dashboard/billing"
                className="mt-3 inline-flex h-9 items-center rounded-xl bg-[#B6FF38] px-3 text-xs font-bold text-[#102000] hover:bg-[#A8F030]"
              >
                Manage Plan
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div
              className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#84D400 ${healthPct}%, #ECECEC 0)`,
              }}
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-sm font-black text-[#111111]">
                {healthPct}%
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-[#111111]">Account Health</p>
              <p className="text-xs text-[#737373]">Finish setup for a more secure account.</p>
            </div>
          </div>
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <HealthItem label="Email Verified" ok={emailOk} />
            <HealthItem label="Phone Verified" ok={phoneOk} pending={!phoneOk} />
            <HealthItem label="Domain Connected" ok={domainConnected} pending={!domainConnected} />
            <HealthItem label="Payment Added" ok={paymentAdded} pending={!paymentAdded} />
            <HealthItem label="Enable 2FA" ok={twoOk} pending={!twoOk} />
          </div>
          <UserButton
            onClick={() => {
              if (!twoOk) openTwoFactor();
              else if (!phoneOk) scrollToPhone();
              else if (!domainConnected) {
                document.getElementById("settings-domains")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className="h-11 shrink-0 rounded-xl bg-[#B6FF38] px-5 font-bold text-[#102000] hover:bg-[#A8F030]"
          >
            Complete Setup
          </UserButton>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h3 className="text-sm font-bold text-[#111111]">Profile Information</h3>
            <p className="mt-0.5 text-xs text-[#737373]">Your personal and company details.</p>

            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <AvatarCircle photo={form.photo} name={form.fullName || "User"} size="xl" />
                  <label className="absolute bottom-1 right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-[#ECECEC] bg-white shadow-sm hover:bg-[#FAFAFA]">
                    <Camera size={15} />
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => uploadPhoto(e.target.files?.[0])}
                    />
                  </label>
                </div>
                <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[#ECECEC] bg-white px-3 text-xs font-semibold text-[#111111] hover:bg-[#FAFAFA]">
                  <Upload size={14} />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => uploadPhoto(e.target.files?.[0])}
                  />
                </label>
              </div>

              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                <UserField label="Full Name">
                  <UserInput
                    id="settings-full-name"
                    value={form.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                  />
                </UserField>
                <UserField label="Email Address" hint="Contact support to change login email.">
                  <UserInput value={form.email} disabled />
                </UserField>
                <UserField label="Phone Number" className="sm:col-span-2">
                  <div id="settings-verify-phone" className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
                      <UserInput
                        id="settings-phone"
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="+91 …"
                      />
                      {phoneOk ? (
                        <span className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#EEF9E0] text-xs font-bold text-[#3D6600]">
                          Verified
                        </span>
                      ) : (
                        <UserButton
                          loading={busy === "send_phone"}
                          disabled={!form.phone.trim()}
                          onClick={() => void runVerification("send_phone")}
                          className="h-11 w-full rounded-xl border border-[#ECECEC] bg-white px-3 text-xs font-bold text-[#111111]"
                        >
                          Send code
                        </UserButton>
                      )}
                    </div>
                    {!phoneOk ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
                        <UserInput
                          className="h-11"
                          placeholder="6-digit code"
                          value={phoneCode}
                          onChange={(e) => setPhoneCode(e.target.value)}
                        />
                        <UserButton
                          loading={busy === "confirm_phone"}
                          disabled={phoneCode.trim().length !== 6}
                          onClick={() => void runVerification("confirm_phone", { code: phoneCode.trim() })}
                          className="h-11 w-full rounded-xl bg-[#B6FF38] px-3 text-xs font-bold text-[#102000] disabled:opacity-60"
                        >
                          Confirm
                        </UserButton>
                      </div>
                    ) : null}
                  </div>
                </UserField>
                <UserField label="Time Zone">
                  <UserInput
                    value={form.timezone}
                    onChange={(e) => updateField("timezone", e.target.value)}
                  />
                </UserField>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h3 className="text-sm font-bold text-[#111111]">Company & Billing Details</h3>
            <p className="mt-0.5 text-xs text-[#737373]">Used on GST invoices and payment receipts.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <UserField label="Company Name">
                <UserInput
                  value={form.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                />
              </UserField>
              <UserField label="GST Number (Optional)">
                <UserInput value={form.gst} onChange={(e) => updateField("gst", e.target.value)} />
              </UserField>
              <UserField label="Website (Optional)">
                <UserInput
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://"
                />
              </UserField>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h3 className="text-sm font-bold text-[#111111]">Verification & Security</h3>
            <p className="mt-0.5 text-xs text-[#737373]">Secure your account and verify your identity.</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                    <CheckCircle2 size={16} className={emailOk ? "text-[#5AA700]" : "text-[#D4D4D4]"} />
                    Email
                  </div>
                  <p className="mt-0.5 truncate pl-6 text-[11px] text-[#A3A3A3]">{form.email}</p>
                </div>
                {emailOk ? (
                  <span className="rounded-full bg-[#EEF9E0] px-2 py-0.5 text-[11px] font-bold text-[#3D6600]">
                    Verified
                  </span>
                ) : (
                  <UserButton
                    loading={busy === "send_email"}
                    onClick={() => void runVerification("send_email")}
                    className="h-8 rounded-lg bg-[#B6FF38] px-3 text-xs font-bold text-[#102000]"
                  >
                    Verify
                  </UserButton>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                    <CheckCircle2 size={16} className={phoneOk ? "text-[#5AA700]" : "text-[#D4D4D4]"} />
                    Phone
                  </div>
                  <p className="mt-0.5 truncate pl-6 text-[11px] text-[#A3A3A3]">
                    {form.phone || "Add a phone number in Profile Information"}
                  </p>
                </div>
                {phoneOk ? (
                  <span className="rounded-full bg-[#EEF9E0] px-2 py-0.5 text-[11px] font-bold text-[#3D6600]">
                    Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={scrollToPhone}
                    className="h-8 rounded-lg border border-[#ECECEC] bg-white px-3 text-xs font-bold text-[#111111] hover:bg-white"
                  >
                    Verify
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                  <Lock size={16} className="text-[#737373]" />
                  Password
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordOpen(true)}
                  className="text-xs font-bold text-[#5AA700] hover:underline"
                >
                  Change
                </button>
              </div>

              <div id="settings-2fa" className="rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                      <Shield size={16} className="text-[#737373]" />
                      Two-Factor Auth
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#A3A3A3]">Extra login protection via email codes</p>
                  </div>
                  {twoOk ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#EEF9E0] px-2 py-0.5 text-[11px] font-bold text-[#3D6600]">
                        Enabled
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTwoFactorOpen((v) => !v);
                          setTwoFactorStep("idle");
                        }}
                        className="text-xs font-bold text-[#737373] hover:underline"
                      >
                        {twoFactorOpen ? "Hide" : "Manage"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        Not Enabled
                      </span>
                      <button
                        type="button"
                        onClick={openTwoFactor}
                        className="inline-flex h-8 items-center rounded-lg bg-[#B6FF38] px-3 text-xs font-bold text-[#102000]"
                      >
                        Enable
                      </button>
                    </div>
                  )}
                </div>

                {twoFactorOpen ? (
                  <div className="mt-3 space-y-2 border-t border-[#E8E8E8] pt-3">
                    <UserField label={twoOk ? "Confirm password to disable" : "Confirm password"}>
                      <UserInput
                        type="password"
                        value={twoFactorPassword}
                        onChange={(e) => setTwoFactorPassword(e.target.value)}
                      />
                    </UserField>
                    {!twoOk && twoFactorStep === "verify" ? (
                      <UserField label="Verification code">
                        <UserInput
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          placeholder="6-digit code"
                        />
                      </UserField>
                    ) : null}
                    {twoOk ? (
                      <UserButton
                        loading={busy === "2fa_disable"}
                        onClick={() => void disable2fa()}
                        className="h-9 rounded-lg border border-[#ECECEC] bg-white px-3 text-xs font-bold text-[#111111]"
                      >
                        Disable 2FA
                      </UserButton>
                    ) : (
                      <UserButton
                        loading={busy === "2fa_request" || busy === "2fa_confirm"}
                        onClick={() =>
                          void (twoFactorStep === "verify" ? confirmEnable2fa() : requestEnable2fa())
                        }
                        className="h-9 rounded-lg bg-[#B6FF38] px-3 text-xs font-bold text-[#102000]"
                      >
                        {twoFactorStep === "verify" ? "Verify and enable" : "Enable 2FA"}
                      </UserButton>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section
        id="settings-domains"
        className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
      >
        <h3 className="text-sm font-bold text-[#111111]">Custom Domains</h3>
        <p className="mt-0.5 text-xs text-[#737373]">
          Connect a branded domain for your public AR experiences.
        </p>
        <div className="mt-4">
          <DomainsTab enabled={allowCustomDomain} showToast={showToast} />
        </div>
      </section>
    </div>
  );
}
