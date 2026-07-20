"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, Trash2, ChevronDown, Mail, Shield } from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import { useWorkspace } from "@/lib/enterprise/useWorkspace";

type Member = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  joined_at: string;
};

type Invite = {
  id: number;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  inviter_name: string;
};

const ROLES = ["admin", "editor", "viewer", "billing"];

export default function TeamPage() {
  const { workspaceUid, loading: wsLoading } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [addonBlocked, setAddonBlocked] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const loadMembers = useCallback(async () => {
    if (!workspaceUid) return;
    const res = await fetch(`/api/enterprise/team?workspaceUid=${workspaceUid}`);
    if (res.status === 403) { setAddonBlocked(true); return; }
    if (res.ok) {
      setAddonBlocked(false);
      const d = await res.json() as { members: Member[] };
      setMembers(d.members ?? []);
    }
  }, [workspaceUid]);

  const loadInvites = useCallback(async () => {
    if (!workspaceUid) return;
    const res = await fetch(`/api/enterprise/invites?workspaceUid=${workspaceUid}`);
    if (res.status === 403) { setAddonBlocked(true); return; }
    if (res.ok) {
      const d = await res.json() as { invites: Invite[] };
      setInvites(d.invites ?? []);
    }
  }, [workspaceUid]);

  useEffect(() => {
    if (workspaceUid) { loadMembers(); loadInvites(); }
  }, [workspaceUid, loadMembers, loadInvites]);

  async function sendInvite() {
    if (!inviteEmail.trim() || !workspaceUid) return;
    setBusy(true);
    const res = await fetch("/api/enterprise/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceUid, email: inviteEmail.trim(), role: inviteRole }),
    });
    setBusy(false);
    if (res.ok) { setInviteEmail(""); showToast("Invite sent!"); loadInvites(); }
    else { const d = await res.json() as { error?: string }; showToast(d.error ?? "Failed."); }
  }

  async function removeMember(userId: number) {
    if (!workspaceUid || !confirm("Remove this member?")) return;
    await fetch("/api/enterprise/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceUid, userId }),
    });
    showToast("Member removed.");
    loadMembers();
  }

  async function changeRole(userId: number, role: string) {
    if (!workspaceUid) return;
    await fetch("/api/enterprise/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceUid, userId, role }),
    });
    showToast("Role updated.");
    loadMembers();
  }

  async function revokeInvite(inviteId: number) {
    if (!workspaceUid) return;
    await fetch("/api/enterprise/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceUid, inviteId }),
    });
    showToast("Invite revoked.");
    loadInvites();
  }

  if (wsLoading) return <PageShell><div className="p-8 text-sm opacity-60">Loading workspace…</div></PageShell>;

  if (addonBlocked) {
    return (
      <PageShell>
        <UserPageHeader title="Team" subtitle="Premium Team Management add-on required." />
        <Card>
          <h3 className="text-lg font-black text-[#111111]">Unlock Team Management</h3>
          <p className="mt-2 text-sm opacity-60">
            Invite seats, roles, and member management require the Team Management add-on.
          </p>
          <a
            href="/dashboard/billing/checkout/addons?slug=team-management"
            className="mt-5 inline-flex h-11 items-center rounded-2xl bg-[var(--primary)] px-5 text-sm font-black text-[var(--sidebar)]"
          >
            View add-on pricing
          </a>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {toast && <Toast msg={toast} />}

      <UserPageHeader
        title="Team"
        subtitle="Manage members and invitations."
        actions={
          <>
            {(["members", "invites"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`h-11 rounded-2xl px-5 text-sm font-semibold transition ${
                  tab === t
                    ? "bg-[#EEF9E0] text-[#5FA800] ring-1 ring-[#84D400]/30"
                    : "border border-[#ECECEC] bg-white text-[#737373] hover:text-[#111111]"
                }`}
              >
                {t === "members"
                  ? `Members (${members.length})`
                  : `Invites (${invites.filter((i) => i.status === "pending").length})`}
              </button>
            ))}
          </>
        }
      />

      {/* Invite form */}
      <Card className="mb-5">
        <h3 className="mb-4 font-black">Invite member</h3>
        <div className="flex gap-3">
          <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com" type="email"
            className="h-11 flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--primary)]" />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="h-11 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-black outline-none">
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <button type="button" onClick={sendInvite} disabled={busy || !inviteEmail.trim()}
            className="flex h-11 items-center gap-2 rounded-2xl bg-[var(--primary)] px-5 text-sm font-black text-[var(--sidebar)] disabled:opacity-50">
            <UserPlus size={15} /> Invite
          </button>
        </div>
      </Card>

      {tab === "members" && (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs font-black uppercase opacity-50">
                <th className="pb-3">Member</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Joined</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-4">
                    <div className="font-black">{m.name}</div>
                    <div className="text-xs opacity-60">{m.email}</div>
                  </td>
                  <td className="py-4">
                    {m.role === "owner" ? (
                      <RoleBadge role="owner" />
                    ) : (
                      <div className="relative inline-block">
                        <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)}
                          className="h-8 appearance-none rounded-xl border border-[var(--border)] bg-white pl-3 pr-7 text-xs font-black outline-none">
                          {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-2 opacity-50" />
                      </div>
                    )}
                  </td>
                  <td className="py-4 text-xs opacity-60">{new Date(m.joined_at).toLocaleDateString()}</td>
                  <td className="py-4 text-right">
                    {m.role !== "owner" && (
                      <button type="button" onClick={() => removeMember(m.user_id)}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] text-[var(--danger)] hover:bg-red-50">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!members.length && <tr><td colSpan={4} className="py-8 text-center text-sm opacity-40">No members yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "invites" && (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs font-black uppercase opacity-50">
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Expires</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-4 font-black">{inv.email}</td>
                  <td className="py-4"><RoleBadge role={inv.role} /></td>
                  <td className="py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${
                      inv.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      inv.status === "accepted" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-500"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-4 text-xs opacity-60">{new Date(inv.expires_at).toLocaleDateString()}</td>
                  <td className="py-4 text-right">
                    {inv.status === "pending" && (
                      <button type="button" onClick={() => revokeInvite(inv.id)}
                        className="rounded-xl border border-[var(--border)] px-3 py-1 text-xs font-black hover:bg-red-50 hover:text-[var(--danger)]">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!invites.length && <tr><td colSpan={5} className="py-8 text-center text-sm opacity-40">No invites yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto w-full max-w-4xl">{children}</div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-sm)] ${className}`}>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: "bg-[var(--primary)] text-[var(--sidebar)]",
    admin: "bg-blue-100 text-blue-700",
    editor: "bg-purple-100 text-purple-700",
    viewer: "bg-gray-100 text-gray-600",
    billing: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${colors[role] ?? "bg-gray-100 text-gray-600"}`}>
      <Shield size={10} />{role}
    </span>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed right-6 top-6 z-[90] rounded-2xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-black shadow-[var(--shadow-md)]">
      {msg}
    </div>
  );
}
