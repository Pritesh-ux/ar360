"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import ViewportPortal from "@/components/shared/ViewportPortal";

type Props = {
  open: boolean;
  productTitle: string;
  onClose: () => void;
  onSubmit: (input: { name: string; phone: string; email: string; message: string }) => Promise<void>;
};

export default function EnquireModal({ open, productTitle, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setMessage("");
    setError("");
    setSaving(false);
    setDone(false);
  }

  function close() {
    if (saving) return;
    onClose();
    window.setTimeout(reset, 200);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send enquiry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewportPortal open={open}>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="enquire-title"
          className="w-full max-w-md overflow-hidden rounded-t-[24px] border border-[#ECECEC] bg-white sm:rounded-[24px]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#ECECEC] px-5 py-4">
            <div>
              <h2 id="enquire-title" className="text-[16px] font-semibold text-[#111111]">
                Interested in this product?
              </h2>
              <p className="mt-1 text-[13px] font-medium text-[#737373]">{productTitle}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full text-[#737373] hover:bg-[#F5F5F5]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {done ? (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EEF9E0] text-[#5FA800]">
                <Check size={22} />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#111111]">Enquiry sent</p>
              <p className="mt-1 text-xs font-medium text-[#737373]">The seller will get back to you shortly.</p>
              <button
                type="button"
                onClick={close}
                className="mt-5 h-11 w-full rounded-2xl bg-[#84D400] text-sm font-semibold text-[#102000]"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-3 px-5 py-4">
              <label className="block text-[12px] font-semibold text-[#525252]">
                Name *
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-2xl border border-[#ECECEC] px-3 text-sm font-medium text-[#111111] outline-none focus:border-[#84D400]"
                  autoComplete="name"
                />
              </label>
              <label className="block text-[12px] font-semibold text-[#525252]">
                Phone *
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 h-11 w-full rounded-2xl border border-[#ECECEC] px-3 text-sm font-medium text-[#111111] outline-none focus:border-[#84D400]"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </label>
              <label className="block text-[12px] font-semibold text-[#525252]">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 w-full rounded-2xl border border-[#ECECEC] px-3 text-sm font-medium text-[#111111] outline-none focus:border-[#84D400]"
                  autoComplete="email"
                />
              </label>
              <label className="block text-[12px] font-semibold text-[#525252]">
                Message
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-[#ECECEC] px-3 py-2 text-sm font-medium text-[#111111] outline-none focus:border-[#84D400]"
                />
              </label>
              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={saving}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#84D400] text-[14px] font-bold text-[#102000] disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? "Sending…" : "Send Enquiry"}
              </button>
            </form>
          )}
        </div>
      </div>
    </ViewportPortal>
  );
}
