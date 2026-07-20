"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  Camera,
  Eye,
  EyeOff,
  Globe,
  Headphones,
  Save,
  Shield,
  Upload,
  User,
} from "lucide-react";
import {
  DomainsTab,
  NotificationsTab,
  SecurityTab,
} from "./SettingsExtendedPanels";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import { UserField, UserInput } from "@/components/user-panel/UserInput";
import StatusBadge from "@/components/user-panel/StatusBadge";

type SettingsTab =
  | "profile"
  | "company"
  | "security"
  | "notifications"
  | "domains";

type SettingsForm = {
  fullName: string;
  email: string;
  photo: string;
  companyName: string;
  phone: string;
  country: string;
  gst: string;
  address: string;
  city: string;
  zip: string;
  state: string;
};

type CustomerBootstrap = {
  name: string;
  email: string;
  plan: string;
  planName: string;
  customerUid: string;
};

type EntitlementSnapshot = {
  plan?: {
    planId: string;
    name: string;
    products: number;
    storageMb: number;
    bandwidthGb: number;
    allowCustomDomain?: boolean;
    priceMonthlyInr?: number | null;
    priceYearlyInr?: number | null;
  };
  usage?: {
    productsUsed: number;
    storageUsedGb: number;
    bandwidthUsedGb: number;
    subscriptionStatus: string;
    trialEndsAt?: string | null;
    currentPeriodEnd?: string | null;
  };
  entitlement?: { allowed: boolean; reason?: string; upgradeRequired?: boolean };
};

const TABS: { key: SettingsTab; label: string; icon: LucideIcon }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "company", label: "Company", icon: Building2 },
  { key: "security", label: "Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "domains", label: "Domains", icon: Globe },
];

const AVATAR_KEY_PREFIX = "ar360_settings_avatar_";

