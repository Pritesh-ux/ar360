"use client";

import { useEffect, useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import Link from "next/link";
import { CheckCircle2, Globe, Star, Trash2 } from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import { UserField, UserInput } from "@/components/user-panel/UserInput";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import { useWorkspace } from "@/lib/enterprise/useWorkspace";

type DomainRow = {
  id: number;
  domain: string;
  verification_token: string;
  status: "pending" | "verified" | "failed";
  ssl_status: "none" | "pending" | "active";
  is_primary: 0 | 1 | boolean;
  last_error: string | null;
  verified_at: string | null;
};

type DomainInstructions = {
  domain: string;
  txtHost: string;
  txtValue: string;
  cnameHost: string;
  cnameTarget: string;
  sslNote: string;
};

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-[#ECECEC] bg-[#FAFAFA] p-4">
      <div>
        <h3 className="text-sm font-semibold text-[#111111]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SecurityTab({ showToast }: { showToast: (msg: string) => void }) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState<"idle" | "verify">("idle");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tfaRes = await fetch("/api/account/two-factor");
      if (tfaRes.ok) {
        const data = await tfaRes.json();
        setTwoFactorEnabled(Boolean(data.enabled));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function requestEnable2fa() {
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
  }

  async function confirmEnable2fa() {
    const res = await fetch("/api/account/two-factor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable_confirm", code: twoFactorCode }),
    });
    if (res.ok) {
      setTwoFactorEnabled(true);
      setTwoFactorStep("idle");
      setTwoFactorPassword("");
      setTwoFactorCode("");
      showToast("Two-factor authentication enabled");
    } else {
      const data = await res.json();
      showToast(data.error || "Invalid code");
    }
  }

  async function disable2fa() {
    const res = await fetch("/api/account/two-factor", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: twoFactorPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setTwoFactorEnabled(false);
      setTwoFactorPassword("");
      showToast("Two-factor authentication disabled");
    } else {
      showToast(data.error || "Could not disable 2FA");
    }
  }

  if (loading) {
    return (
      <UserWorkspaceLoading
        className="min-h-[220px]"
        label="Loading Security"
        hint="Please wait while we load security settings..."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Panel title="Two-factor authentication" subtitle="Extra verification on login using email codes.">
        <p className="text-sm text-[#525252]">
          Status: <strong>{twoFactorEnabled ? "Enabled" : "Disabled"}</strong>
        </p>
        {!twoFactorEnabled ? (
          <div className="grid gap-3 md:max-w-md">
            <UserField label="Confirm password">
              <UserInput type="password" value={twoFactorPassword} onChange={(e) => setTwoFactorPassword(e.target.value)} />
            </UserField>
            {twoFactorStep === "verify" ? (
              <UserField label="Verification code">
                <UserInput value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="6-digit code" />
              </UserField>
            ) : null}
            <UserButton
              className="h-10 w-fit rounded-xl bg-[#84D400] px-4 text-sm font-semibold text-[#102000] hover:bg-[#78C400]"
              onClick={() => void (twoFactorStep === "verify" ? confirmEnable2fa() : requestEnable2fa())}
            >
              {twoFactorStep === "verify" ? "Verify and enable" : "Enable 2FA"}
            </UserButton>
          </div>
        ) : (
          <div className="grid gap-3 md:max-w-md">
            <UserField label="Confirm password to disable">
              <UserInput type="password" value={twoFactorPassword} onChange={(e) => setTwoFactorPassword(e.target.value)} />
            </UserField>
            <UserButton variant="outline" className="h-10 w-fit rounded-xl px-4 text-sm font-semibold" onClick={() => void disable2fa()}>
              Disable 2FA
            </UserButton>
          </div>
        )}
      </Panel>
    </div>
  );
}

type Prefs = {
  product: { inApp: boolean; email: boolean };
  billing: { inApp: boolean; email: boolean };
  subscription: { inApp: boolean; email: boolean };
  usage: { inApp: boolean; email: boolean };
  support: { inApp: boolean; email: boolean };
  security: { inApp: boolean; email: boolean };
  marketing: { inApp: boolean; email: boolean };
};

function ChannelToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`flex min-w-[112px] items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
        disabled
          ? "cursor-not-allowed border-[#ECECEC] bg-[#F5F6F3] opacity-70"
          : "cursor-pointer border-[#E4E7E9] bg-white transition hover:border-[#BBD979] hover:bg-[#FBFFF5]"
      }`}
    >
      <span className="text-xs font-semibold text-[#525252]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#84D400]"
      />
    </label>
  );
}

