"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, CirclePause, CreditCard, Download, RefreshCw, ShieldCheck } from "lucide-react";
import {
  formatBillingDate,
  formatPaise,
  type CustomerSubscriptionState,
} from "@/lib/billing/subscription-presentation";

const STATE_COPY: Record<CustomerSubscriptionState, { title: string; body: string; tone: string }> = {
  trial: { title: "Your AR360 trial is active", body: "Choose a paid plan before the trial ends to keep your products available.", tone: "border-sky-200 bg-sky-50 text-sky-950" },
  authorization_pending: { title: "Payment authorization is pending", body: "Razorpay has not confirmed your recurring-payment mandate yet. No paid access is assumed until confirmation.", tone: "border-amber-200 bg-amber-50 text-amber-950" },
  authorization_failed: { title: "Payment authorization failed", body: "Retry authorization or use another payment method to activate recurring billing.", tone: "border-red-200 bg-red-50 text-red-950" },
  active: { title: "Subscription active", body: "Your plan and recurring payment mandate are in good standing.", tone: "border-emerald-200 bg-emerald-50 text-emerald-950" },
  renewal_retry: { title: "We’re retrying your renewal", body: "Your latest debit failed. Update payment authorization before the grace period ends to avoid interruption.", tone: "border-amber-200 bg-amber-50 text-amber-950" },
  paused: { title: "Subscription paused", body: "Recurring debits and paid service are paused. Resume when you are ready.", tone: "border-amber-200 bg-amber-50 text-amber-950" },
  halted: { title: "Recurring billing halted", body: "Automatic retries have stopped. A new payment authorization may be required.", tone: "border-red-200 bg-red-50 text-red-950" },
  cancellation_scheduled: { title: "Cancellation scheduled", body: "Your paid access remains available until the current billing period ends.", tone: "border-amber-200 bg-amber-50 text-amber-950" },
  ended: { title: "Subscription ended", body: "Start a new checkout to restore paid access. A fresh recurring-payment consent is required.", tone: "border-slate-200 bg-slate-50 text-slate-950" },
  manual_enterprise: { title: "Enterprise contract billing", body: "This subscription is managed by your AR360 account team and is not changed through self-service billing.", tone: "border-violet-200 bg-violet-50 text-violet-950" },
};

export function SubscriptionStateBanner({ state }: { state: CustomerSubscriptionState }) {
  const copy = STATE_COPY[state];
  return (
    <section role={state === "active" ? "status" : "alert"} className={`rounded-[20px] border p-4 ${copy.tone}`}>
      <div className="flex gap-3">
        {state === "active" ? <CheckCircle2 aria-hidden size={20} /> : <AlertTriangle aria-hidden size={20} />}
        <div><h2 className="font-bold">{copy.title}</h2><p className="mt-1 text-sm opacity-80">{copy.body}</p></div>
      </div>
    </section>
  );
}

export function MandateStatus({ status }: { status?: string | null }) {
  const normalized = status || "not set";
  const healthy = normalized === "authorized";
  return (
    <article className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><ShieldCheck aria-hidden size={18} className={healthy ? "text-emerald-600" : "text-amber-600"} /><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#737373]">Recurring mandate</p><p className="mt-0.5 text-sm font-bold capitalize">{normalized.replaceAll("_", " ")}</p></div></div>
      <p className="mt-2 text-xs text-[#737373]">{healthy ? "Razorpay authorized for recurring debits." : "Authorization incomplete or needs attention."}</p>
    </article>
  );
}

export function NextDebit({ debit }: { debit: { dueAt: string; subtotalPaise: number; gstPaise: number; totalPaise: number; gstRate: number } | null }) {
  return (
    <article className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><CalendarClock aria-hidden size={18} className="text-[#84D400]" /><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#737373]">Next GST-inclusive debit</p><p className="mt-0.5 text-lg font-bold">{debit ? formatPaise(debit.totalPaise) : "No debit scheduled"}</p></div></div>
      {debit ? <p className="mt-2 text-xs text-[#737373]">Due {formatBillingDate(debit.dueAt)} · includes {formatPaise(debit.gstPaise)} GST ({debit.gstRate}%).</p> : null}
    </article>
  );
}

