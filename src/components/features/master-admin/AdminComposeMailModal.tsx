"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
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
  /** Pre-checked attachment ids when the compose drawer opens. */
  selectedAttachmentIds?: string[];
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
  const [portalReady, setPortalReady] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Client-only portal mount gate (SSR-safe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useDeferredEffect(() => {
    if (!open) return;
    setTo(defaults?.to || "");
    setSubject(defaults?.subject || "");
    setText(defaults?.text || "");
    setPaymentLink(defaults?.paymentLink || "");
    setSelectedAttachmentIds(defaults?.selectedAttachmentIds || []);
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

  if (!open || !portalReady) return null;

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

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compose mail"
        className="flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F0FBD9] text-[#4D9A00]">
              <Mail size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-slate-900">Compose mail</p>
              <p className="truncate text-xs font-medium text-slate-500">
                Quote / invoice / payment link
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
            aria-label="Close compose"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-5 py-4">
          <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            To
            <AdminInput
              className="w-full"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="customer@email.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Subject
            <AdminInput
              className="w-full"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Message
            <textarea
              className="min-h-[320px] max-h-[min(55dvh,480px)] w-full resize-y rounded-xl border border-slate-200 p-3 text-[13px] font-semibold leading-relaxed text-slate-800 outline-none transition focus:border-[var(--color-primary-hover)] focus:bg-white"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write your message…"
              rows={16}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Payment link (optional)
            <div className="flex gap-2">
              <AdminInput
                className="w-full"
                value={paymentLink}
                onChange={(event) => setPaymentLink(event.target.value)}
                placeholder="https://…"
              />
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50/30 text-slate-400">
                <Link2 size={15} />
              </span>
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
                    <label
                      key={option.id}
                      className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedAttachmentIds((current) => {
                            if (current.includes(option.id)) {
                              return current.filter((id) => id !== option.id);
                            }
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

          {message ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800">{message}</p>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-800">{error}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-[12px] font-black text-slate-700 hover:bg-slate-50"
            >
              WhatsApp
            </a>
          ) : null}
          <AdminButton
            variant="primary"
            disabled={sending || !to || !subject || !text}
            onClick={() => void sendMail()}
          >
            <span className="inline-flex items-center gap-1">
              <Send size={14} /> {sending ? "Sending…" : "Send email"}
            </span>
          </AdminButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