export function NotificationsTab({ showToast }: { showToast: (msg: string) => void }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/account/notification-preferences")
      .then((r) => r.json())
      .then((d) => setPrefs(d.preferences || null))
      .catch(() => {});
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch("/api/account/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (!res.ok) throw new Error();
      showToast("Notification preferences saved");
    } catch {
      showToast("Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return (
      <UserWorkspaceLoading
        className="min-h-[220px]"
        label="Loading Preferences"
        hint="Please wait while we load your preferences..."
      />
    );
  }

  const rows: Array<{ key: keyof Prefs; label: string; desc: string; locked?: boolean }> = [
    { key: "product", label: "Product notifications", desc: "Publish status, QR ready, processing updates." },
    { key: "billing", label: "Billing notifications", desc: "Invoices and payment confirmations." },
    { key: "subscription", label: "Subscription notifications", desc: "Renewals, cancellations, plan changes." },
    { key: "usage", label: "Usage warnings", desc: "Storage and bandwidth threshold alerts." },
    { key: "support", label: "Support replies", desc: "When our team responds to your tickets." },
    { key: "security", label: "Security alerts", desc: "Password changes, logins, and 2FA events.", locked: true },
    { key: "marketing", label: "Product updates & marketing", desc: "Feature announcements and tips." },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111111]">Notification preferences</h3>
          <p className="mt-0.5 text-xs text-[#737373]">Choose where you want to receive each type of update.</p>
        </div>
        <UserButton
          loading={saving}
          className="dash-premium-btn-primary h-9 px-4 text-xs"
          onClick={() => void save()}
        >
          Save preferences
        </UserButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <section
            key={row.key}
            className="rounded-xl border border-[#ECECEC] bg-[#FAFAFA] p-3.5 transition hover:border-[#CFE3A5]"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111111]">{row.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-[#737373]">{row.desc}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ChannelToggle
                label="In-app"
                checked={prefs[row.key].inApp}
                disabled={row.locked}
                onChange={(value) =>
                  setPrefs((current) =>
                    current ? { ...current, [row.key]: { ...current[row.key], inApp: value } } : current,
                  )
                }
              />
              <ChannelToggle
                label="Email"
                checked={prefs[row.key].email}
                disabled={row.key === "security"}
                onChange={(value) =>
                  setPrefs((current) =>
                    current ? { ...current, [row.key]: { ...current[row.key], email: value } } : current,
                  )
                }
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function statusBadgeClass(status: DomainRow["status"]) {
  if (status === "verified") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export function DomainsTab({
  enabled,
  showToast,
}: {
  enabled: boolean;
  showToast: (msg: string) => void;
}) {
  const { workspaceUid, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [instructionsByDomain, setInstructionsByDomain] = useState<Record<string, DomainInstructions>>({});
  const [domainTarget, setDomainTarget] = useState("domains.ar360.app");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadDomains = useCallback(async () => {
    if (!workspaceUid) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/enterprise/domains?workspaceUid=${encodeURIComponent(workspaceUid)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load domains.");
      const list = (data.domains || []) as DomainRow[];
      setDomains(list);
      setDomainTarget(String(data.domainTarget || "domains.ar360.app"));
      const map: Record<string, DomainInstructions> = {};
      for (const item of (data.instructions || []) as DomainInstructions[]) {
        map[item.domain] = item;
      }
      setInstructionsByDomain(map);
      setExpandedId((current) => current ?? list[0]?.id ?? null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load domains.");
    } finally {
      setLoading(false);
    }
  }, [workspaceUid, showToast]);

  useDeferredEffect(() => {
    if (!enabled || !workspaceUid) {
      setLoading(false);
      return;
    }
    void loadDomains();
  }, [enabled, workspaceUid, loadDomains]);

  async function addDomain() {
    if (!workspaceUid || !domainInput.trim()) return;
    setAdding(true);
    try {
      const response = await fetch("/api/enterprise/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceUid, domain: domainInput.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not add domain.");
      setDomainInput("");
      showToast("Domain added. Configure DNS, then verify.");
      if (data.domain?.id) setExpandedId(data.domain.id);
      await loadDomains();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not add domain.");
    } finally {
      setAdding(false);
    }
  }

  async function verifyDomain(domainId: number) {
    if (!workspaceUid) return;
    setBusyId(domainId);
    try {
      const response = await fetch("/api/enterprise/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceUid, domainId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Verification failed.");
      showToast(data.verified ? "Domain verified." : data.error || "DNS not ready yet.");
      await loadDomains();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function setPrimary(domainId: number) {
    if (!workspaceUid) return;
    setBusyId(domainId);
    try {
      const response = await fetch("/api/enterprise/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceUid, domainId, action: "set_primary" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not set primary domain.");
      showToast("Primary domain updated.");
      await loadDomains();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not set primary domain.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeDomain(domainId: number) {
    if (!workspaceUid) return;
    if (!window.confirm("Remove this custom domain?")) return;
    setBusyId(domainId);
    try {
      const response = await fetch("/api/enterprise/domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceUid, domainId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not remove domain.");
      showToast("Domain removed.");
      await loadDomains();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not remove domain.");
    } finally {
      setBusyId(null);
    }
  }

  if (!enabled) {
    return (
      <Panel title="Custom domains" subtitle="Serve viewer, share, and embed links on your own hostname.">
        <div className="rounded-[18px] border border-[#E4E7E9] bg-[#F8F9F3] p-5">
          <p className="text-sm font-semibold text-[#111111]">Custom domains are not included in this plan.</p>
          <p className="mt-1 text-xs leading-5 text-[#737373]">
            Upgrade to Business or Enterprise to map a verified hostname for public AR surfaces.
          </p>
          <Link
            href="/dashboard/subscription#available-plans"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#B8FF3C] px-4 text-sm font-bold text-[#111111]"
          >
            View eligible plans
          </Link>
        </div>
      </Panel>
    );
  }

  if (workspaceLoading || loading) {
    return (
      <UserWorkspaceLoading
        className="min-h-[220px]"
        label="Loading Domains"
        hint="Please wait while we load custom domains..."
      />
    );
  }

  if (workspaceError || !workspaceUid) {
    return (
      <Panel title="Custom domains">
        <p className="text-sm text-red-600">{workspaceError || "No workspace is available for this account."}</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Custom domains"
        subtitle={`Point a hostname at ${domainTarget}, verify ownership with TXT, then use it for viewer / share / QR / embed URLs.`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <UserField label="Hostname" hint="Example: ar.yourbrand.com">
            <UserInput
              value={domainInput}
              placeholder="ar.yourbrand.com"
              onChange={(event) => setDomainInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addDomain();
              }}
            />
          </UserField>
          <UserButton
            loading={adding}
            icon={<Globe size={16} />}
            onClick={() => void addDomain()}
            className="bg-[#84D400] text-[#102000] hover:bg-[#78C400] sm:mb-0.5"
          >
            Add domain
          </UserButton>
        </div>
      </Panel>

      {domains.length === 0 ? (
        <Panel title="No domains yet">
          <p className="text-sm text-[#737373]">
            Add a domain, create the TXT and CNAME records at your DNS provider, then click Verify.
            HTTPS is terminated on your reverse proxy or CDN — the app does not issue certificates.
          </p>
        </Panel>
      ) : (
        domains.map((row) => {
          const instructions = instructionsByDomain[row.domain];
          const isPrimary = Boolean(row.is_primary);
          const open = expandedId === row.id;
          return (
            <Panel
              key={row.id}
              title={row.domain}
              subtitle={
                isPrimary
                  ? "Primary domain for new share / QR / viewer links"
                  : row.last_error || undefined
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                >
                  {row.status}
                </span>
                <span className="inline-flex items-center rounded-full border border-[#E4E7E9] bg-[#F8F9F3] px-2.5 py-1 text-[11px] font-semibold text-[#737373]">
                  SSL: {row.ssl_status}
                </span>
                {isPrimary ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#D4E8A8] bg-[#F3FAD9] px-2.5 py-1 text-[11px] font-bold text-[#4D6A00]">
                    <Star size={12} /> Primary
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <UserButton
                  variant="outline"
                  loading={busyId === row.id}
                  icon={<CheckCircle2 size={16} />}
                  onClick={() => void verifyDomain(row.id)}
                >
                  Verify DNS
                </UserButton>
                {row.status === "verified" && !isPrimary ? (
                  <UserButton
                    variant="outline"
                    disabled={busyId === row.id}
                    icon={<Star size={16} />}
                    onClick={() => void setPrimary(row.id)}
                  >
                    Set primary
                  </UserButton>
                ) : null}
                <UserButton
                  variant="outline"
                  disabled={busyId === row.id}
                  onClick={() => setExpandedId(open ? null : row.id)}
                >
                  {open ? "Hide DNS" : "Show DNS"}
                </UserButton>
                <UserButton
                  variant="outline"
                  disabled={busyId === row.id}
                  icon={<Trash2 size={16} />}
                  onClick={() => void removeDomain(row.id)}
                  className="text-red-600 hover:border-red-200 hover:bg-red-50"
                >
                  Remove
                </UserButton>
              </div>

              {open && instructions ? (
                <div className="mt-4 space-y-3 rounded-[16px] border border-[#E4E7E9] bg-[#F8F9F3] p-4 text-xs leading-5 text-[#4A4A4A]">
                  <div>
                    <p className="font-bold text-[#111111]">1. TXT verification</p>
                    <p className="mt-1 font-mono text-[11px]">
                      Host: {instructions.txtHost}
                      <br />
                      Value: {instructions.txtValue}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-[#111111]">2. CNAME</p>
                    <p className="mt-1 font-mono text-[11px]">
                      Host: {instructions.cnameHost}
                      <br />
                      Target: {instructions.cnameTarget}
                    </p>
                  </div>
                  <p>{instructions.sslNote}</p>
                </div>
              ) : null}
            </Panel>
          );
        })
      )}
    </div>
  );
}
