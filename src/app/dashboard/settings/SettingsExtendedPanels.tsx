"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Globe, LogOut, Star, Trash2 } from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import { UserField, UserInput } from "@/components/user-panel/UserInput";
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
    <section className="space-y-4 rounded-2xl border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_24px_rgba(28,38,18,0.04)] sm:p-5">
      <div>
        <h3 className="text-[15px] font-semibold text-[#111111]">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-[#737373]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SecurityTab({ showToast }: { showToast: (msg: string) => void }) {
  const [sessions, setSessions] = useState<
    Array<{ sessionUid: string; device: string; browser: string; country: string; ipMasked: string; lastActiveAt: string; isCurrent: boolean }>
  >([]);
  const [loginLogs, setLoginLogs] = useState<
    Array<{ status: string; device: string; browser: string; ipMasked: string; createdAt: string }>
  >([]);
  const [activityLogs, setActivityLogs] = useState<
    Array<{ eventType: string; title: string; detail: string; createdAt: string }>
  >([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState<"idle" | "verify">("idle");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, logsRes, tfaRes, actRes] = await Promise.all([
        fetch("/api/account/sessions"),
        fetch("/api/account/login-logs?pageSize=8"),
        fetch("/api/account/two-factor"),
        fetch("/api/account/activity?pageSize=8"),
      ]);
      if (sessRes.ok) {
        const data = await sessRes.json();
        setSessions(data.sessions || []);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLoginLogs(data.items || []);
      }
      if (tfaRes.ok) {
        const data = await tfaRes.json();
        setTwoFactorEnabled(Boolean(data.enabled));
      }
      if (actRes.ok) {
        const data = await actRes.json();
        setActivityLogs(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeSession(sessionUid: string) {
    const res = await fetch("/api/account/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionUid }),
    });
    const data = await res.json();
    if (data.loggedOut) {
      window.location.assign("/login");
      return;
    }
    if (res.ok) {
      showToast("Session revoked");
      void load();
    } else {
      showToast(data.error || "Could not revoke session");
    }
  }

  async function revokeAllOther() {
    const res = await fetch("/api/account/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_all_other" }),
    });
    if (res.ok) {
      showToast("Logged out all other devices");
      void load();
    }
  }

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

  if (loading) return <p className="py-10 text-center text-sm text-[#737373]">Loading security settings…</p>;

  return (
    <div className="space-y-5">
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

      <Panel title="Active sessions" subtitle="Devices currently signed in to your account.">
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.sessionUid} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ECECEC] px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-[#111111]">
                  {s.browser} · {s.device} {s.isCurrent ? <span className="text-[#5F8F00]">(This device)</span> : null}
                </p>
                <p className="text-xs text-[#737373]">
                  {s.country} · IP {s.ipMasked} · Last active {new Date(s.lastActiveAt).toLocaleString()}
                </p>
              </div>
              {!s.isCurrent ? (
                <button type="button" className="text-xs font-semibold text-red-600" onClick={() => void revokeSession(s.sessionUid)}>
                  Log out
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <UserButton
          icon={<LogOut size={14} />}
          variant="outline"
          className="mt-3 h-10 rounded-xl px-4 text-sm font-semibold"
          onClick={() => void revokeAllOther()}
        >
          Log out all other devices
        </UserButton>
      </Panel>

      <Panel title="Login history" subtitle="Recent sign-in attempts on your account.">
        <div className="overflow-hidden rounded-xl border border-[#ECECEC]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAFAFA] text-xs font-semibold uppercase text-[#737373]">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Device</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loginLogs.map((log, i) => (
                <tr key={i} className="border-t border-[#ECECEC]">
                  <td className="px-4 py-2 text-[#525252]">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{log.browser} / {log.device}</td>
                  <td className="px-4 py-2 capitalize">{log.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Account activity" subtitle="Recent actions on your account.">
        <div className="space-y-2">
          {activityLogs.length === 0 ? (
            <p className="text-sm text-[#737373]">No recent activity.</p>
          ) : (
            activityLogs.map((log, i) => (
              <div key={i} className="rounded-xl border border-[#ECECEC] px-4 py-3 text-sm">
                <p className="font-semibold text-[#111111]">{log.title}</p>
                {log.detail ? <p className="mt-0.5 text-xs text-[#737373]">{log.detail}</p> : null}
                <p className="mt-1 text-xs text-[#A3A3A3]">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
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

  if (!prefs) return <p className="py-10 text-center text-sm text-[#737373]">Loading preferences…</p>;

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#111111]">Notification preferences</h3>
          <p className="mt-1 text-sm text-[#737373]">Choose where you want to receive each type of update.</p>
        </div>
        <UserButton
          loading={saving}
          className="h-10 rounded-xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] hover:bg-[#78C400]"
          onClick={() => void save()}
        >
          Save preferences
        </UserButton>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {rows.map((row) => (
          <section
            key={row.key}
            className="rounded-2xl border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_24px_rgba(28,38,18,0.035)] transition hover:-translate-y-px hover:border-[#CFE3A5] hover:shadow-[0_12px_30px_rgba(28,38,18,0.07)]"
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
  const { workspaceUid, workspaces, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const workspace = workspaces.find((item) => item.workspace_uid === workspaceUid);
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

  useEffect(() => {
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
          <a
            href="/dashboard/subscription#available-plans"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#B8FF3C] px-4 text-sm font-bold text-[#111111]"
          >
            View eligible plans
          </a>
        </div>
      </Panel>
    );
  }

  if (workspaceLoading || loading) {
    return <div className="py-12 text-center text-sm text-[#737373]">Loading custom domains…</div>;
  }

  if (workspaceError || !workspaceUid) {
    return (
      <Panel title="Custom domains">
        <p className="text-sm text-red-600">{workspaceError || "No workspace is available for this account."}</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
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
