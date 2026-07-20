"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Mail, Paperclip, Send, X } from "lucide-react";
import { AdminButton, AdminInput } from "@/components/ui/admin";

export type ComposeMailAttachmentOption = {
  id: string;
  label: string;
  kind: "quote" | "invoice";
  requestUid: string;
  quoteUid?: string;
  paymentUid?: string;
};

export type ComposeMailDefaults = {
  to?: string;
  subject?: string;
  text?: string;
  paymentLink?: string;
  phone?: string | null;
  requestUid?: string | null;
  customerUid?: string | null;
  attachments?: ComposeMailAttachmentOption[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaults?: ComposeMailDefaults | null;
};

function whatsappUrl(phone: string | null | undefined, message: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export default function AdminComposeMailModal({ open, onClose, defaults }: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo(defaults?.to || "");
    setSubject(defaults?.subject || "");
    setText(defaults?.text || "");
    setPaymentLink(defaults?.paymentLink || "");
    setSelectedAttachmentIds([]);
    setMessage("");
    setError("");
  }, [open, defaults]);

  const attachmentOptions = defaults?.attachments || [];
  const wa = useMemo(() => {
    const preview = [
      subject ? `*${subject}*` : "AR360 update",
      text || "",
      paymentLink ? `Payment link: ${paymentLink}` : "",
    ].filter(Boolean).join("\n\n");
    return whatsappUrl(defaults?.phone, preview);
  }, [defaults?.phone, subject, text, paymentLink]);

  if (!open) return null;

  async function sendMail() {
    setSending(true);
    setError("");
    setMessage("");
    try {
      const selected = attachmentOptions.filter((item) => selectedAttachmentIds.includes(item.id));
      const quote = selected.find((item) => item.kind === "quote");
      const invoice = selected.find((item) => item.kind === "invoice");
      const response = await fetch("/api/master-admin/compose-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          text,
          paymentLink: paymentLink || null,
          requestUid: defaults?.requestUid || null,
          customerUid: defaults?.customerUid || null,
          attachQuote: quote
            ? { requestUid: quote.requestUid, quoteUid: quote.quoteUid }
            : null,
          attachInvoice: invoice
            ? { requestUid: invoice.requestUid, paymentUid: invoice.paymentUid }
            : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Send failed");
      setMessage(
        data.delivered
          ? `Mail sent (${data.mode}).`
          : `Mail queued in ${data.mode} mode — check SMTP/Resend settings if needed.`,
      );
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 bg-slate-900/45" aria-label="Close compose" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0FBD9] text-[#4D9A00]">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-base font-black text-slate-900">Compose mail</p>
              <p className="text-xs font-medium text-slate-500">Manual email with quote / invoice / payment link</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <label className="block text-[11px] font-bold text-slate-500">
            To
            <AdminInput className="mt-1" value={to} onChange={(event) => setTo(event.target.value)} placeholder="customer@email.com" />
          </label>
          <label className="block text-[11px] font-bold text-slate-500">
            Subject
            <AdminInput className="mt-1" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
          </label>
          <label className="block text-[11px] font-bold text-slate-500">
            Message
            <textarea
              className="mt-1 min-h-40 w-full rounded-xl border border-slate-200 p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#A6FF2E]"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write your message…"
            />
          </label>
          <label className="block text-[11px] font-bold text-slate-500">
            Payment link (optional)
            <div className="mt-1 flex gap-2">
              <AdminInput value={paymentLink} onChange={(event) => setPaymentLink(event.target.value)} placeholder="https://…" />
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400"><Link2 size={16} /></span>
            </div>
          </label>

          {attachmentOptions.length > 0 ? (
            <div>
              <p className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <Paperclip size={12} /> Attach
              </p>
              <div className="space-y-2">
                {attachmentOptions.map((option) => {
                  const checked = selectedAttachmentIds.includes(option.id);
                  return (
                    <label key={option.id} className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedAttachmentIds((current) => {
                            if (current.includes(option.id)) return current.filter((id) => id !== option.id);
                            // one of each kind for simplicity
                            const withoutKind = current.filter((id) => {
                              const other = attachmentOptions.find((item) => item.id === id);
                              return other?.kind !== option.kind;
                            });
                            return [...withoutKind, option.id];
                          });
                        }}
                      />
                      <span>
                        <span className="font-black uppercase text-slate-400">{option.kind}</span>
                        <br />
                        {option.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800">{message}</p> : null}
          {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-800">{error}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-[12px] font-black text-slate-700 hover:bg-slate-50"
            >
              WhatsApp
            </a>
          ) : null}
          <AdminButton variant="primary" disabled={sending || !to || !subject || !text} onClick={() => void sendMail()}>
            <span className="inline-flex items-center gap-1"><Send size={14} /> {sending ? "Sending…" : "Send email"}</span>
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
