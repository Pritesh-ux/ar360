"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BarChart3,
  Box,
  Building2,
  CheckCircle2,
  HardDrive,
  Headphones,
  Link2,
  QrCode,
  Share2,
  Shield,
  Sparkles,
  Users,
  Wifi,
  X,
  Code2,
  Palette,
  Server,
  Cuboid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type EnterpriseQuoteModalProps = {
  open: boolean;
  onClose: () => void;
  intent: "contact-sales" | "request-quote";
};

const FEATURES: ReadonlyArray<{
  name: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
}> = [
  { name: "needsMoreStorage", label: "More Storage", hint: "Larger asset library", Icon: HardDrive },
  { name: "needsMoreBandwidth", label: "More Bandwidth", hint: "Higher traffic volume", Icon: Wifi },
  { name: "needsMoreProducts", label: "More Products", hint: "Bigger catalog", Icon: Box },
  { name: "needsQr", label: "QR Codes", hint: "Print & packaging", Icon: QrCode },
  { name: "needsEmbed", label: "Embed Viewer", hint: "On your website", Icon: Code2 },
  { name: "needsShare", label: "Share Links", hint: "One-click sharing", Icon: Share2 },
  { name: "needsAr", label: "AR Experience", hint: "In-browser AR", Icon: Cuboid },
  { name: "needsCustomBranding", label: "Custom Branding", hint: "Your logo & colors", Icon: Palette },
  { name: "needsAnalytics", label: "Advanced Analytics", hint: "Usage insights", Icon: BarChart3 },
  { name: "needsTeamMembers", label: "Team Members", hint: "Multi-user access", Icon: Users },
  { name: "needsPrioritySupport", label: "Priority Support", hint: "Faster response", Icon: Headphones },
  { name: "needsDedicatedInfrastructure", label: "Dedicated Infra", hint: "Isolated hosting", Icon: Server },
  { name: "needsSla", label: "SLA", hint: "Uptime guarantees", Icon: Shield },
];

const BENEFITS = [
  "Custom limits tailored to your volume",
  "Dedicated sales + onboarding support",
  "Quote usually within 1 business day",
] as const;

const fieldClass =
  "peer mt-2 h-12 w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#84D400] focus:bg-white focus:ring-4 focus:ring-[#C9FF57]/35";

