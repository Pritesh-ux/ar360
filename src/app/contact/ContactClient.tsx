"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Clock,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import ContactForm from "@/components/shared/ContactForm";

const display = "font-[family-name:var(--font-auth-display)]";

const CONTACT_CHANNELS = [
  {
    title: "Sales & demos",
    description: "Enterprise plans, volume pricing, and product walkthroughs.",
    email: "sales@ar360.studio",
    icon: MessageCircle,
    accent: "bg-[#B9FF2C]/20 text-[#3D6600]",
  },
  {
    title: "Product support",
    description: "Help with uploads, billing, QR codes, and account access.",
    email: "support@ar360.studio",
    icon: Headphones,
    accent: "bg-[#0A0B14]/6 text-[#0A0B14]",
  },
  {
    title: "Office",
    description: "AR360 Studio · India (remote-first team)",
    email: null as string | null,
    icon: MapPin,
    accent: "bg-[#EEF0F2] text-[#4B5563]",
  },
];

export default function ContactClient() {
  const search = useSearchParams();
  const defaultSubject = search.get("subject") || "AR360 Studio inquiry";

  return (
    <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-6 md:pb-20 md:pt-32">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#84D400]">Contact</p>

      <div className="mt-2.5 grid gap-8 lg:grid-cols-[0.95fr_1.15fr] lg:items-stretch lg:gap-12">
        <div className="flex h-full flex-col">
          <h1
            className={`${display} text-[1.5rem] font-bold leading-snug tracking-tight text-[#0A0B14] sm:text-[1.75rem]`}
          >
            Talk to the AR360 team
          </h1>
          <p className="mt-2.5 max-w-md text-[13px] font-medium leading-relaxed text-[#6B7280]">
            Questions about plans, onboarding, or product support? Send a message — we reply within
            one business day.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] bg-white px-3 py-1.5 text-[11px] font-bold text-[#374151]">
              <Clock size={12} className="text-[#84D400]" />
              1 business day SLA
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EAED] bg-white px-3 py-1.5 text-[11px] font-bold text-[#374151]">
              <ShieldCheck size={12} className="text-[#84D400]" />
              No spam · Direct inbox
            </span>
          </div>

          <div className="mt-7 space-y-0 border-t border-[#E8EAED]">
            {CONTACT_CHANNELS.map((item) => (
              <article
                key={item.title}
                className="group flex gap-3.5 border-b border-[#E8EAED] py-4 last:border-b-0"
              >
                <div
                  className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl transition group-hover:scale-[1.03] ${item.accent}`}
                >
                  <item.icon size={18} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-bold text-[#0A0B14]">{item.title}</h2>
                  <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-[#6B7280]">
                    {item.description}
                  </p>
                  {item.email ? (
                    <a
                      href={`mailto:${item.email}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#3D6600] transition hover:text-[#0A0B14]"
                    >
                      <Mail size={13} />
                      {item.email}
                    </a>
                  ) : (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#4B5563]">
                      <Building2 size={13} />
                      Remote-first · India
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex min-h-0 flex-1 flex-col justify-end overflow-hidden rounded-[22px] bg-[#0A0B14] p-5 text-white sm:p-6">
            <div>
              <p className="text-[14px] font-bold">Already a customer?</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-white/65">
                For billing or subscription issues, open a ticket from your dashboard — faster than
                email.
              </p>
              <Link
                href="/dashboard/support"
                className="mt-3.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#B9FF2C] px-4 text-[12px] font-bold text-[#0A0B14] transition hover:bg-[#A7F11D]"
              >
                Go to Support
                <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>

        <section className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[#E8EAED] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B9FF2C]/25 blur-3xl"
            aria-hidden
          />
          <div className="relative flex h-full flex-col">
            <h2 className={`${display} text-lg font-bold tracking-tight text-[#0A0B14] sm:text-xl`}>
              Send a message
            </h2>
            <p className="mt-1 text-[12px] font-medium text-[#6B7280]">
              Tell us what you need — sales, support, or a product demo.
            </p>
            <ContactForm defaultSubject={defaultSubject} className="mt-5 flex flex-1 flex-col" />
          </div>
        </section>
      </div>
    </div>
  );
}
