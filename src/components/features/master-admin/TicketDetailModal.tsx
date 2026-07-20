"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";

type TicketMessage = {
  id: number;
  authorType: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type TicketDetail = {
  id: string;
  ticketNumber: string;
  customerUid?: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  categoryLabel: string;
  priority: string;
  rawPriority: string;
  status: string;
  rawStatus: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  open: boolean;
  ticketId: string | null;
  assigneeOptions: string[];
  saving?: boolean;
  onClose: () => void;
  onSaved: (message?: string) => void;
};

export default function TicketDetailModal({
  open,
  ticketId,
  assigneeOptions,
  saving,
  onClose,
  onSaved,
}: Props) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !ticketId) return;
    setLoading(true);
    setError("");
    void fetch(`/api/master-admin/support-tickets/${ticketId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load ticket");
        setTicket(data.ticket);
        setMessages(data.messages || []);
        setStatus(data.ticket.rawStatus || "open");
        setPriority(data.ticket.rawPriority || "medium");
        setAssignedTo(data.ticket.assignedTo === "Unassigned" ? "" : data.ticket.assignedTo);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load ticket"))
      .finally(() => setLoading(false));
  }, [open, ticketId]);

  if (!open) return null;

  async function save() {
    if (!ticketId || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/master-admin/support-tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          priority,
          assignedTo: assignedTo || "Unassigned",
          reply,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setReply("");
      const emailNote =
        data.email && typeof data.email === "object" && "delivered" in data.email
          ? data.email.delivered
            ? "Reply saved and email sent to customer."
            : "Reply saved. Email was logged (SMTP may not be configured)."
          : "Ticket updated.";
      onSaved(emailNote);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {ticket?.ticketNumber || "Ticket"}
            </p>
            <h2 className="text-xl font-black text-slate-950">{ticket?.subject || "Support Ticket"}</h2>
            {ticket ? (
              <p className="mt-1 text-[13px] font-semibold text-slate-500">
                {ticket.customerUid ? (
                  <Link
                    href={`/master-admin/customers/${encodeURIComponent(ticket.customerUid)}`}
                    className="text-[#3D6600] hover:underline"
                  >
                    {ticket.customerName}
                  </Link>
                ) : (
                  ticket.customerName
                )}
                {" · "}
                {ticket.customerEmail}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {loading ? <p className="text-[13px] font-semibold text-slate-400">Loading ticket...</p> : null}
          {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700">{error}</p> : null}

          {ticket ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-slate-500">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-slate-500">Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-slate-500">Assigned To</span>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
                  >
                    <option value="">Unassigned</option>
                    {assigneeOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase text-slate-500">Original request</p>
                <p className="mt-2 text-[13px] font-medium text-slate-700">{ticket.description || "—"}</p>
                <p className="mt-2 text-[11px] font-semibold text-slate-400">
                  {ticket.categoryLabel} · Created {fmtDateTime(ticket.createdAt)}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase text-slate-500">Conversation</p>
                {messages.length === 0 ? (
                  <p className="text-[13px] font-semibold text-slate-400">No messages yet.</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="rounded-2xl border border-slate-100 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-bold text-slate-800">{msg.authorName}</p>
                        <p className="text-[11px] font-semibold text-slate-400">{fmtDateTime(msg.createdAt)}</p>
                      </div>
                      <p className="text-[13px] font-medium text-slate-600">{msg.body}</p>
                    </div>
                  ))
                )}
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase text-slate-500">Reply</span>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium"
                  placeholder="Write a reply to the customer..."
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-6">
          <AdminButton type="button" onClick={onClose}>
            Close
          </AdminButton>
          <AdminButton type="button" variant="primary" disabled={saving || loading || submitting || !ticket} onClick={() => void save()}>
            {saving || submitting ? "Saving..." : "Save Changes"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
