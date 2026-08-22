"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { Headphones, Save } from "lucide-react";
import SettingsProfileView, { type SettingsFormState } from "./SettingsProfileView";
import ContactSettingsPanel from "./ContactSettingsPanel";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import { useUserPanelToast } from "@/components/user-panel/UserPanelToastContext";
import { getPlanDisplayName } from "@/lib/billing/plans";

type SettingsForm = SettingsFormState;

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

const AVATAR_KEY_PREFIX = "ar360_settings_avatar_";

const defaultForm: SettingsForm = {
  fullName: "",
  email: "",
  photo: "",
  companyName: "",
  phone: "",
  country: "India",
  gst: "",
  website: "",
  address: "",
  city: "",
  zip: "",
  state: "",
  timezone: "Asia/Kolkata",
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function planDisplayName(planId?: string, name?: string) {
  return getPlanDisplayName(planId, name);
}

export default function SettingsClient() {
  const { showToast } = useUserPanelToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<CustomerBootstrap | null>(null);
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [baseline, setBaseline] = useState<SettingsForm>(defaultForm);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [domainConnected, setDomainConnected] = useState(false);

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

      try {
        const domainsRes = await fetch("/api/enterprise/domains", { cache: "no-store" });
        if (domainsRes.ok) {
          const body = await domainsRes.json();
          const list = Array.isArray(body.domains) ? body.domains : [];
          setDomainConnected(
            list.some(
              (d: { status?: string; verified?: boolean; verifiedAt?: string | null }) =>
                Boolean(d.verified) ||
                Boolean(d.verifiedAt) ||
                d.status === "active" ||
                d.status === "verified",
            ),
          );
        }
      } catch {
        setDomainConnected(false);
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

      let timezone = "Asia/Kolkata";
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
      } catch {
        // keep default
      }

      const nextForm: SettingsForm = {
        fullName: profile.billing_name || bootstrap?.name || "",
        email: profile.billing_email || bootstrap?.email || "",
        photo,
        companyName: company.company_name || "",
        phone: company.billing_phone || profile.billing_phone || "",
        country: company.country || "India",
        gst: "",
        website: company.website || "",
        address: company.address_line1 || "",
        city: company.city || "",
        zip: company.postal_code || "",
        state: company.state || "",
        timezone,
      };
      setForm(nextForm);
      setBaseline(nextForm);
      setLastSavedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

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

  async function saveAccountAndCompany() {
    setSaving(true);
    try {
      const [profileRes, companyRes] = await Promise.all([
        fetch("/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            phone: form.phone,
            profileImageUrl: form.photo || null,
          }),
        }),
        fetch("/api/account/company", {
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
            website: form.website || null,
          }),
        }),
      ]);
      if (!profileRes.ok || !companyRes.ok) throw new Error("Save failed");
      showToast("Account details saved");
      setBaseline(form);
      setLastSavedAt(new Date());
      await load();
    } catch {
      showToast("Could not save account details");
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const plan = entitlement?.plan;
  const usage = entitlement?.usage;
  const planName = planDisplayName(customer?.plan || plan?.planId, customer?.planName || plan?.name);
  const renewalDate = usage?.currentPeriodEnd || usage?.trialEndsAt;
  const subStatus = usage?.subscriptionStatus || "trialing";
  const isTrial = (plan?.planId || customer?.plan || "trial") === "trial";
  const paymentAdded = subStatus === "active" || subStatus === "paused";
  const lastSavedLabel = lastSavedAt
    ? `Last saved: ${Math.max(0, Math.round((Date.now() - lastSavedAt.getTime()) / 60000))} min ago`
    : null;

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="Settings"
        subtitle="Manage your account, security, and preferences."
        actions={
          <>
            <Link
              href="/dashboard/support"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <Headphones size={16} />
              Help
            </Link>
            <UserButton
              disabled={!dirty || saving}
              onClick={() => setForm(baseline)}
              className="h-11 rounded-2xl border border-[#ECECEC] bg-white px-4 font-semibold text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-50"
            >
              Discard Changes
            </UserButton>
            <UserButton
              disabled={saving || !dirty}
              icon={<Save size={16} />}
              onClick={() => void saveAccountAndCompany()}
              className="h-11 rounded-2xl bg-[#B6FF38] px-5 font-semibold text-[#102000] shadow-sm hover:bg-[#A8F030] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </UserButton>
          </>
        }
      />
      {lastSavedLabel ? (
        <p className="-mt-1 text-right text-[11px] font-medium text-[#A3A3A3]">{lastSavedLabel}</p>
      ) : null}

      <section className="min-w-0">
        {loading ? (
          <UserWorkspaceLoading
            className="rounded-[16px] border border-[#ECECEC]"
            label="Loading Settings"
            hint="Please wait while we load your settings..."
          />
        ) : (
          <>
            <SettingsProfileView
              form={form}
              updateField={updateField}
              uploadPhoto={uploadPhoto}
              showToast={showToast}
              planName={planName}
              renewalDate={fmtDate(renewalDate)}
              subStatus={subStatus}
              isTrial={isTrial}
              domainConnected={domainConnected}
              paymentAdded={paymentAdded}
              allowCustomDomain={Boolean(plan?.allowCustomDomain)}
            />
            <ContactSettingsPanel showToast={showToast} />
          </>
        )}
      </section>
    </UserPanelPageShell>
  );
}
