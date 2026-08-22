"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Archive,
  UserPlus,
  X,
  AlertCircle,
  Users,
  Eye,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import { useUserPanelToast } from "@/components/user-panel/UserPanelToastContext";
import ViewportPortal from "@/components/shared/ViewportPortal";
import {
  PanelStatusPill,
  PanelTableIconBtn,
  PanelTableShell,
  panelTable,
  panelTableRowClass,
} from "@/components/user-panel/panel-table";
import UserActionMenu from "@/components/user-panel/UserActionMenu";
import {
  formatPlanRange,
  isClientLinkActive,
} from "@/lib/user-panel/client-plan";

type Client = {
  client_uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  tags: string | string[] | null;
  created_at: string;
  plan_starts_at?: string | Date | null;
  plan_expires_at?: string | Date | null;
  link_expires_at?: string | Date | null;
};

function parseTags(tags: string | string[] | null | undefined): string[] {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (typeof tags !== "string" || !tags.trim()) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
}

export default function ClientsPage() {
  const router = useRouter();
  const { showToast } = useUserPanelToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    tagsInput: "",
    planStartsAt: "",
    planExpiresAt: "",
    linkExpiresAt: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/clients?q=${encodeURIComponent(searchQuery)}&status=${statusFilter}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setClients(data.clients || []);
      } else {
        setError(data.error || "Failed to load clients. Verify module license.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to communicate with client workspace API.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useDeferredEffect(() => {
    void loadClients();
  }, [loadClients]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || creating) return;

    setCreating(true);
    setError("");
    try {
      const tagsArray = formData.tagsInput
        ? formData.tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          companyName: formData.companyName.trim(),
          tags: tagsArray,
          planStartsAt: formData.planStartsAt || null,
          planExpiresAt: formData.planExpiresAt || null,
          linkExpiresAt: formData.linkExpiresAt || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormData({
          name: "",
          email: "",
          phone: "",
          companyName: "",
          tagsInput: "",
          planStartsAt: "",
          planExpiresAt: "",
          linkExpiresAt: "",
        });
        setShowCreateModal(false);
        showToast("Client profile created!");
        void loadClients();
      } else {
        alert(data.error || "Failed to create client.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving client profile.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleArchive(clientUid: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "archived" : "active";
    try {
      const res = await fetch(`/api/clients/${clientUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        showToast(nextStatus === "archived" ? "Client profile archived." : "Client profile restored.");
        void loadClients();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteClient(clientUid: string, name: string) {
    const label = String(name || "this client").trim();
    if (
      !confirm(
        `Delete "${label}" permanently?\n\nAssigned products stay in Products — only this client profile and links are removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientUid)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Client deleted.");
        void loadClients();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Failed to delete client.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete client.");
    }
  }

  const emptyCopy = useMemo(() => {
    if (searchQuery) return "No clients match your search.";
    if (statusFilter === "archived") return "No archived clients yet.";
    return "No client profiles yet. Add your first client to start linking products.";
  }, [searchQuery, statusFilter]);

  return (
    <UserPanelPageShell className="gap-4">
      {showCreateModal ? (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[#ECECEC] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-[#ECECEC] pb-4">
              <h3 className="flex items-center gap-2 text-lg font-black text-[#111111]">
                <UserPlus size={20} className="text-[#84D400]" /> Add New Client
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-1 text-[#737373] hover:bg-slate-100 hover:text-[#111111]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@company.com"
                    className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 99999 99999"
                    className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Acme Corporation"
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tagsInput}
                  onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                  placeholder="VIP, Retail, Enterprise"
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                    Plan start
                  </label>
                  <input
                    type="date"
                    value={formData.planStartsAt}
                    onChange={(e) => setFormData({ ...formData, planStartsAt: e.target.value })}
                    className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                    Plan expire
                  </label>
                  <input
                    type="date"
                    value={formData.planExpiresAt}
                    onChange={(e) => setFormData({ ...formData, planExpiresAt: e.target.value })}
                    className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#111111]">
                  Link expire (optional)
                </label>
                <input
                  type="date"
                  value={formData.linkExpiresAt}
                  onChange={(e) => setFormData({ ...formData, linkExpiresAt: e.target.value })}
                  className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm outline-none focus:border-[#84D400]"
                />
                <p className="mt-1 text-[11px] font-medium text-[#737373]">
                  Leave empty to use plan expire. Empty both = link stays active.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="h-11 flex-1 rounded-2xl bg-[#84D400] text-sm font-black text-[#102000] hover:bg-[#78C400] disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create Client"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-11 rounded-2xl border border-[#ECECEC] bg-white px-5 text-sm font-black text-[#737373] hover:text-[#111111]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </ViewportPortal>
      ) : null}

      <UserPageHeader
        title="Clients"
        subtitle="Assign products and branding to each client workspace."
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#84D400] px-4 text-sm font-semibold text-[#102000] shadow-sm hover:bg-[#78C400]"
          >
            <Plus size={16} /> Add Client
          </button>
        }
      />

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
          <h3 className="font-extrabold text-red-950">Access Gated</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <Link
            href="/dashboard/subscription"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#84D400] px-4 text-sm font-bold text-[#102000]"
          >
            Check Premium Add-ons
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 dash-premium-card p-4 sm:flex-row sm:items-center">
            <div className="dash-products-search min-w-0 flex-1">
              <Search size={16} className="dash-products-search__icon" />
              <input
                type="text"
                placeholder="Search by name, company, or email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="dash-products-input dash-products-input--icon"
              />
            </div>

            <div className="flex shrink-0 gap-2">
              {(["active", "archived", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`h-11 rounded-2xl px-4 text-xs font-bold capitalize transition ${
                    statusFilter === s
                      ? "bg-[#EEF9E0] text-[#5FA800] ring-1 ring-[#84D400]/30"
                      : "border border-[#ECECEC] bg-white text-[#737373] hover:text-[#111111]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <UserWorkspaceLoading
              className="min-h-[320px] rounded-[16px] border border-[#ECECEC]"
              label="Loading Clients"
              hint="Please wait while we load your clients..."
            />
          ) : !clients.length ? (
            <PanelTableShell>
              <div className={panelTable.empty}>
                <Users className="mx-auto text-[#D4D4D4]" size={32} />
                <p className="mt-3 text-sm font-semibold text-[#111111]">{emptyCopy}</p>
                {!searchQuery && statusFilter === "active" ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#84D400] px-4 text-xs font-bold text-[#102000]"
                  >
                    <Plus size={14} /> Add Client
                  </button>
                ) : null}
              </div>
            </PanelTableShell>
          ) : (
            <PanelTableShell>
              <div className="hidden md:block">
                <table className={`${panelTable.table} min-w-[980px]`}>
                  <thead>
                    <tr className={panelTable.theadRow}>
                      <th className={panelTable.th}>Client</th>
                      <th className={panelTable.th}>Company</th>
                      <th className={panelTable.th}>Email</th>
                      <th className={panelTable.th}>Phone</th>
                      <th className={panelTable.th}>Plan</th>
                      <th className={panelTable.th}>Link</th>
                      <th className={panelTable.th}>Status</th>
                      <th className={panelTable.thRight}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => {
                      const tags = parseTags(client.tags);
                      const workspaceHref = `/dashboard/clients/${client.client_uid}`;
                      const linkActive = isClientLinkActive(client);
                      return (
                        <tr
                          key={client.client_uid}
                          className={panelTableRowClass({ clickable: true })}
                          onClick={() => router.push(workspaceHref)}
                        >
                          <td className={panelTable.td}>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#111111]">{client.name}</p>
                              {tags.length ? (
                                <p className="truncate text-xs text-[#737373]">{tags.slice(0, 3).join(" · ")}</p>
                              ) : null}
                            </div>
                          </td>
                          <td className={panelTable.tdMuted}>
                            {client.company_name ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Building2 size={13} /> {client.company_name}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={panelTable.tdMuted}>
                            {client.email ? (
                              <span className="inline-flex max-w-[200px] items-center gap-1.5 truncate">
                                <Mail size={13} className="shrink-0" /> {client.email}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={panelTable.tdMuted}>
                            {client.phone ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Phone size={13} /> {client.phone}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={panelTable.tdMuted}>{formatPlanRange(client)}</td>
                          <td className={panelTable.td}>
                            <PanelStatusPill
                              label={linkActive ? "Active link" : "Link expire"}
                              tone={linkActive ? "success" : "danger"}
                            />
                          </td>
                          <td className={panelTable.td}>
                            <PanelStatusPill
                              label={client.status}
                              tone={client.status === "active" ? "success" : "neutral"}
                            />
                          </td>
                          <td className={panelTable.td}>
                            <div
                              className="flex items-center justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PanelTableIconBtn
                                icon={Eye}
                                title="Open workspace"
                                accent
                                href={workspaceHref}
                              />
                              <PanelTableIconBtn
                                icon={Archive}
                                title={client.status === "active" ? "Archive" : "Restore"}
                                onClick={() => void toggleArchive(client.client_uid, client.status)}
                              />
                              <PanelTableIconBtn
                                icon={Trash2}
                                title="Delete client"
                                onClick={() => void deleteClient(client.client_uid, client.name)}
                              />
                              <UserActionMenu
                                items={[
                                  {
                                    label: "Open workspace",
                                    icon: <ExternalLink />,
                                    onClick: () => router.push(workspaceHref),
                                  },
                                  {
                                    label:
                                      client.status === "active" ? "Archive" : "Restore",
                                    icon: <Archive />,
                                    onClick: () =>
                                      void toggleArchive(client.client_uid, client.status),
                                  },
                                  {
                                    label: "Delete",
                                    icon: <Trash2 />,
                                    danger: true,
                                    onClick: () =>
                                      void deleteClient(client.client_uid, client.name),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                {clients.map((client) => {
                  const linkActive = isClientLinkActive(client);
                  return (
                  <article
                    key={client.client_uid}
                    className="rounded-[16px] border border-[#ECECEC] bg-white p-4 transition hover:bg-[#FAFAFA]"
                    onClick={() => router.push(`/dashboard/clients/${client.client_uid}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#111111]">{client.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#737373]">
                          {client.company_name || client.email || "No company"}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#525252]">
                          Plan: {formatPlanRange(client)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <PanelStatusPill
                          label={client.status}
                          tone={client.status === "active" ? "success" : "neutral"}
                        />
                        <PanelStatusPill
                          label={linkActive ? "Active link" : "Link expire"}
                          tone={linkActive ? "success" : "danger"}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/clients/${client.client_uid}`}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#84D400] text-xs font-bold text-[#102000]"
                      >
                        Workspace
                      </Link>
                      <button
                        type="button"
                        onClick={() => void toggleArchive(client.client_uid, client.status)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-[#D4D4D4] text-[#525252] hover:bg-[#FAFAFA]"
                        title={client.status === "active" ? "Archive" : "Restore"}
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteClient(client.client_uid, client.name)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                        title="Delete client"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                  );
                })}
              </div>
            </PanelTableShell>
          )}
        </div>
      )}
    </UserPanelPageShell>
  );
}
