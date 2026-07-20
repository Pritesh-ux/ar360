"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

type Props = {
  defaultSubject?: string;
  className?: string;
};

const TOPICS = [
  "Sales / demo",
  "Product support",
  "Enterprise pricing",
  "Partnership",
  "Other",
];

export default function ContactForm({ defaultSubject = "AR360 Studio inquiry", className = "" }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSubject(defaultSubject);
  }, [defaultSubject]);

  useEffect(() => {
    fetch("/api/customer/bootstrap", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        const customer = body.customer;
        if (customer?.name) setName((prev) => prev || customer.name);
        if (customer?.email) setEmail((prev) => prev || customer.email);
      })
      .catch(() => undefined);
  }, []);

  function selectTopic(value: string) {
    setTopic(value);
    if (!subject || subject === defaultSubject || TOPICS.some((t) => subject.startsWith(t))) {
      setSubject(`${value} — AR360 inquiry`);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error || "Unable to send message.");
        return;
      }

      setStatusTone("success");
      setStatus(
        data.delivered
          ? "Message sent. We will reply within one business day."
          : "Message logged for delivery — SMTP is not configured yet.",
      );
      setMessage("");
    } catch {
      setStatusTone("error");
      setStatus("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-5 ${className}`.trim()}>
      <div>
        <span className="mb-2 block text-[13px] font-bold text-[#4B5563]">Topic</span>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((item) => {
            const active = topic === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => selectTopic(item)}
                className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[12px] font-bold transition ${
                  active
                    ? "border-[#0A0B14] bg-[#0A0B14] text-white"
                    : "border-[#E5E7EB] bg-white text-[#4B5563] hover:border-[#D1D5DB] hover:text-[#0A0B14]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="contact-name">
          <input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Your full name"
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor="contact-email">
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Subject" htmlFor="contact-subject">
        <input
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="How can we help?"
          className={inputClass}
        />
      </Field>

      <Field label="Message" htmlFor="contact-message">
        <textarea
          id="contact-message"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          placeholder="Tell us about your use case, team size, or issue…"
          className={`${inputClass} min-h-[150px] resize-y py-3`}
        />
        <span className="mt-1.5 block text-right text-[11px] font-medium text-[#9CA3AF]">
          {message.length} characters
        </span>
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#B9FF2C] px-6 text-[14px] font-bold text-[#0A0B14] transition hover:scale-[1.01] hover:bg-[#A7F11D] disabled:opacity-60 sm:w-auto"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={2.25} />}
        {loading ? "Sending…" : "Send message"}
      </button>

      {status ? (
        <p
          role="status"
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3.5 text-[13px] font-semibold ${
            statusTone === "success"
              ? "border border-[#D4F5A0] bg-[#F4FFE5] text-[#3D6600]"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {statusTone === "success" ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          ) : null}
          {status}
        </p>
      ) : null}
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 text-[14px] font-medium text-[#0A0B14] outline-none transition placeholder:text-[#A1A1AA] focus:border-[#B9FF2C] focus:bg-white focus:shadow-[0_0_0_3px_rgba(185,255,44,0.28)]";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-bold text-[#4B5563]">
        {label}
      </label>
      {children}
    </div>
  );
}