const defaultForm: SettingsForm = {
  fullName: "",
  email: "",
  photo: "",
  companyName: "",
  phone: "",
  country: "India",
  gst: "",
  address: "",
  city: "",
  zip: "",
  state: "",
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function planDisplayName(planId?: string, name?: string) {
  if (name) return name;
  if (!planId) return "Trial";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

export default function SettingsClient() {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [customer, setCustomer] = useState<CustomerBootstrap | null>(null);
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bootstrapRes, profileRes, companyRes, entitlementRes] = await Promise.all([
        fetch("/api/customer/bootstrap", { cache: "no-store" }),
        fetch("/api/account/profile", { cache: "no-store" }),
        fetch("/api/account/company", { cache: "no-store" }),
        fetch("/api/billing/entitlement?action=upload", { cache: "no-store" }),
      ]);

      let bootstrap: CustomerBootstrap | null = null;
      if (bootstrapRes.ok) {
        const body = await bootstrapRes.json();
        bootstrap = body.customer || null;
        setCustomer(bootstrap);
      }

      let profile: Record<string, string | null | undefined> = {};
      if (profileRes.ok) {
        const body = await profileRes.json();
        const p = body.profile || {};
        profile = {
          billing_name: p.fullName,
          billing_email: p.email,
          billing_phone: p.phone,
          profile_image_url: p.profileImageUrl,
        };
      }

      let company: Record<string, string | null | undefined> = {};
      if (companyRes.ok) {
        const body = await companyRes.json();
        const c = body.company || {};
        company = {
          company_name: c.companyName,
          business_type: c.businessType,
          website: c.website,
          billing_phone: c.phone,
          address_line1: c.address,
          country: c.country,
          state: c.state,
          city: c.city,
          postal_code: c.postalCode,
        };
      }

      if (entitlementRes.ok) {
        setEntitlement(await entitlementRes.json());
      }

      const uid = bootstrap?.customerUid || "guest";
      const photo =
        (profile.profile_image_url as string) ||
        (() => {
          try {
            return localStorage.getItem(`${AVATAR_KEY_PREFIX}${uid}`) || "";
          } catch {
            return "";
          }
        })();

      setForm({
        fullName: profile.billing_name || bootstrap?.name || "",
        email: profile.billing_email || bootstrap?.email || "",
        photo,
        companyName: company.company_name || "",
        phone: company.billing_phone || profile.billing_phone || "",
        country: company.country || "India",
        gst: "",
        address: company.address_line1 || "",
        city: company.city || "",
        zip: company.postal_code || "",
        state: company.state || "",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested === "company" || requested === "profile" || requested === "account") {
      setTab(requested === "account" ? "profile" : (requested as SettingsTab));
    } else if (
      requested === "security" ||
      requested === "notifications" ||
      requested === "domains"
    ) {
      setTab(requested);
    }
  }, []);

  function updateField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function uploadPhoto(file?: File) {
    if (!file || !customer?.customerUid) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photo = String(reader.result || "");
      updateField("photo", photo);
      try {
        localStorage.setItem(`${AVATAR_KEY_PREFIX}${customer.customerUid}`, photo);
      } catch {
        // ignore quota errors
      }
      showToast("Profile photo updated");
    };
    reader.readAsDataURL(file);
  }

  async function saveAccount() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          profileImageUrl: form.photo || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("Profile saved");
      await load();
    } catch {
      showToast("Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function saveCompany() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          phone: form.phone,
          country: form.country,
          address: form.address,
          city: form.city,
          postalCode: form.zip,
          state: form.state,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("Company details saved");
    } catch {
      showToast("Could not save company details");
    } finally {
      setSaving(false);
    }
  }

  const plan = entitlement?.plan;
  const usage = entitlement?.usage;
  const planName = planDisplayName(plan?.planId || customer?.plan, plan?.name || customer?.planName);
  const renewalDate = usage?.currentPeriodEnd || usage?.trialEndsAt;
  const subStatus = usage?.subscriptionStatus || "trialing";
  const isTrial = (plan?.planId || customer?.plan || "trial") === "trial";



  return (
    <>
      <UserPageHeader
        title="Settings"
        subtitle="Manage your profile, company, security, and notifications."
        actions={
          <>
            <Link
              href="/dashboard/support"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <Headphones size={16} />
              Help
            </Link>
            {(tab === "profile" || tab === "company") && (
              <UserButton
                disabled={saving}
                icon={<Save size={16} />}
                onClick={() => void (tab === "profile" ? saveAccount() : saveCompany())}
                className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] shadow-sm hover:bg-[#78C400] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Changes"}
              </UserButton>
            )}
          </>
        }
      />

      {toast ? (
        <div className="rounded-[20px] border border-[#C8E6A0] bg-[#EEF9E0] px-5 py-3 text-sm font-medium text-[#3D6600]">
          {toast}
        </div>
      ) : null}



      <section className="rounded-[22px] border border-[#E4E8DF] bg-[linear-gradient(120deg,#FFFFFF_0%,#FBFFF5_100%)] p-5 shadow-[0_12px_34px_rgba(28,38,18,0.06)]">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar photo={form.photo} name={form.fullName || customer?.name || "User"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-[#111111]">{form.fullName || customer?.name || "Customer"}</p>
            <p className="truncate text-sm text-[#737373]">{form.email || customer?.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              label={planName}
              tone={subStatus === "active" ? "success" : subStatus === "expired" ? "danger" : "info"}
            />
            <div className="text-right text-xs text-[#737373]">
              <p className="font-semibold text-[#525252]">{isTrial ? "Trial ends" : "Renews"}</p>
              <p>{fmtDate(renewalDate)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#E4E8DF] bg-white shadow-[0_18px_50px_rgba(28,38,18,0.07)]">
        <div className="flex flex-wrap border-b border-[#E4E7E9] bg-white px-2 pt-1">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`group relative flex items-center gap-2 px-4 py-3.5 text-[13px] font-semibold transition-colors ${
                  active ? "text-[#5F8F00]" : "text-[#737373] hover:text-[#5F8F00]"
                }`}
              >
                <item.icon size={15} />
                {item.label}
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400] transition-opacity ${
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFB_100%)] p-4 sm:p-5 md:p-6">
          {loading ? (
            <div className="py-16 text-center text-sm font-medium text-[#737373]">Loading settings…</div>
          ) : tab === "profile" ? (
            <AccountTab form={form} updateField={updateField} uploadPhoto={uploadPhoto} />
          ) : tab === "company" ? (
            <CompanyTab form={form} updateField={updateField} />
          ) : tab === "security" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_24px_rgba(28,38,18,0.04)] sm:p-5">
                <SecurityPasswordForm />
              </div>
              <SecurityTab showToast={showToast} />
            </div>
          ) : tab === "notifications" ? (
            <NotificationsTab showToast={showToast} />
          ) : tab === "domains" ? (
            <DomainsTab
              enabled={Boolean(plan?.allowCustomDomain)}
              showToast={showToast}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}

function AccountTab({
  form,
  updateField,
  uploadPhoto,
}: {
  form: SettingsForm;
  updateField: <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => void;
  uploadPhoto: (file?: File) => void;
}) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
        <Panel title="Profile information" subtitle="Your name and login email used across ARStudio360.">
          <div className="grid gap-4 md:grid-cols-2">
            <UserField label="Full name">
              <UserInput value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
            </UserField>
            <UserField label="Email address" hint="Contact support to change login email.">
              <UserInput value={form.email} disabled onChange={(e) => updateField("email", e.target.value)} />
            </UserField>
          </div>
          <p className="up-hint mt-2 text-xs">Time zone is detected automatically from your browser.</p>
        </Panel>

        <div className="h-px bg-[#ECECEC]" />
      </div>

      <Panel title="Profile photo" subtitle="JPG, PNG or GIF. Max 2MB recommended.">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar photo={form.photo} name={form.fullName} size="lg" />
            <label className="absolute bottom-0 right-0 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[#ECECEC] bg-white shadow-sm">
              <Camera size={16} />
              <input type="file" accept="image/*" hidden onChange={(e) => uploadPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <label className="mt-5 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-5 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]">
            <Upload size={16} />
            Upload photo
            <input type="file" accept="image/*" hidden onChange={(e) => uploadPhoto(e.target.files?.[0])} />
          </label>
        </div>
      </Panel>
    </div>
  );
}

function SecurityPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validation = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

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
      } else {
        setSuccess("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title="Security" subtitle="Update your account password.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800 font-medium">
            {success}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </UserField>
        </div>

        {newPassword && (
          <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-1 text-xs transition">
            <p className="font-semibold text-slate-600 mb-1.5">New password must contain:</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className={`flex items-center gap-1.5 ${validation.length ? "text-green-600 font-medium" : "text-slate-400"}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${validation.length ? "bg-green-600" : "bg-slate-300"}`} />
                Min 8 chars
              </div>
              <div className={`flex items-center gap-1.5 ${validation.uppercase ? "text-green-600 font-medium" : "text-slate-400"}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${validation.uppercase ? "bg-green-600" : "bg-slate-300"}`} />
                1 uppercase
              </div>
              <div className={`flex items-center gap-1.5 ${validation.lowercase ? "text-green-600 font-medium" : "text-slate-400"}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${validation.lowercase ? "bg-green-600" : "bg-slate-300"}`} />
                1 lowercase
              </div>
              <div className={`flex items-center gap-1.5 ${validation.number ? "text-green-600 font-medium" : "text-slate-400"}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${validation.number ? "bg-green-600" : "bg-slate-300"}`} />
                1 number
              </div>
              <div className={`flex items-center gap-1.5 ${validation.special ? "text-green-600 font-medium" : "text-slate-400"}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${validation.special ? "bg-green-600" : "bg-slate-300"}`} />
                1 special char
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#84D400] px-6 text-sm font-semibold text-[#102000] hover:bg-[#78C400] disabled:opacity-60 transition"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function CompanyTab({
  form,
  updateField,
}: {
  form: SettingsForm;
  updateField: <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => void;
}) {
  return (
    <Panel title="Company & billing details" subtitle="Used on GST invoices and payment receipts.">
      <div className="grid gap-4 md:grid-cols-2">
        <UserField label="Company name">
          <UserInput value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} />
        </UserField>
        <UserField label="Telephone">
          <UserInput value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
        </UserField>
        <UserField label="Country">
          <UserInput value={form.country} onChange={(e) => updateField("country", e.target.value)} />
        </UserField>
        <UserField label="GST / VAT ID">
          <UserInput value={form.gst} onChange={(e) => updateField("gst", e.target.value)} />
        </UserField>
        <UserField label="Address" className="md:col-span-2">
          <UserInput value={form.address} onChange={(e) => updateField("address", e.target.value)} />
        </UserField>
        <UserField label="City">
          <UserInput value={form.city} onChange={(e) => updateField("city", e.target.value)} />
        </UserField>
        <UserField label="State / Province">
          <UserInput value={form.state} onChange={(e) => updateField("state", e.target.value)} />
        </UserField>
        <UserField label="CAP / ZIP">
          <UserInput value={form.zip} onChange={(e) => updateField("zip", e.target.value)} />
        </UserField>
      </div>
    </Panel>
  );
}



function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="p-1">
      <h3 className="text-base font-bold text-[#111111]">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-[#737373]">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Avatar({ photo, name, size = "md" }: { photo?: string; name: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-28 w-28 text-3xl" : "h-14 w-14 text-lg";
  if (photo) {
    return <img src={photo} alt={name} className={`${cls} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div className={`${cls} grid shrink-0 place-items-center rounded-full bg-[#EEF9E0] font-bold text-[#3D6600]`}>
      {(name || "U").charAt(0).toUpperCase()}
    </div>
  );
}
