"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Archive,
  Tag,
  UserPlus,
  X,
  AlertCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import UserPageHeader from "@/components/user-panel/UserPageHeader";

type Client = {
  client_uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  tags: string | string[] | null;
  created_at: string;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState("");
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    tagsInput: "",
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

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

  useEffect(() => {
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
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormData({ name: "", email: "", phone: "", companyName: "", tagsInput: "" });
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

  const emptyCopy = useMemo(() => {
    if (searchQuery) return "No clients match your search.";
    if (statusFilter === "archived") return "No archived clients yet.";
    return "No client profiles yet. Add your first client to start linking products.";
  }, [searchQuery, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      {toast ? (
        <div className="fixed right-6 top-6 z-[200] rounded-2xl border border-[#C8E6A0] bg-[#EEF9E0] px-5 py-3 text-sm font-black text-[#3D6600] shadow-md">
          {toast}
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#ECECEC] bg-white p-6 shadow-2xl">
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
      ) : null}

      <UserPageHeader
        title="Clients"
        subtitle="Manage client accounts, workspaces, and assigned assets."
        actions={
          <div className="flex items-center gap-3">
            <a
              href="/api/clients/export"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-5 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              Export CSV
            </a>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] shadow-sm hover:bg-[#78C400]"
            >
              <Plus size={16} /> Add Client
            </button>
          </div>
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
          <div className="flex flex-col gap-3 rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-3.5 text-[#737373]" size={16} />
              <input
                type="text"
                placeholder="Search by name, company, or email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-11 w-full rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] pl-10 pr-4 text-sm outline-none focus:border-[#84D400]"
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
            <div className="rounded-[20px] border border-[#ECECEC] bg-white py-16 text-center text-sm font-medium text-[#737373]">
              Loading clients…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => {
                const tags = parseTags(client.tags);
                return (
                  <div
                    key={client.client_uid}
                    className="flex flex-col rounded-[22px] border border-[#ECECEC] bg-white p-5 shadow-sm transition hover:border-[#84D400]/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-[15px] font-extrabold text-[#111111]">
                          {client.name}
                        </h4>
                        {client.company_name ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#737373]">
                            <Building2 size={13} /> {client.company_name}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          client.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {client.status}
                      </span>
                    </div>

                    {(client.email || client.phone) && (
                      <div className="mt-3 space-y-1.5 border-t border-[#ECECEC]/60 pt-3 text-xs font-medium text-[#737373]">
                        {client.email ? (
                          <div className="flex items-center gap-2 truncate">
                            <Mail size={13} className="shrink-0" /> {client.email}
                          </div>
                        ) : null}
                        {client.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="shrink-0" /> {client.phone}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                          >
                            <Tag size={9} /> {t}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex gap-2 border-t border-[#ECECEC]/60 pt-4">
                      <Link
                        href={`/dashboard/clients/${client.client_uid}`}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#84D400] text-xs font-black text-[#102000] hover:bg-[#78C400]"
                      >
                        <ExternalLink size={12} /> Workspace
                      </Link>
                      <button
                        type="button"
                        onClick={() => void toggleArchive(client.client_uid, client.status)}
                        title={client.status === "active" ? "Archive Client" : "Restore Client"}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECECEC] text-[#737373] hover:bg-slate-50 hover:text-[#111111]"
                      >
                        <Archive size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!clients.length ? (
                <div className="col-span-full rounded-[24px] border border-dashed border-[#D8D8D8] bg-[#FAFAFA] px-6 py-14 text-center">
                  <Users className="mx-auto text-[#B0B0B0]" size={32} />
                  <p className="mt-3 text-sm font-semibold text-[#737373]">{emptyCopy}</p>
                  {!searchQuery && statusFilter === "active" ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#84D400] px-4 text-xs font-black text-[#102000]"
                    >
                      <Plus size={14} /> Add Client
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