export function ChargeAttempts({ attempts }: { attempts: Array<{ payment_uid: string; status: string; amount_paise: number; failure_description?: string | null; created_at: string }> }) {
  return (
    <section className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <h2 className="font-bold">Charge attempts</h2>
      <div className="mt-2 divide-y divide-[#ECECEC]">
        {attempts.length ? attempts.map((attempt) => <div key={attempt.payment_uid} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm"><div><p className="font-semibold capitalize">{attempt.status}</p><p className="text-[#737373]">{attempt.failure_description || formatBillingDate(attempt.created_at)}</p></div><p className="font-bold">{formatPaise(attempt.amount_paise)}</p></div>) : <p className="py-4 text-sm text-[#737373]">No recurring charge attempts yet.</p>}
      </div>
    </section>
  );
}

export function PaymentRecovery({ retryAt, graceEndsAt, onRetry, busy, actionLabel = "Retry payment authorization" }: { retryAt?: string | null; graceEndsAt?: string | null; onRetry: () => void; busy: boolean; actionLabel?: string }) {
  return (
    <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
      <h2 className="font-bold text-amber-950">Restore recurring billing</h2>
      <p className="mt-1 text-sm text-amber-900">Next automatic retry: {formatBillingDate(retryAt)}. Grace ends: {formatBillingDate(graceEndsAt)}.</p>
      <button type="button" onClick={onRetry} disabled={busy} className="mt-3 inline-flex h-10 items-center gap-2 rounded-2xl bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-60"><RefreshCw aria-hidden size={16} />{busy ? "Opening…" : actionLabel}</button>
    </section>
  );
}

export function ScheduledChangePreview({ change }: { change: { change_type: string; from_plan_id: string; to_plan_id?: string | null; effective_at: string } }) {
  return <section className="rounded-[20px] border border-violet-200 bg-violet-50 p-4"><h2 className="font-bold text-violet-950">Scheduled change</h2><p className="mt-1 text-sm text-violet-900">{change.change_type === "cancellation" ? "Cancellation" : `${change.from_plan_id} → ${change.to_plan_id}`} takes effect {formatBillingDate(change.effective_at)}.</p></section>;
}

export function CancellationConfirmation({ effectiveAt }: { effectiveAt?: string | null }) {
  return <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-4"><h2 className="font-bold text-amber-950">Cancellation confirmed</h2><p className="mt-1 text-sm text-amber-900">Access remains active through {formatBillingDate(effectiveAt)}. Contact billing support if this was not intended.</p><Link href="/dashboard/support" className="mt-3 inline-flex h-10 items-center rounded-2xl border border-amber-300 bg-white px-4 text-sm font-semibold">Contact billing support</Link></section>;
}

export function LegacyRenewalAuthorization({ planId, period, authorized }: { planId: string; period: string; authorized: boolean }) {
  return <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-4"><h2 className="font-bold text-amber-950">Keep renewal uninterrupted</h2><p className="mt-1 text-sm text-amber-900">Your existing paid term is unchanged. Authorizing now does not charge you before that term ends.</p>{authorized ? <p className="mt-3 inline-flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 aria-hidden size={16} />Renewal authorized</p> : <Link href={`/dashboard/billing/checkout?plan=${encodeURIComponent(planId)}&period=${encodeURIComponent(period)}&renewal=1`} className="mt-3 inline-flex h-10 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000]"><CreditCard aria-hidden size={16} />Authorize renewal</Link>}</section>;
}

export function InvoiceDownloadLink({ invoiceUid, label }: { invoiceUid: string; label: string }) {
  return <a href={`/api/billing/invoices/${invoiceUid}/download?format=pdf`} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#111] px-4 text-xs font-bold text-white"><Download aria-hidden size={14} />{label}</a>;
}

export function PauseIndicator() {
  return <CirclePause aria-label="Paused" size={18} />;
}
