"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";

type Props = {
  open: boolean;
  assigneeOptions: string[];
  saving?: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateTicketModal({ open, assigneeOptions, saving, onClose, onCreated }: Props) {
  const [customerUid, setCustomerUid] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("technical");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerUid("");
    setCustomerName("");
    setCustomerEmail("");
    setSubject("");
    setDescription("");
    setCategory("technical");
    setPriority("medium");
    setAssignedTo("");
    setError("");
  }, [open]);

  if (!open) return null;

  async function createTicket() {
    if (!customerName.trim() || !customerEmail.trim() || !subject.trim()) {
      setError("Customer name, email, and subject are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/master-admin/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerUid,
          customerName,
          customerEmail,
          subject,
          description,
          category,
          priority,
          assignedTo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Create failed.");
        return;
      }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-black text-slate-900">New Support Ticket</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <input
            value={customerUid}
            onChange={(e) => setCustomerUid(e.target.value)}
            placeholder="Customer UID (optional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
          />
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name *"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
          />
          <input
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="Customer email *"
            type="email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject *"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
            >
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
              <option value="account">Account</option>
              <option value="feature">Feature</option>
              <option value="other">Other</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
          >
            <option value="">Unassigned</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {error ? <p className="text-[12px] font-semibold text-red-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <AdminButton variant="secondary" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton disabled={saving || submitting} onClick={() => void createTicket()}>
            {submitting ? "Creating…" : "Create ticket"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
