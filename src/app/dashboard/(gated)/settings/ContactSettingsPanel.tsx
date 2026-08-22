"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { Save } from "lucide-react";
import Link from "next/link";
import UserButton from "@/components/user-panel/UserButton";
import { UserField, UserInput } from "@/components/user-panel/UserInput";
import { useUserPanelSession } from "@/components/user-panel/UserPanelContext";
import type { WorkspaceContactSettings } from "@/lib/viewer-contact/types";
import { DEFAULT_CONTACT_SETTINGS } from "@/lib/viewer-contact/types";

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
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E4E8DF] bg-[#FBFFF5] px-3.5 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#111111]">{label}</span>
        <span className="mt-0.5 block text-xs font-medium text-[#737373]">{description}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full ${checked ? "bg-[#84D400]" : "bg-[#D8DED0]"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export default function ContactSettingsPanel({ showToast }: { showToast: (message: string) => void }) {
  const session = useUserPanelSession();
  const allowed = session?.features?.allowProductContact === true;
  const [settings, setSettings] = useState<WorkspaceContactSettings>(DEFAULT_CONTACT_SETTINGS);
  const [workspaceUid, setWorkspaceUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/contact-settings", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setWorkspaceUid(data.workspaceUid || "");
        setSettings({ ...DEFAULT_CONTACT_SETTINGS, ...(data.settings || {}) });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    if (!allowed) return;
    void load();
  }, [load, allowed]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/contact-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceUid, ...settings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(String(data.error || "Could not save contact settings"));
        return;
      }
      setSettings({ ...DEFAULT_CONTACT_SETTINGS, ...(data.settings || {}) });
      showToast("Contact settings saved");
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <section className="dash-premium-card mt-4 p-5 text-sm font-medium text-[#737373]">
        Loading contact settings…
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="dash-premium-card mt-4 p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-[#111111]">Customer Contact Settings</h2>
        <p className="mt-2 text-sm font-medium text-[#737373]">
          Enquire and WhatsApp are included on Trial, Business, and Enterprise plans.
        </p>
        <Link
          href="/dashboard/subscription"
          className="mt-4 inline-flex h-10 items-center rounded-2xl bg-[#B6FF38] px-4 text-sm font-semibold text-[#102000]"
        >
          Upgrade plan
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="dash-premium-card mt-4 p-5 text-sm font-medium text-[#737373]">
        Loading contact settings…
      </section>
    );
  }

  return (
    <section className="dash-premium-card mt-4 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111111]">Customer Contact Settings</h2>
          <p className="mt-1 text-xs font-medium text-[#737373]">
            Enquire and WhatsApp on the public viewer. Existing Buy / Quote CTAs stay as they are.
          </p>
        </div>
        <UserButton
          loading={saving}
          icon={<Save size={16} />}
          onClick={() => void save()}
          className="h-10 rounded-2xl bg-[#B6FF38] px-4 font-semibold text-[#102000]"
        >
          Save
        </UserButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Switch
          label="Enable Enquire"
          description="Show an enquiry form on the product viewer"
          checked={settings.enquireEnabled}
          onChange={(value) => setSettings((prev) => ({ ...prev, enquireEnabled: value }))}
        />
        <Switch
          label="Enable WhatsApp"
          description="Show WhatsApp with a prefilled product message"
          checked={settings.whatsappEnabled}
          onChange={(value) => setSettings((prev) => ({ ...prev, whatsappEnabled: value }))}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <UserField label="WhatsApp number">
          <UserInput
            value={settings.whatsappNumber}
            placeholder="+91XXXXXXXXXX"
            onChange={(event) => setSettings((prev) => ({ ...prev, whatsappNumber: event.target.value }))}
          />
        </UserField>
        <UserField label="Enquire button label">
          <UserInput
            value={settings.enquireLabel}
            maxLength={40}
            onChange={(event) => setSettings((prev) => ({ ...prev, enquireLabel: event.target.value }))}
          />
        </UserField>
        <UserField label="WhatsApp button label">
          <UserInput
            value={settings.whatsappLabel}
            maxLength={40}
            onChange={(event) => setSettings((prev) => ({ ...prev, whatsappLabel: event.target.value }))}
          />
        </UserField>
      </div>
    </section>
  );
}