export default function EnterpriseQuoteModal({ open, onClose, intent }: EnterpriseQuoteModalProps) {
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>({});

  const close = useCallback(() => {
    setError("");
    setRequestId("");
    setSubmitting(false);
    setSelectedFeatures({});
    formRef.current?.reset();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open, submitting]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = String(formData.get(name) || "").trim();
      return value ? Number(value) : null;
    };
    const body = {
      companyName: formData.get("companyName"),
      contactName: formData.get("contactName"),
      businessEmail: formData.get("businessEmail"),
      phone: formData.get("phone"),
      companyWebsite: formData.get("companyWebsite"),
      country: formData.get("country"),
      industry: formData.get("industry"),
      expectedProducts: optionalNumber("expectedProducts"),
      expectedStorageGb: optionalNumber("expectedStorageGb"),
      expectedMonthlyBandwidthGb: optionalNumber("expectedMonthlyBandwidthGb"),
      additionalRequirements: formData.get("additionalRequirements"),
      websiteAddress: formData.get("websiteAddress"),
      source: `public-pricing:${intent}`,
      ...Object.fromEntries(FEATURES.map(({ name }) => [name, Boolean(selectedFeatures[name])])),
    };

    try {
      const response = await fetch("/api/enterprise/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; requestId?: string };
      if (!response.ok) {
        setError(result.error || "Unable to submit your request. Please try again.");
        return;
      }
      setRequestId(result.requestId || "");
      setSelectedFeatures({});
      formRef.current?.reset();
    } catch {
      setError("Unable to submit your request. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCount = Object.values(selectedFeatures).filter(Boolean).length;

  return createPortal(
    <div
      className="enterprise-request-modal fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) close();
      }}
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[6px]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 10%, rgba(201,255,87,0.22), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 80%, rgba(0,141,161,0.2), transparent 50%)",
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative grid max-h-[94vh] w-full max-w-5xl animate-[enterpriseModalIn_0.35s_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-[0_40px_100px_-20px_rgba(2,6,23,0.55)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.35fr)]"
      >
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 20% 15%, rgba(201,255,87,0.28), transparent 42%), radial-gradient(circle at 85% 70%, rgba(0,178,202,0.35), transparent 45%), linear-gradient(165deg, #0b1220 0%, #0f172a 55%, #082f33 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative flex h-full flex-col justify-between p-8 xl:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#C9FF57] backdrop-blur">
                <Sparkles size={13} strokeWidth={2.4} />
                Enterprise
              </div>
              <p className="mt-6 text-[2rem] font-black leading-[1.1] tracking-tight">
                Build AR at
                <span className="mt-1 block bg-gradient-to-r from-[#C9FF57] to-[#7DD3E8] bg-clip-text text-transparent">
                  your scale
                </span>
              </p>
              <p className="mt-4 max-w-xs text-sm font-medium leading-6 text-slate-300">
                Tell us your volume and must-have features. We&apos;ll craft a custom plan and follow up personally.
              </p>
              <ul className="mt-8 space-y-3.5">
                {BENEFITS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-semibold text-slate-200">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#C9FF57] text-slate-950">
                      <CheckCircle2 size={13} strokeWidth={2.6} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#C9FF57]/15 text-[#C9FF57]">
                  <Building2 size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Trusted by teams</p>
                  <p className="mt-0.5 text-sm font-black text-white">QR · Embed · Share · AR</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <div className="relative flex max-h-[94vh] flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_28%,#ffffff_100%)]">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-7 sm:py-5">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#6E9F00] lg:hidden">
                AR360 Enterprise
              </p>
              <h2 id={titleId} className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl lg:mt-0">
                Request a custom quote
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Sales follow-up · usually within one business day
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              aria-label="Close quote request"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </header>

          {requestId ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-[#C9FF57]/30 blur-xl" />
                <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#C9FF57] to-[#84D400] text-slate-950 shadow-lg shadow-lime-200/60">
                  <CheckCircle2 size={40} strokeWidth={2.2} />
                </div>
              </div>
              <h3 className="mt-7 text-2xl font-black text-slate-950">Request received</h3>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-600">
                Thanks. Our Enterprise team will contact you using the details you shared.
              </p>
              <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-sm font-black text-[#008DA1]">
                <Link2 size={15} />
                Request ID: {requestId}
              </p>
              <button
                type="button"
                onClick={close}
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-950 px-7 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Done
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                <FormSection
                  step="01"
                  title="Company & contact"
                  subtitle="So we know who to reach"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Company Name" name="companyName" required autoFocus />
                    <Field label="Contact Person" name="contactName" required autoComplete="name" />
                    <Field label="Business Email" name="businessEmail" type="email" required autoComplete="email" />
                    <Field label="Phone" name="phone" type="tel" required autoComplete="tel" />
                    <Field
                      label="Website"
                      name="companyWebsite"
                      type="text"
                      placeholder="example.com"
                      autoComplete="url"
                      maxLength={500}
                      optional
                    />
                    <Field label="Country" name="country" required autoComplete="country-name" />
                    <Field label="Industry" name="industry" required className="sm:col-span-2" />
                  </div>
                </FormSection>

                <FormSection
                  step="02"
                  title="Expected usage"
                  subtitle="Rough numbers help us size the plan"
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Products" name="expectedProducts" type="number" min="0" step="1" placeholder="e.g. 500" />
                    <Field label="Storage (GB)" name="expectedStorageGb" type="number" min="0" step="1" placeholder="e.g. 200" />
                    <Field
                      label="Bandwidth / mo (GB)"
                      name="expectedMonthlyBandwidthGb"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 1000"
                    />
                  </div>
                </FormSection>

                <FormSection
                  step="03"
                  title="Features you need"
                  subtitle={
                    selectedCount
                      ? `${selectedCount} selected — tap to toggle`
                      : "Select everything that matters"
                  }
                >
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {FEATURES.map(({ name, label, hint, Icon }) => {
                      const checked = Boolean(selectedFeatures[name]);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() =>
                            setSelectedFeatures((prev) => ({ ...prev, [name]: !prev[name] }))
                          }
                          aria-pressed={checked}
                          className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                            checked
                              ? "border-[#84D400] bg-[linear-gradient(135deg,rgba(201,255,87,0.22),rgba(201,255,87,0.06))] shadow-[0_0_0_1px_rgba(132,212,0,0.25)]"
                              : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                          }`}
                        >
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
                              checked
                                ? "bg-[#C9FF57] text-slate-950"
                                : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80"
                            }`}
                          >
                            <Icon size={18} strokeWidth={2.1} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black text-slate-900">{label}</span>
                            <span className="mt-0.5 block text-xs font-medium text-slate-500">{hint}</span>
                          </span>
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                              checked
                                ? "border-[#6E9F00] bg-[#84D400] text-slate-950"
                                : "border-slate-300 bg-white text-transparent"
                            }`}
                            aria-hidden="true"
                          >
                            <CheckCircle2 size={12} strokeWidth={3} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FormSection>

                <FormSection step="04" title="Anything else?" subtitle="Security, SSO, timeline, deployment…">
                  <textarea
                    name="additionalRequirements"
                    rows={3}
                    maxLength={10000}
                    placeholder="Share any requirements our sales team should know."
                    className={`${fieldClass} h-auto resize-y py-3.5 font-medium leading-6`}
                  />
                </FormSection>

                <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                  <label>
                    Leave this field empty
                    <input name="websiteAddress" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>

                {error ? (
                  <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="hidden text-xs font-semibold text-slate-400 sm:block">
                  No commitment · Custom pricing only
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#C9FF57] px-7 text-sm font-black text-slate-950 shadow-[0_12px_28px_-8px_rgba(132,212,0,0.55)] transition hover:-translate-y-0.5 hover:bg-[#b8f24a] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Request Quote"}
                    {!submitting ? <ArrowRight size={16} strokeWidth={2.5} /> : null}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>

      <style>{`
        @keyframes enterpriseModalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function FormSection({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white/70 p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-950 text-[11px] font-black text-[#C9FF57]">
          {step}
        </span>
        <div>
          <h4 className="text-sm font-black text-slate-950">{title}</h4>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  optional?: boolean;
  className?: string;
};

function Field({ label, name, required, optional, className = "", ...props }: FieldProps) {
  return (
    <label className={`block text-[13px] font-black text-slate-800 ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        {label}
        {required ? <span className="text-red-500">*</span> : null}
        {optional ? (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Optional
          </span>
        ) : null}
      </span>
      <input
        name={name}
        required={required}
        maxLength={props.type === "url" ? 500 : undefined}
        className={fieldClass}
        {...props}
      />
    </label>
  );
}
