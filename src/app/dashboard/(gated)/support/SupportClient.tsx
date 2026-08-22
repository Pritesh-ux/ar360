"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserStatCard from "@/components/user-panel/UserStatCard";
import UserActionMenu from "@/components/user-panel/UserActionMenu";
import { panelTable, panelTableRowClass } from "@/components/user-panel/panel-table";
import ViewportPortal from "@/components/shared/ViewportPortal";
import { useUserPanelSession } from "@/components/user-panel/UserPanelContext";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Headphones,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Ticket,
  Upload,
  X,
} from "lucide-react";

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
  processStatus: string;
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

const STATUS_FILTER_OPTIONS: { key: TicketStatusFilter; label: string }[] = [
  { key: "all", label: "All Status" },
  { key: "open", label: "Open" },
  { key: "pending", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

function statusFilterLabel(key: string) {
  return STATUS_FILTER_OPTIONS.find((item) => item.key === key)?.label ?? key;
}

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
  const session = useUserPanelSession();
  const accountSuspended = session?.accountSuspended === true;
  const [status, setStatus] = useState<TicketStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats>({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [pageSize, setPageSize] = useState(10);
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

  const fetchTickets = useCallback(async (statusFilter: TicketStatusFilter, pageNum: number, size: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(pageNum),
        pageSize: String(size),
      });
      const res = await fetch(`/api/support-tickets?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setStats(data.stats || { total: 0, open: 0, inProgress: 0, resolved: 0 });
      setPagination(data.pagination || { page: 1, pageSize: size, total: 0, totalPages: 1 });
      if (data.supportEmail) setSupportEmail(data.supportEmail);
    } catch {
      setTickets([]);
      setStats({ total: 0, open: 0, inProgress: 0, resolved: 0 });
      setPagination({ page: 1, pageSize: size, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(() => fetchTickets(status, page, pageSize), [fetchTickets, status, page, pageSize]);

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

  useDeferredEffect(() => {
    void load();
  }, [load]);

  useDeferredEffect(() => {
    setPage(1);
  }, [status]);

  useDeferredEffect(() => {
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
        processStatus: mapped.processStatus || "",
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
      await fetchTickets("all", 1, pageSize);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create ticket.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="Support"
        subtitle={
          accountSuspended
            ? "Your account is suspended. You can still open support tickets here."
            : "Need help? We're here to assist you."
        }
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="dash-premium-btn-primary"
          >
            <Plus size={16} />
            Create New Ticket
          </button>
        }
      />

      {accountSuspended ? (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900">
          Account suspended — products, billing, and other features are locked until Master Admin
          reactivates your account. Support tickets still work.
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-[20px] border border-[#C8E6A0] bg-[#EEF9E0] px-5 py-3 text-sm font-medium text-[#3D6600]">
          {notice}
        </div>
      ) : null}

      <section className="grid min-w-0 grid-cols-2 gap-2 md:gap-3 xl:grid-cols-4">
        <UserStatCard dense label="Total Tickets" value={String(stats.total)} sub="All time" icon={Ticket} accent="lime" />
        <UserStatCard
          dense
          label="Open Tickets"
          value={String(stats.open)}
          sub="Requires your attention"
          icon={Ticket}
          accent="sky"
        />
        <UserStatCard
          dense
          label="In Progress"
          value={String(stats.inProgress)}
          sub="Being resolved"
          icon={Clock3}
          accent="orange"
        />
        <UserStatCard
          dense
          label="Resolved"
          value={String(stats.resolved)}
          sub="All time resolved"
          icon={CheckCircle2}
          accent="emerald"
        />
      </section>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="dash-premium-card flex min-h-[480px] min-w-0 flex-col overflow-hidden md:min-h-[640px] xl:h-full">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-2 border-b border-[#ECECEC] px-3 pt-1 sm:px-5">
            <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((tab) => {
                const active = status === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatus(tab.key)}
                    className={`relative shrink-0 whitespace-nowrap px-3 py-3 text-[12px] font-semibold transition sm:px-4 sm:py-3.5 sm:text-[13px] ${
                      active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                    }`}
                  >
                    {tab.key === "all" ? (
                      <>
                        <span className="sm:hidden">All</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </>
                    ) : (
                      tab.label
                    )}
                    {active ? (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <UserFilterDropdown
              hideLabel
              compact
              className="mb-2 w-full sm:mb-3 md:hidden"
              label="Status"
              menuTitle="Status"
              value={status}
              options={STATUS_FILTER_OPTIONS.map((item) => item.key)}
              onChange={(value) => setStatus(value as TicketStatusFilter)}
              renderOption={statusFilterLabel}
              renderValue={statusFilterLabel}
              menuWidth={220}
            />
          </div>

          {loading ? (
              <UserWorkspaceLoading
                className="min-h-[420px]"
                label="Loading Support"
                hint="Please wait while we load your tickets..."
              />
          ) : tickets.length === 0 ? (
            <div className="flex min-h-[420px] flex-1 items-center justify-center px-5 py-12">
              <div className="text-center">
                <Ticket size={32} className="mx-auto text-[#D4D4D4]" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-[#111111]">
                  {status === "all" ? "No tickets yet" : `No ${statusFilterLabel(status).toLowerCase()} tickets`}
                </p>
                <p className="mt-1 text-xs font-medium text-[#737373]">
                  {status === "all"
                    ? "Create a ticket and our team will help you soon."
                    : "Try a different filter or create a new ticket."}
                </p>
                {status === "all" ? (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="dash-premium-btn-primary mt-4"
                  >
                    <Plus size={16} />
                    Create New Ticket
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
          <>
          <div className="space-y-2.5 p-3 md:hidden">
            {tickets.map((ticket) => {
              const badge = statusUi(ticket.rawStatus);
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => void openTicketThread(ticket)}
                  className="w-full rounded-[16px] border border-[#ECECEC] bg-white p-3.5 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#737373]">#{ticket.ticketNumber}</p>
                      <p className="mt-0.5 truncate text-[14px] font-semibold text-[#111111]">{ticket.subject}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[12px] text-[#6B7280]">
                    {ticket.description || ticket.categoryLabel} · {timeAgo(ticket.updatedAt)}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className={`${panelTable.table} min-w-[760px]`}>
              <thead>
                <tr className={panelTable.theadRow}>
                  <th className={panelTable.th}>Ticket ID</th>
                  <th className={panelTable.th}>Subject</th>
                  <th className={panelTable.th}>Status</th>
                  <th className={panelTable.th}>Last Update</th>
                  <th className={panelTable.th}>Created On</th>
                  <th className={panelTable.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                    const badge = statusUi(ticket.rawStatus);
                    return (
                      <tr
                        key={ticket.id}
                        className={panelTableRowClass({ clickable: true })}
                        onClick={() => void openTicketThread(ticket)}
                      >
                        <td className={panelTable.tdStrong}>#{ticket.ticketNumber}</td>
                        <td className={`max-w-[280px] ${panelTable.td}`}>
                          <p className="truncate font-semibold text-[#111111]">{ticket.subject}</p>
                          <p className="mt-0.5 truncate text-xs text-[#737373]">{ticket.description || ticket.categoryLabel}</p>
                        </td>
                        <td className={panelTable.td}>
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}>
                            {badge.label}
                          </span>
                          {ticket.processStatus ? (
                            <p className="mt-1 text-xs font-semibold text-[#737373]">
                              {ticket.processStatus}
                            </p>
                          ) : null}
                        </td>
                        <td className={`${panelTable.td} text-[#525252]`}>{timeAgo(ticket.updatedAt)}</td>
                        <td className={`${panelTable.td} text-[#525252]`}>{fmtDate(ticket.createdAt)}</td>
                        <td className={`${panelTable.td} text-right`}>
                          <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
                            <UserActionMenu
                              iconOrientation="vertical"
                              triggerProps={{ "aria-label": "Ticket actions" }}
                              items={[
                                {
                                  label: "Open thread",
                                  icon: <Eye />,
                                  onClick: () => void openTicketThread(ticket),
                                },
                                {
                                  label: "Email support",
                                  icon: <Mail />,
                                  onClick: () => {
                                    window.open(
                                      `mailto:${supportEmail}?subject=${encodeURIComponent(`Re: ${ticket.ticketNumber} — ${ticket.subject}`)}`,
                                      "_blank",
                                    );
                                  },
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
          </>
          )}
        </div>

        <div className="hidden flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] px-5 py-4 text-sm text-[#737373] md:flex">
            <p>
              Showing {showingFrom} to {showingTo} of {pagination.total} ticket{pagination.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <UserFilterDropdown
                label="Rows"
                menuTitle="Rows per page"
                hideLabel
                size="sm"
                preferAbove
                menuWidth={128}
                className="w-[4.5rem] shrink-0"
                value={String(pageSize)}
                options={["10", "25", "50"]}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              />
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
                    pagination.page === n ? "bg-[#B6FF38] text-[#102000]" : "border border-[#ECECEC] text-[#525252]"
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
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-3">
          <section id="help" className="dash-premium-card min-w-0 overflow-hidden p-4 sm:p-5 scroll-mt-24">
            <h3 className="text-base font-semibold text-[#111827]">Need Help?</h3>
            <label className="dash-products-search mt-3 block">
              <input
                value={articleQuery}
                onChange={(e) => setArticleQuery(e.target.value)}
                placeholder="Search topics..."
                className="dash-products-input dash-products-input--icon"
              />
              <Search size={16} className="dash-products-search__icon" />
            </label>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#EEF9E0] text-sm font-semibold text-[#3D6600] hover:bg-[#E4F5CC]"
            >
              Create support ticket
            </button>
          </section>

          <section id="help-articles" className="dash-premium-card min-w-0 overflow-hidden p-4 sm:p-5 scroll-mt-24">
            <h3 className="text-base font-semibold text-[#111111]">Quick ticket topics</h3>
            <p className="mt-1 text-xs font-medium text-[#737373]">
              Tap a topic to start a support ticket.
            </p>
            <ul className="mt-3 divide-y divide-[#ECECEC]">
              {filteredArticles.map((item) => (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        subject: item.title,
                        category: "other",
                      }));
                      setCreateOpen(true);
                    }}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-[#525252] hover:text-[#111111]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <item.icon size={16} className="shrink-0 text-[#84D400]" />
                      <span className="truncate">{item.title}</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-[#A3A3A3]" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                window.open(`mailto:${supportEmail}`, "_blank");
              }}
              className="mt-2 inline-block text-sm font-semibold text-[#84D400] hover:text-[#6BB000]"
            >
              Email {supportEmail} →
            </button>
          </section>

          <section className="dash-premium-card min-w-0 overflow-hidden p-4 sm:p-5">
            <h3 className="text-base font-semibold text-[#111111]">Contact Us</h3>
            <div className="mt-3 space-y-3">
              <a
                href={`mailto:${supportEmail}`}
                className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-3.5 transition hover:bg-[#F5F5F5] sm:p-4"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#525252]">
                  <Mail size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111111]">Email Support</p>
                  <p className="mt-0.5 break-all text-sm text-[#737373]">{supportEmail}</p>
                </div>
              </a>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex w-full min-w-0 items-start gap-3 rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-3.5 text-left transition hover:bg-[#F5F5F5] sm:p-4"
              >
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#525252]">
                  <MessageCircle size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Live Chat</p>
                  <p className="mt-0.5 text-sm text-[#737373]">Open a support ticket</p>
                </div>
              </button>
            </div>
          </section>
        </aside>
      </div>

      <section className="dash-premium-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
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
          className="dash-premium-btn-primary !h-11"
        >
          Contact Support
        </UserButton>
      </section>

      {createOpen ? (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div
            className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[20px] border border-[#ECECEC] bg-white sm:rounded-[20px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-ticket-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ECECEC] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="create-ticket-title" className="text-lg font-semibold text-[#111111] sm:text-xl">Create New Ticket</h2>
                <p className="mt-1 text-sm text-[#737373]">Describe your issue and we&apos;ll get back to you soon.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#ECECEC] text-[#737373] hover:bg-[#FAFAFA]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
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

            <div className="flex shrink-0 flex-wrap justify-end gap-2.5 border-t border-[#ECECEC] bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-[#ECECEC] px-5 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA] sm:flex-none"
              >
                Cancel
              </button>
              <UserButton
                disabled={creating}
                onClick={() => void submitTicket()}
                className="h-11 flex-1 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] hover:bg-[#78C400] disabled:opacity-60 sm:flex-none"
              >
                {creating ? "Submitting…" : "Submit Ticket"}
              </UserButton>
            </div>
          </div>
        </div>
        </ViewportPortal>
      ) : null}

      {threadOpen && activeTicket ? (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div
            className="flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[20px] border border-[#ECECEC] bg-white shadow-xl sm:rounded-[20px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-thread-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ECECEC] px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                  #{activeTicket.ticketNumber}
                </p>
                <h2 id="ticket-thread-title" className="mt-1 truncate text-lg font-bold text-[#111111]">
                  {activeTicket.subject}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusUi(activeTicket.rawStatus).className}`}>
                    {statusUi(activeTicket.rawStatus).label}
                  </span>
                  {activeTicket.processStatus ? (
                    <span className="rounded-full border border-[#ECECEC] bg-[#FAFAFA] px-2.5 py-0.5 text-xs font-semibold text-[#525252]">
                      Stage: {activeTicket.processStatus}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setThreadOpen(false);
                  setActiveTicket(null);
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#ECECEC] text-[#737373] hover:bg-[#FAFAFA]"
                aria-label="Close conversation"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
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
                        ? "ml-4 bg-[#E8F7FF] text-[#111111] sm:ml-8"
                        : "mr-4 border border-[#ECECEC] bg-[#FAFAFA] text-[#111111] sm:mr-8"
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
              <div className="shrink-0 border-t border-[#ECECEC] bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
                <label className="block">
                  <span className="text-sm font-semibold text-[#111111]">Your reply</span>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-[14px] border border-[#ECECEC] px-3 py-2 text-sm outline-none focus:border-[#84D400]"
                    placeholder="Type your message…"
                  />
                </label>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <UserButton
                    variant="secondary"
                    onClick={() => setThreadOpen(false)}
                    className="h-11 flex-1 rounded-2xl sm:flex-none"
                  >
                    Close
                  </UserButton>
                  <UserButton
                    onClick={() => void sendReply()}
                    disabled={replying || !replyText.trim()}
                    className="h-11 flex-1 rounded-2xl sm:flex-none"
                  >
                    {replying ? "Sending…" : "Send reply"}
                  </UserButton>
                </div>
              </div>
            ) : (
              <div className="shrink-0 border-t border-[#ECECEC] px-4 py-4 text-sm text-[#737373] sm:px-5">
                This ticket is {activeTicket.rawStatus}. Contact support if you need to reopen it.
              </div>
            )}
          </div>
        </div>
        </ViewportPortal>
      ) : null}
    </UserPanelPageShell>
  );
}
