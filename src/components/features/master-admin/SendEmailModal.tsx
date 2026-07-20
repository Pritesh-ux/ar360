"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";

type TemplateOption = { id: string; label: string };

type Props = {
  open: boolean;
  saving?: boolean;
  templates?: TemplateOption[];
  onClose: () => void;
  onSent: (message: string) => void;
};

export default function SendEmailModal({ open, saving, templates = [], onClose, onSent }: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("custom");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo("");
    setSubject("");
    setBody("");
    setTemplate("custom");
    setError("");
  }, [open]);

  if (!open) return null;

  async function submit() {
    setError("");
    try {
      const res = await fetch("/api/master-admin/email-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      onSent(data.message || "Email sent.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-black text-slate-950">Send Email</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {error ? <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700">{error}</p> : null}

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Recipient</span>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Template</span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
            >
              {(templates.length ? templates : [{ id: "custom", label: "Custom message" }]).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Subject</span>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Message</span>
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <AdminButton type="button" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton type="button" variant="primary" disabled={saving} onClick={() => void submit()}>
            {saving ? "Sending..." : "Send Email"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
