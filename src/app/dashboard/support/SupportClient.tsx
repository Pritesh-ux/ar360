"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Headphones,
  Mail,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Ticket,
  Upload,
  X,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";

type TicketStatusFilter = "all" | "open" | "pending" | "resolved" | "closed";

type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  categoryLabel: string;
  status: string;
  rawStatus: string;
  createdAt: string;
  updatedAt: string;
};

type TicketStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const TABS: { key: TicketStatusFilter; label: string }[] = [
  { key: "all", label: "My Tickets" },
  { key: "open", label: "Open" },
  { key: "pending", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

const POPULAR_ARTICLES = [
  { title: "How to upload a 3D model", icon: Upload },
  { title: "Generating and sharing QR codes", icon: Ticket },
  { title: "Setting up AR viewer for products", icon: BookOpen },
  { title: "Managing product variants and materials", icon: BookOpen },
  { title: "Understanding analytics and viewer insights", icon: BookOpen },
];

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return fmtDate(value);
}

function statusUi(rawStatus: string) {
  const key = rawStatus.toLowerCase();
  if (key === "pending") {
    return { label: "In Progress", className: "bg-orange-50 text-orange-700" };
  }
  if (key === "resolved") {
    return { label: "Resolved", className: "bg-emerald-50 text-emerald-700" };
  }
  if (key === "closed") {
    return { label: "Closed", className: "bg-slate-100 text-slate-600" };
  }
  return { label: "Open", className: "bg-sky-50 text-sky-700" };
}

export default function SupportClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<TicketStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats>({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [supportEmail, setSupportEmail] = useState("support@ar360.studio");
  const [articleQuery, setArticleQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "technical" as "technical" | "billing" | "account" | "feature" | "other",
  });
  const [threadOpen, setThreadOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [threadMessages, setThreadMessages] = useState<
    Array<{ senderType: string; senderName: string; message: string; createdAt: string }>
  >([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const fetchTickets = useCallback(async (statusFilter: TicketStatusFilter, pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(pageNum),
        pageSize: "10",
      });
      const res = await fetch(`/api/support-tickets?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setStats(data.stats || { total: 0, open: 0, inProgress: 0, resolved: 0 });
      setPagination(data.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 });
      if (data.supportEmail) setSupportEmail(data.supportEmail);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(() => fetchTickets(status, page), [fetchTickets, status, page]);

  async function openTicketThread(ticket: SupportTicket) {
    setActiveTicket(ticket);
    setThreadOpen(true);
    setReplyText("");
    setThreadMessages([]);
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/support-tickets/${ticket.id}`);
      const data = await res.json();
      if (res.ok) {
        setThreadMessages(data.messages || []);
      }
    } finally {
      setThreadLoading(false);
    }
  }

  async function sendReply() {
    if (!activeTicket || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/support-tickets/${activeTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThreadMessages(data.messages || []);
      setReplyText("");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reply failed");
    } finally {
      setReplying(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (!ticketId || deepLinkHandled) return;
    setDeepLinkHandled(true);
    void (async () => {
      const res = await fetch(`/api/support-tickets/${ticketId}`);
      if (!res.ok) return;
      const data = await res.json();
      const mapped = data.ticket;
      if (!mapped?.id) return;
      await openTicketThread({
        id: mapped.id,
        ticketNumber: mapped.ticketNumber,
        subject: mapped.subject,
        description: mapped.description || "",
        category: mapped.category || "",
        categoryLabel: mapped.categoryLabel || "",
        status: mapped.status || "Open",
        rawStatus: mapped.rawStatus || "open",
        updatedAt: mapped.updatedAt,
        createdAt: mapped.createdAt,
      });
    })();
  }, [searchParams, deepLinkHandled]);

  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages;
    const current = pagination.page;
    const windowSize = 5;
    let start = Math.max(1, current - 2);
    const end = Math.min(total, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  }, [pagination.page, pagination.totalPages]);

  const filteredArticles = useMemo(() => {
    const q = articleQuery.trim().toLowerCase();
    if (!q) return POPULAR_ARTICLES;
    return POPULAR_ARTICLES.filter((item) => item.title.toLowerCase().includes(q));
  }, [articleQuery]);

  const showingFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const showingTo = Math.min(pagination.page * pagination.pageSize, pagination.total);

  async function submitTicket() {
    if (!form.subject.trim() || !form.description.trim()) {
      setNotice("Subject and description are required.");
      return;
    }
    setCreating(true);
    setNotice("");
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");
      setCreateOpen(false);
      setForm({ subject: "", description: "", category: "technical" });
      setStatus("all");
      setPage(1);
      setNotice(`Ticket ${data.ticket?.ticketNumber || ""} created successfully.`);
      window.setTimeout(() => setNotice(""), 3000);
      await fetchTickets("all", 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create ticket.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <UserPageHeader
        title="Support"
        subtitle="Need help? We're here to assist you."
        actions={
          <UserButton
            icon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
            className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] shadow-sm hover:bg-[#78C400]"
          >
            Create New Ticket
          </UserButton>
        }
      />

      {notice ? (
        <div className="rounded-[20px] border border-[#C8E6A0] bg-[#EEF9E0] px-5 py-3 text-sm font-medium text-[#3D6600]">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Tickets" value={String(stats.total)} sub="All time" icon={Ticket} iconClass="bg-[#EEF9E0] text-[#84D400]" />
        <StatCard
          label="Open Tickets"
          value={String(stats.open)}
          sub="Requires your attention"
          icon={Ticket}
          iconClass="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="In Progress"
          value={String(stats.inProgress)}
          sub="Being resolved"
          icon={Clock3}
          iconClass="bg-orange-50 text-orange-600"
        />
        <StatCard
          label="Resolved"
          value={String(stats.resolved)}
          sub="All time resolved"
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECECEC] px-5 pt-1">
            <div className="flex flex-wrap">
              {TABS.map((tab) => {
                const active = status === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatus(tab.key)}
                    className={`relative px-4 py-3.5 text-[13px] font-semibold transition ${
                      active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                    }`}
                  >
                    {tab.label}
                    {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" /> : null}
                  </button>
                );
              })}
            </div>
            <label className="mb-2 inline-flex items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 py-2 text-[13px] font-medium text-[#525252]">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatusFilter)}
                className="bg-transparent outline-none"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="pending">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <ChevronDown size={15} className="text-[#A3A3A3]" />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#ECECEC] bg-[#FAFAFA] text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  <th className="px-5 py-3.5">Ticket ID</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Update</th>
                  <th className="px-5 py-3.5">Created On</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-20 text-center text-sm font-medium text-[#737373]">
                      Loading tickets…
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-20 text-center">
                      <Ticket size={32} className="mx-auto text-[#D4D4D4]" />
                      <p className="mt-3 text-sm font-semibold text-[#111111]">
                        {status === "all" ? "No tickets yet" : `No ${status} tickets`}
                      </p>
                      <p className="mt-1 text-sm text-[#737373]">
                        {status === "all"
                          ? "Create a ticket and our team will respond shortly."
                          : "Try a different filter or create a new ticket."}
                      </p>
                      {status === "all" ? (
                        <UserButton
                          className="mt-4 rounded-2xl bg-[#84D400] font-semibold text-[#102000]"
                          icon={<Plus size={16} />}
                          onClick={() => setCreateOpen(true)}
                        >
                          Create New Ticket
                        </UserButton>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => {
                    const badge = statusUi(ticket.rawStatus);
                    return (
                      <tr
                        key={ticket.id}
                        className="cursor-pointer border-b border-[#ECECEC] last:border-0 hover:bg-[#FAFAFA]/80"
                        onClick={() => void openTicketThread(ticket)}
                      >
                        <td className="px-5 py-4 font-semibold text-[#111111]">#{ticket.ticketNumber}</td>
                        <td className="max-w-[280px] px-5 py-4">
                          <p className="truncate font-semibold text-[#111111]">{ticket.subject}</p>
                          <p className="mt-0.5 truncate text-xs text-[#737373]">{ticket.description || ticket.categoryLabel}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#525252]">{timeAgo(ticket.updatedAt)}</td>
                        <td className="px-5 py-4 text-[#525252]">{fmtDate(ticket.createdAt)}</td>
                        <td className="px-5 py-4 text-right">
                          <a
                            href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Re: ${ticket.ticketNumber} — ${ticket.subject}`)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-grid h-9 w-9 place-items-center rounded-xl border border-[#ECECEC] text-[#737373] hover:bg-[#FAFAFA] hover:text-[#111111]"
                            aria-label="Contact about ticket"
                          >
                            <MoreVertical size={16} />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] px-5 py-4 text-sm text-[#737373]">
            <p>
              Showing {showingFrom} to {showingTo} of {pagination.total} ticket{pagination.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#ECECEC] disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-semibold ${
                    pagination.page === n ? "bg-[#84D400] text-[#102000]" : "border border-[#ECECEC] text-[#525252]"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#ECECEC] disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-[#111111]">Need Help?</h3>
            <label className="relative mt-3 block">
              <input
                value={articleQuery}
                onChange={(e) => setArticleQuery(e.target.value)}
                placeholder="Search articles..."
                className="h-11 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-4 pr-10 text-[14px] font-medium outline-none transition focus:border-[#84D400]"
              />
              <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
            </label>
            <Link
              href="/contact"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#EEF9E0] text-sm font-semibold text-[#3D6600] hover:bg-[#E4F5CC]"
            >
              Visit Help Center
              <ExternalLink size={15} />
            </Link>
          </section>

          <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-[#111111]">Popular Articles</h3>
            <ul className="mt-3 divide-y divide-[#ECECEC]">
              {filteredArticles.map((item) => (
                <li key={item.title}>
                  <Link
                    href="/contact"
                    className="flex items-center justify-between gap-3 py-3 text-sm font-medium text-[#525252] hover:text-[#111111]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <item.icon size={16} className="shrink-0 text-[#84D400]" />
                      <span className="truncate">{item.title}</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-[#A3A3A3]" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/contact" className="mt-2 inline-block text-sm font-semibold text-[#84D400] hover:text-[#6BB000]">
              View All Articles →
            </Link>
          </section>

          <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-[#111111]">Contact Us</h3>
            <div className="mt-3 space-y-3">
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-start gap-3 rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-4 transition hover:bg-[#F5F5F5]"
              >
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#525252]">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Email Support</p>
                  <p className="mt-0.5 text-sm text-[#737373]">{supportEmail}</p>
                </div>
              </a>
              <Link
                href="/contact"
                className="flex items-start gap-3 rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-4 transition hover:bg-[#F5F5F5]"
              >
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#525252]">
                  <MessageCircle size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Live Chat</p>
                  <p className="mt-0.5 text-sm text-[#737373]">Chat with our team</p>
                </div>
              </Link>
            </div>
          </section>
        </aside>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-[#ECECEC] bg-white px-5 py-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF9E0] text-[#84D400]">
            <Headphones size={22} />
          </div>
          <div>
            <p className="text-base font-semibold text-[#111111]">Can&apos;t find what you need?</p>
            <p className="mt-1 text-sm text-[#737373]">Still need help? Our support team is ready to assist you with any issues.</p>
          </div>
        </div>
        <UserButton
          icon={<MessageCircle size={16} />}
          onClick={() => setCreateOpen(true)}
          className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] hover:bg-[#78C400]"
        >
          Contact Support
        </UserButton>
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[20px] border border-[#ECECEC] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#111111]">Create New Ticket</h2>
                <p className="mt-1 text-sm text-[#737373]">Describe your issue and we&apos;ll get back to you soon.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#ECECEC] text-[#737373] hover:bg-[#FAFAFA]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#111111]">Category</span>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      category: e.target.value as typeof form.category,
                    }))
                  }
                  className="mt-1.5 h-11 w-full rounded-[14px] border border-[#ECECEC] px-3 text-sm outline-none focus:border-[#84D400]"
                >
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing & Payments</option>
                  <option value="account">Account & Access</option>
                  <option value="feature">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#111111]">Subject</span>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief summary of your issue"
                  className="mt-1.5 h-11 w-full rounded-[14px] border border-[#ECECEC] px-3 text-sm outline-none focus:border-[#84D400]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#111111]">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={5}
                  placeholder="Provide details so we can help faster..."
                  className="mt-1.5 w-full rounded-[14px] border border-[#ECECEC] px-3 py-2.5 text-sm outline-none focus:border-[#84D400]"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-11 items-center rounded-2xl border border-[#ECECEC] px-5 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
              >
                Cancel
              </button>
              <UserButton
                disabled={creating}
                onClick={() => void submitTicket()}
                className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] hover:bg-[#78C400] disabled:opacity-60"
              >
                {creating ? "Submitting…" : "Submit Ticket"}
              </UserButton>
            </div>
          </div>
        </div>
      ) : null}

      {threadOpen && activeTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[20px] border border-[#ECECEC] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#ECECEC] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                  #{activeTicket.ticketNumber}
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#111111]">{activeTicket.subject}</h2>
                <p className="mt-1 text-sm text-[#737373]">{statusUi(activeTicket.rawStatus).label}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setThreadOpen(false);
                  setActiveTicket(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#ECECEC] text-[#737373] hover:bg-[#FAFAFA]"
                aria-label="Close conversation"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {threadLoading ? (
                <p className="text-sm text-[#737373]">Loading conversation…</p>
              ) : threadMessages.length === 0 ? (
                <p className="text-sm text-[#737373]">No messages yet.</p>
              ) : (
                threadMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-[14px] px-4 py-3 text-sm ${
                      msg.senderType === "customer"
                        ? "ml-8 bg-[#E8F7FF] text-[#111111]"
                        : "mr-8 border border-[#ECECEC] bg-[#FAFAFA] text-[#111111]"
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#737373]">
                      {msg.senderName} · {timeAgo(msg.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            {activeTicket.rawStatus !== "closed" && activeTicket.rawStatus !== "resolved" ? (
              <div className="border-t border-[#ECECEC] px-5 py-4">
                <label className="block">
                  <span className="text-sm font-semibold text-[#111111]">Your reply</span>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-[14px] border border-[#ECECEC] px-3 py-2 text-sm outline-none focus:border-[#018abe]"
                    placeholder="Type your message…"
                  />
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <UserButton variant="secondary" onClick={() => setThreadOpen(false)}>
                    Close
                  </UserButton>
                  <UserButton onClick={() => void sendReply()} disabled={replying || !replyText.trim()}>
                    {replying ? "Sending…" : "Send reply"}
                  </UserButton>
                </div>
              </div>
            ) : (
              <div className="border-t border-[#ECECEC] px-5 py-4 text-sm text-[#737373]">
                This ticket is {activeTicket.rawStatus}. Contact support if you need to reopen it.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  iconClass?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#111111]">{value}</p>
          {sub ? <p className="mt-1 text-xs font-medium text-[#737373]">{sub}</p> : null}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${iconClass || "bg-[#F5F5F5] text-[#525252]"}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
