"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  CreditCard,
  Download,
  FileText,
  Mail,
  Pause,
  Play,
  UserRound,
} from "lucide-react";
import {
  AdminButton,
  AdminInput,
} from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import { formatQuoteDate } from "@/lib/enterprise-sales/quote-dates";
import { DEFAULT_ENTERPRISE_QUOTE_TERMS } from "@/lib/enterprise-sales/quote-terms";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import type {
  EnterpriseCustomPlan,
  EnterpriseRequestDetail,
} from "@/lib/enterprise-sales/types";

type Assignee = { id: number; name: string };
type MutateFn = (path: string, method: "PATCH" | "POST", body: object, success: string) => Promise<boolean>;
type FulfillStep = 1 | 2 | 3 | 4;

function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

function toPaise(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function bytesFromGb(value: string) {
  const gb = Number(value);
  return value === "" || !Number.isFinite(gb) ? null : Math.round(gb * 1024 ** 3);
}

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function deriveStep(request: EnterpriseRequestDetail): FulfillStep {
  const sub = request.billSummary?.subscriptionStatus;
  if (request.status === "active" || sub === "active" || sub === "paused") return 4;
  if (request.quotes.length > 0) return 3;
  if (request.status === "new") return 1;
  return 2;
}

function stepComplete(request: EnterpriseRequestDetail, step: FulfillStep): boolean {
  if (step === 1) return request.status !== "new";
  if (step === 2) return request.quotes.length > 0;
  if (step === 3) {
    return (
      request.status === "active"
      || request.billSummary?.subscriptionStatus === "active"
      || request.billSummary?.subscriptionStatus === "paused"
      || (request.billSummary?.paidPaise || 0) > 0
    );
  }
  return (
    request.status === "active"
    || request.billSummary?.subscriptionStatus === "active"
    || request.billSummary?.subscriptionStatus === "paused"
  );
}

const STEPS: Array<{ id: FulfillStep; label: string; hint: string }> = [
  { id: 1, label: "Contact", hint: "Assign & mark contacted" },
  { id: 2, label: "Quote", hint: "Limits, price, PDF" },
  { id: 3, label: "Payment", hint: "Full or installments" },
  { id: 4, label: "Activated", hint: "Customer & dues" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <div className="mt-1 text-[13px] font-semibold text-[#111827]">{value || "—"}</div>
    </div>
  );
}

function gbFromBytes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return String(Math.round((Number(value) / 1024 ** 3) * 1000) / 1000);
}

function draftFromCustomPlan(plan: EnterpriseCustomPlan, fallbackName: string) {
  return {
    name: plan.name || fallbackName,
    billingCycle: plan.billingCycle || "monthly",
    price: String((plan.pricePaise || 0) / 100),
    storageGb: gbFromBytes(plan.storageLimitBytes),
    bandwidthGb: gbFromBytes(plan.bandwidthLimitBytes),
    productLimit: plan.productLimit == null ? "" : String(plan.productLimit),
    teamMemberLimit: plan.teamMemberLimit == null ? "" : String(plan.teamMemberLimit),
    allowViewer: plan.allowViewer !== false,
    allowUpload: plan.allowUpload !== false,
    allowObjectCapture: plan.allowObjectCapture !== false,
    allowAr: plan.allowAr !== false,
    allowQr: plan.allowQr !== false,
    allowShare: plan.allowShare !== false,
    allowEmbed: plan.allowEmbed !== false,
    customBranding: Boolean(plan.customBranding),
    allowCustomDomain: Boolean(plan.allowCustomDomain),
    advancedAnalytics: Boolean(plan.advancedAnalytics),
    prioritySupport: Boolean(plan.prioritySupport),
    dedicatedInfrastructure: Boolean(plan.dedicatedInfrastructure),
    slaSupport: Boolean(plan.slaSupport),
    reusePlanUid: plan.customPlanUid,
  };
}

export default function EnterpriseFulfillWizard({
  request,
  assignees,
  customPlans,
  canManage,
  saving,
  onMutate,
  onRefresh,
  onError,
  onSuccess,
  onComposeMail,
  lifecycleAction,
  lifecycleReason,
  onLifecycleActionChange,
  onLifecycleReasonChange,
  onConfirmLifecycle,
}: {
  request: EnterpriseRequestDetail;
  assignees: Assignee[];
  customPlans: EnterpriseCustomPlan[];
  canManage: boolean;
  saving: boolean;
  onMutate: MutateFn;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onComposeMail: () => void;
  lifecycleAction: "pause" | "resume" | null;
  lifecycleReason: string;
  onLifecycleActionChange: (action: "pause" | "resume" | null) => void;
  onLifecycleReasonChange: (reason: string) => void;
  onConfirmLifecycle: () => void;
}) {
  const suggested = deriveStep(request);
  const [step, setStep] = useState<FulfillStep>(suggested);
  const [assignee, setAssignee] = useState(
    request.assignedAdminId ? String(request.assignedAdminId) : "",
  );
  const [contactNote, setContactNote] = useState("");
  const [busy, setBusy] = useState(false);

  const finalQuote = useMemo(() => {
    if (!request.quotes.length) return null;
    const active = request.quotes.find((quote) => ["sent", "accepted", "draft"].includes(quote.status));
    return active || request.quotes[0];
  }, [request.quotes]);

  const livePlanUid =
    request.linkedCustomPlan?.customPlanUid
    || request.contracts.find((contract) => contract.status === "active")?.customPlanUid
    || finalQuote?.customPlanUid
    || "";
  const dealAlreadyLive =
    request.status === "active"
    || request.billSummary?.subscriptionStatus === "active"
    || request.billSummary?.subscriptionStatus === "paused"
    || request.contracts.some((contract) => contract.status === "active");

  const [quoteDraft, setQuoteDraft] = useState({
    name: `${request.companyName} Enterprise`,
    billingCycle: "monthly",
    price: "",
    storageGb: request.expectedStorageGb != null ? String(request.expectedStorageGb) : "",
    bandwidthGb: request.expectedMonthlyBandwidthGb != null ? String(request.expectedMonthlyBandwidthGb) : "",
    productLimit: request.expectedProducts != null ? String(request.expectedProducts) : "",
    teamMemberLimit: "",
    customBranding: request.needsCustomBranding,
    allowCustomDomain: false,
    allowViewer: true,
    allowUpload: true,
    allowAr: request.needsAr,
    allowQr: request.needsQr,
    allowShare: request.needsShare,
    allowEmbed: request.needsEmbed,
    allowObjectCapture: true,
    advancedAnalytics: request.needsAnalytics,
    prioritySupport: request.needsPrioritySupport,
    dedicatedInfrastructure: request.needsDedicatedInfrastructure,
    slaSupport: request.needsSla,
    validUntil: defaultValidUntil(),
    terms: DEFAULT_ENTERPRISE_QUOTE_TERMS,
    reusePlanUid: "",
  });

  const remainingPaise = finalQuote?.remainingPaise ?? finalQuote?.pricePaise ?? 0;
  const [payShape, setPayShape] = useState<"full" | "installments">("full");
  const [partCount, setPartCount] = useState(2);
  const [customParts, setCustomParts] = useState<string[]>(["", ""]);
  const [payMode, setPayMode] = useState<"received" | "razorpay" | "bank_link">("received");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionId, setTransactionId] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [emailProspect, setEmailProspect] = useState(false);

  useDeferredEffect(() => {
    setStep(suggested);
  }, [suggested, request.requestUid]);

  useDeferredEffect(() => {
    setAssignee(request.assignedAdminId ? String(request.assignedAdminId) : "");
  }, [request.assignedAdminId]);

  useDeferredEffect(() => {
    const linked = request.linkedCustomPlan;
    if (!linked) return;
    setQuoteDraft((current) => ({
      ...current,
      ...draftFromCustomPlan(linked, current.name),
      validUntil: current.validUntil || finalQuote?.validUntil?.slice?.(0, 10) || defaultValidUntil(),
      terms:
        !current.terms.trim() || current.terms === DEFAULT_ENTERPRISE_QUOTE_TERMS
          ? (finalQuote?.terms?.trim() || DEFAULT_ENTERPRISE_QUOTE_TERMS)
          : current.terms,
    }));
  }, [request.linkedCustomPlan?.customPlanUid, request.requestUid]);

  useDeferredEffect(() => {
    if (!finalQuote || request.linkedCustomPlan) return;
    setQuoteDraft((current) => {
      const termsUntouched =
        !current.terms.trim() || current.terms === DEFAULT_ENTERPRISE_QUOTE_TERMS;
      return {
        ...current,
        price: current.price || String(finalQuote.pricePaise / 100),
        billingCycle: finalQuote.billingCycle || current.billingCycle,
        reusePlanUid: current.reusePlanUid || finalQuote.customPlanUid || "",
        terms: termsUntouched
          ? (finalQuote.terms?.trim() || DEFAULT_ENTERPRISE_QUOTE_TERMS)
          : current.terms,
      };
    });
  }, [finalQuote, request.linkedCustomPlan]);

  const installmentAmountsPaise = useMemo(() => {
    if (payShape === "full") return remainingPaise > 0 ? [remainingPaise] : [];
    if (customParts.some((part) => part.trim() !== "")) {
      return customParts.map((part) => toPaise(part)).filter((value) => value > 0);
    }
    if (remainingPaise <= 0 || partCount < 2) return [];
    const base = Math.floor(remainingPaise / partCount);
    const parts = Array.from({ length: partCount }, () => base);
    parts[0] += remainingPaise - base * partCount;
    return parts.filter((value) => value > 0);
  }, [payShape, remainingPaise, partCount, customParts]);

  async function buildPlanPayload() {
    return {
      name: quoteDraft.name.trim() || `${request.companyName} Enterprise`,
      billingCycle: quoteDraft.billingCycle,
      pricePaise: toPaise(quoteDraft.price),
      storageLimitBytes: bytesFromGb(quoteDraft.storageGb),
      bandwidthLimitBytes: bytesFromGb(quoteDraft.bandwidthGb),
      productLimit: quoteDraft.productLimit === "" ? null : Number(quoteDraft.productLimit),
      teamMemberLimit: quoteDraft.teamMemberLimit === "" ? null : Number(quoteDraft.teamMemberLimit),
      customBranding: quoteDraft.customBranding,
      allowCustomDomain: quoteDraft.allowCustomDomain,
      allowViewer: quoteDraft.allowViewer,
      allowUpload: quoteDraft.allowUpload,
      allowAr: quoteDraft.allowAr,
      allowQr: quoteDraft.allowQr,
      allowShare: quoteDraft.allowShare,
      allowEmbed: quoteDraft.allowEmbed,
      allowObjectCapture: quoteDraft.allowObjectCapture,
      advancedAnalytics: quoteDraft.advancedAnalytics,
      prioritySupport: quoteDraft.prioritySupport,
      dedicatedInfrastructure: quoteDraft.dedicatedInfrastructure,
      slaSupport: quoteDraft.slaSupport,
    };
  }

  async function ensurePlanUid(): Promise<string | null> {
    if (quoteDraft.reusePlanUid) return quoteDraft.reusePlanUid;
    const planRes = await fetch(
      `/api/master-admin/enterprise-requests/${encodeURIComponent(request.requestUid)}/plans`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await buildPlanPayload()),
      },
    );
    const planData = await planRes.json().catch(() => ({}));
    if (!planRes.ok) {
      onError(typeof planData.error === "string" ? planData.error : "Unable to create plan for quote.");
      return null;
    }
    const planUid = String(planData.customPlanUid);
    setQuoteDraft((current) => ({ ...current, reusePlanUid: planUid }));
    return planUid;
  }

  async function patchPlanFeatures(planUid: string): Promise<boolean> {
    if (!quoteDraft.price || toPaise(quoteDraft.price) <= 0) {
      onError("Price is required to update the live plan.");
      return false;
    }
    const res = await fetch(
      `/api/master-admin/enterprise-requests/${encodeURIComponent(request.requestUid)}/plans/${encodeURIComponent(planUid)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await buildPlanPayload()),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(typeof data.error === "string" ? data.error : "Unable to update live plan features.");
      return false;
    }
    return true;
  }

  async function updateLivePlanFeatures() {
    const planUid = livePlanUid || quoteDraft.reusePlanUid;
    if (!planUid) {
      onError("No linked custom plan yet — save a quote first, or use Update after payment.");
      return;
    }
    setBusy(true);
    try {
      const ok = await patchPlanFeatures(planUid);
      if (!ok) return;
      await onRefresh();
      onSuccess("Live plan features updated — customer entitlements apply on next page load.");
    } finally {
      setBusy(false);
    }
  }

  async function saveContact(markContacted: boolean) {
    if (assignee !== (request.assignedAdminId ? String(request.assignedAdminId) : "")) {
      const ok = await onMutate(
        "assignment",
        "PATCH",
        { assignedAdminId: assignee || null },
        "Assignment updated.",
      );
      if (!ok) return;
    }
    if (contactNote.trim()) {
      const ok = await onMutate("notes", "POST", { note: contactNote.trim() }, "Note added.");
      if (!ok) return;
      setContactNote("");
    }
    if (markContacted && request.status === "new") {
      const ok = await onMutate("status", "PATCH", { status: "contacted" }, "Marked contacted.");
      if (!ok) return;
    }
    setStep(2);
  }

  async function createQuoteVersion(emailPdf: boolean, download: boolean) {
    if (!quoteDraft.price || !quoteDraft.validUntil) {
      onError("Quote price and valid-until date are required.");
      return;
    }
    setBusy(true);
    try {
      const planUid = await ensurePlanUid();
      if (!planUid) return;

      const quoteRes = await fetch(
        `/api/master-admin/enterprise-requests/${encodeURIComponent(request.requestUid)}/quotes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customPlanUid: planUid,
            billingCycle: quoteDraft.billingCycle,
            pricePaise: toPaise(quoteDraft.price),
            validUntil: quoteDraft.validUntil,
            terms: quoteDraft.terms || null,
            emailProspect: emailPdf,
          }),
        },
      );
      const quoteData = await quoteRes.json().catch(() => ({}));
      if (!quoteRes.ok) {
        onError(typeof quoteData.error === "string" ? quoteData.error : "Quote create failed.");
        return;
      }
      await patchPlanFeatures(planUid);
      await onRefresh();
      onSuccess(
        emailPdf
          ? "Quote PDF emailed; plan features saved."
          : download
            ? "Quote saved; plan features updated — downloading PDF."
            : "Quote saved; plan features updated.",
      );
      if (download && quoteData.quoteUid) {
        window.open(
          `/api/master-admin/enterprise-requests/${encodeURIComponent(request.requestUid)}/quotes/${encodeURIComponent(quoteData.quoteUid)}/download`,
          "_blank",
        );
      }
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function collectPayment() {
    if (!finalQuote || installmentAmountsPaise.length === 0) return;
    const total = installmentAmountsPaise.reduce((sum, value) => sum + value, 0);
    if (payShape === "installments" && total !== remainingPaise) {
      onError(`Installment parts must total ${formatMoney(remainingPaise)} (now ${formatMoney(total)}).`);
      return;
    }
    if (payMode === "bank_link" && emailProspect && !paymentLink.trim()) {
      onError("Bank / UPI payment link required when emailing the prospect.");
      return;
    }

    for (let index = 0; index < installmentAmountsPaise.length; index += 1) {
      const amountPaise = installmentAmountsPaise[index];
      const isFirst = index === 0;
      const createRazorpayLink = payMode === "razorpay" && isFirst;
      // Cash/UPI: settle first installment (or the single full payment) immediately.
      const settleNow = payMode === "received" && isFirst;
      const ok = await onMutate(
        "payments",
        "POST",
        {
          quoteUid: finalQuote.quoteUid,
          amountPaise,
          paymentLink: payMode === "bank_link" && isFirst ? (paymentLink || null) : null,
          transactionId: isFirst ? (transactionId || null) : null,
          paymentMethod:
            paymentMethod
            || (settleNow ? "cash" : payMode === "razorpay" ? "razorpay" : "bank_link"),
          paidAt: settleNow ? new Date().toISOString() : null,
          notes: null,
          dueAt: null,
          installmentLabel:
            payShape === "full"
              ? "Full payment"
              : `Installment ${index + 1} of ${installmentAmountsPaise.length}`,
          createRazorpayLink,
          settleNow,
          emailProspect: emailProspect && payMode !== "received" && isFirst,
        },
        index === installmentAmountsPaise.length - 1
          ? settleNow
            ? "Payment recorded — account activates on first paid installment."
            : "Payment schedule created — waiting for payment."
          : `Installment ${index + 1} saved.`,
      );
      if (!ok) return;
    }
    if (payMode === "received") setStep(4);
  }

  const customerUid = request.billSummary?.customerUid || null;
  const nextDue = request.payments.find((payment) => payment.status === "pending");
  const disabled = saving || busy;

  return (
    <section className="dash-premium-card overflow-hidden p-0">
      <div className="border-b border-[#ECECEC] bg-[#FAFAFB] px-4 py-4 md:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#5AA700]">Fulfill</p>
            <h2 className="text-[15px] font-black text-[#111827]">Guided deal flow</h2>
          </div>
          {!canManage ? (
            <p className="text-[11px] font-semibold text-slate-500">View only — manage permission required</p>
          ) : null}
        </div>
        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((item) => {
            const active = step === item.id;
            const done = stepComplete(request, item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setStep(item.id)}
                  className={`flex w-full items-start gap-2 rounded-[12px] border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-[#84D400] bg-white shadow-sm"
                      : done
                        ? "border-emerald-100 bg-emerald-50/60"
                        : "border-transparent bg-white/70 hover:border-[#E5E7EB]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                      done && !active
                        ? "bg-emerald-600 text-white"
                        : active
                          ? "bg-[#84D400] text-[#1F3D00]"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {done && !active ? <Check size={13} /> : item.id}
                  </span>
                  <span>
                    <span className="block text-[12px] font-black text-slate-900">{item.label}</span>
                    <span className="block text-[10px] font-semibold text-slate-500">{item.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="p-4 md:p-5">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-lime-50 text-[#5AA700]">
                <UserRound size={16} />
              </span>
              <div>
                <h3 className="text-[14px] font-bold text-[#111827]">Contact prospect</h3>
                <p className="text-[12px] font-semibold text-slate-500">
                  Assign an owner, mark Contacted, optionally leave a note or compose mail.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company" value={request.companyName} />
              <Field label="Contact" value={request.contactName} />
              <Field
                label="Email"
                value={<a href={`mailto:${request.businessEmail}`} className="text-[#4D8C00]">{request.businessEmail}</a>}
              />
              <Field label="Phone" value={<a href={`tel:${request.phone}`}>{request.phone}</a>} />
            </div>
            {canManage ? (
              <>
                <UserFilterDropdown
                  compact
                  className="max-w-sm"
                  menuWidth={220}
                  label="Assignment"
                  menuTitle="Assignment"
                  value={assignee || "none"}
                  options={["none", ...assignees.map((admin) => String(admin.id))]}
                  onChange={(value) => setAssignee(value === "none" ? "" : value)}
                  renderOption={(value) =>
                    value === "none"
                      ? "Unassigned"
                      : assignees.find((admin) => String(admin.id) === value)?.name || value
                  }
                  renderValue={(value) =>
                    value === "none"
                      ? "Unassigned"
                      : assignees.find((admin) => String(admin.id) === value)?.name || value
                  }
                />
                <AdminInput
                  value={contactNote}
                  onChange={(event) => setContactNote(event.target.value)}
                  placeholder="Optional call / email note..."
                />
                <div className="flex flex-wrap gap-2">
                  <AdminButton disabled={disabled} onClick={() => onComposeMail()}>
                    <span className="inline-flex items-center gap-1.5"><Mail size={14} /> Compose mail</span>
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    disabled={disabled}
                    onClick={() => void saveContact(true)}
                  >
                    {request.status === "new" ? "Mark contacted & continue" : "Save & continue to Quote"}
                  </AdminButton>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-lime-50 text-[#5AA700]">
                <FileText size={16} />
              </span>
              <div>
                <h3 className="text-[14px] font-bold text-[#111827]">Build & send quote PDF</h3>
                <p className="text-[12px] font-semibold text-slate-500">
                  One form for limits + price. After payment you can still tick missed features and click Update live plan.
                </p>
              </div>
            </div>

            {dealAlreadyLive && livePlanUid ? (
              <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-900">
                Deal is already paid/activated. Change limits or feature checkboxes below, then{" "}
                <span className="font-black">Update live plan features</span> — no new quote needed.
                <span className="mt-1 block font-medium text-amber-800/80">Plan: {livePlanUid}</span>
              </div>
            ) : null}

            {finalQuote ? (
              <div className="rounded-[12px] border border-[#A6FF2E] bg-[#F7FCE8] px-3 py-2.5 text-[12px] font-semibold text-slate-700">
                Latest quote {finalQuote.quoteNumber} v{finalQuote.version} · {formatMoney(finalQuote.pricePaise)} · valid{" "}
                {formatQuoteDate(finalQuote.validUntil)}
                <a
                  href={`/api/master-admin/enterprise-requests/${encodeURIComponent(request.requestUid)}/quotes/${encodeURIComponent(finalQuote.quoteUid)}/download`}
                  className="ml-2 inline-flex items-center gap-1 font-black text-[#4D8C00]"
                >
                  <Download size={13} /> PDF
                </a>
              </div>
            ) : null}

            {canManage ? (
              <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <AdminInput
                    placeholder="Plan / quote name"
                    value={quoteDraft.name}
                    onChange={(event) => setQuoteDraft({ ...quoteDraft, name: event.target.value })}
                  />
                  <UserFilterDropdown
                    hideLabel
                    compact
                    className="w-full"
                    menuWidth={240}
                    label="Reuse template"
                    menuTitle="Reuse template"
                    value={quoteDraft.reusePlanUid || "new"}
                    options={["new", ...customPlans.filter((plan) => plan.isActive).map((plan) => plan.customPlanUid)]}
                    onChange={(value) => {
                      if (value === "new") {
                        setQuoteDraft((current) => ({ ...current, reusePlanUid: "" }));
                        return;
                      }
                      const plan = customPlans.find((item) => item.customPlanUid === value);
                      setQuoteDraft((current) => ({
                        ...current,
                        reusePlanUid: value,
                        name: plan?.name || current.name,
                        billingCycle: plan?.billingCycle || current.billingCycle,
                        price: plan ? String(plan.pricePaise / 100) : current.price,
                      }));
                    }}
                    renderOption={(value) =>
                      value === "new"
                        ? "Create new plan from fields below"
                        : customPlans.find((plan) => plan.customPlanUid === value)?.name || value
                    }
                    renderValue={(value) =>
                      value === "new"
                        ? "Create new plan from fields below"
                        : customPlans.find((plan) => plan.customPlanUid === value)?.name || value
                    }
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <UserFilterDropdown
                    hideLabel
                    compact
                    className="w-full"
                    menuWidth={160}
                    label="Billing"
                    menuTitle="Billing"
                    value={quoteDraft.billingCycle}
                    options={["monthly", "yearly"]}
                    onChange={(value) => setQuoteDraft({ ...quoteDraft, billingCycle: value })}
                    renderOption={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
                    renderValue={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
                  />
                  <AdminInput
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Price (₹)"
                    value={quoteDraft.price}
                    onChange={(event) => setQuoteDraft({ ...quoteDraft, price: event.target.value })}
                  />
                  <AdminInput
                    type="date"
                    value={quoteDraft.validUntil}
                    onChange={(event) => setQuoteDraft({ ...quoteDraft, validUntil: event.target.value })}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <AdminInput type="number" min="0" placeholder="Storage GB" value={quoteDraft.storageGb} onChange={(event) => setQuoteDraft({ ...quoteDraft, storageGb: event.target.value })} />
                  <AdminInput type="number" min="0" placeholder="Bandwidth GB" value={quoteDraft.bandwidthGb} onChange={(event) => setQuoteDraft({ ...quoteDraft, bandwidthGb: event.target.value })} />
                  <AdminInput type="number" min="0" placeholder="Products" value={quoteDraft.productLimit} onChange={(event) => setQuoteDraft({ ...quoteDraft, productLimit: event.target.value })} />
                  <AdminInput type="number" min="0" placeholder="Team seats" value={quoteDraft.teamMemberLimit} onChange={(event) => setQuoteDraft({ ...quoteDraft, teamMemberLimit: event.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600 sm:grid-cols-3">
                  {([
                    ["allowViewer", "3D Viewer"],
                    ["allowUpload", "Upload"],
                    ["allowObjectCapture", "Object Capture"],
                    ["allowAr", "AR"],
                    ["allowQr", "QR"],
                    ["allowShare", "Share"],
                    ["allowEmbed", "Embed"],
                    ["customBranding", "Branding"],
                    ["allowCustomDomain", "Custom domain"],
                    ["advancedAnalytics", "Analytics"],
                    ["prioritySupport", "Priority support"],
                    ["slaSupport", "SLA"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={quoteDraft[key] as boolean}
                        onChange={(event) => setQuoteDraft({ ...quoteDraft, [key]: event.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <textarea
                  className="min-h-28 rounded-xl border border-slate-200 p-3 text-[12px] leading-relaxed"
                  placeholder="Quote terms (optional)"
                  value={quoteDraft.terms}
                  onChange={(event) => setQuoteDraft({ ...quoteDraft, terms: event.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  {livePlanUid ? (
                    <AdminButton
                      variant="primary"
                      disabled={disabled || !quoteDraft.price}
                      onClick={() => void updateLivePlanFeatures()}
                    >
                      Update live plan features
                    </AdminButton>
                  ) : null}
                  {!dealAlreadyLive ? (
                    <>
                      <AdminButton
                        disabled={disabled || !quoteDraft.price || !quoteDraft.validUntil}
                        onClick={() => void createQuoteVersion(false, true)}
                      >
                        <span className="inline-flex items-center gap-1.5"><Download size={14} /> Save & download PDF</span>
                      </AdminButton>
                      <AdminButton
                        variant={livePlanUid ? "secondary" : "primary"}
                        disabled={disabled || !quoteDraft.price || !quoteDraft.validUntil}
                        onClick={() => void createQuoteVersion(true, false)}
                      >
                        <span className="inline-flex items-center gap-1.5"><Mail size={14} /> Email quote PDF</span>
                      </AdminButton>
                    </>
                  ) : null}
                  {finalQuote ? (
                    <AdminButton disabled={disabled} onClick={() => setStep(3)}>
                      {dealAlreadyLive ? "View payment" : "Skip to payment"}
                    </AdminButton>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-lime-50 text-[#5AA700]">
                <CreditCard size={16} />
              </span>
              <div>
                <h3 className="text-[14px] font-bold text-[#111827]">Collect payment</h3>
                <p className="text-[12px] font-semibold text-slate-500">
                  Choose full amount or installments. First paid installment activates the account.
                </p>
              </div>
            </div>

            {!finalQuote ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500">
                Create a quote in step 2 before collecting payment.
              </p>
            ) : (
              <>
                <div className="rounded-[12px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[12px] font-semibold text-slate-700">
                  {finalQuote.quoteNumber} · Remaining {formatMoney(remainingPaise)} of {formatMoney(finalQuote.pricePaise)}
                </div>

                {canManage && remainingPaise > 0 ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        { id: "full" as const, title: "Full amount", hint: "One payment for the remaining balance" },
                        { id: "installments" as const, title: "Installments", hint: "Split schedule; first paid turns account on" },
                      ]).map((option) => (
                        <label
                          key={option.id}
                          className={`cursor-pointer rounded-xl border px-3 py-2.5 ${
                            payShape === option.id ? "border-[#4D8C00] bg-[#F4FAEC]" : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="flex items-start gap-2">
                            <input
                              type="radio"
                              className="mt-1"
                              name="pay-shape"
                              checked={payShape === option.id}
                              onChange={() => setPayShape(option.id)}
                            />
                            <span>
                              <span className="block text-[12px] font-black text-slate-900">{option.title}</span>
                              <span className="mt-0.5 block text-[11px] text-slate-500">{option.hint}</span>
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>

                    {payShape === "installments" ? (
                      <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                        <UserFilterDropdown
                          compact
                          className="max-w-[160px]"
                          menuWidth={120}
                          label="Parts"
                          menuTitle="Parts"
                          value={String(partCount)}
                          options={["2", "3", "4"]}
                          onChange={(value) => {
                            const count = Number(value);
                            setPartCount(count);
                            setCustomParts(Array.from({ length: count }, () => ""));
                          }}
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Array.from({ length: partCount }, (_, index) => (
                            <AdminInput
                              key={index}
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder={`Part ${index + 1} ₹ (blank = equal split)`}
                              value={customParts[index] || ""}
                              onChange={(event) => {
                                const next = [...customParts];
                                next[index] = event.target.value;
                                setCustomParts(next);
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500">
                          Schedule preview:{" "}
                          {installmentAmountsPaise.map((amount, index) => (
                            <span key={index}>
                              {index > 0 ? " + " : ""}
                              {formatMoney(amount)}
                            </span>
                          ))}
                          {" = "}
                          {formatMoney(installmentAmountsPaise.reduce((sum, value) => sum + value, 0))}
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      {([
                        { id: "received" as const, title: "Cash / UPI received now", hint: "Settle first (or full) immediately → activate" },
                        { id: "razorpay" as const, title: "Razorpay link", hint: "Auto-paid when customer pays" },
                        { id: "bank_link" as const, title: "Bank / own link", hint: "Save pending; mark paid later" },
                      ]).map((option) => (
                        <label
                          key={option.id}
                          className={`cursor-pointer rounded-xl border px-3 py-2 ${
                            payMode === option.id ? "border-[#4D8C00] bg-[#F4FAEC]" : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="flex items-start gap-2">
                            <input
                              type="radio"
                              className="mt-1"
                              name="wizard-pay-mode"
                              checked={payMode === option.id}
                              onChange={() => {
                                setPayMode(option.id);
                                setPaymentMethod(
                                  option.id === "received" ? "cash" : option.id === "razorpay" ? "razorpay" : "bank_link",
                                );
                              }}
                            />
                            <span>
                              <span className="block text-[12px] font-black text-slate-900">{option.title}</span>
                              <span className="mt-0.5 block text-[11px] text-slate-500">{option.hint}</span>
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>

                    {payMode === "bank_link" ? (
                      <AdminInput
                        type="url"
                        placeholder="Bank / UPI payment link (HTTPS)"
                        value={paymentLink}
                        onChange={(event) => setPaymentLink(event.target.value)}
                      />
                    ) : null}
                    {payMode === "received" ? (
                      <>
                        <AdminInput
                          placeholder="Method (cash / gpay / neft…)"
                          value={paymentMethod}
                          onChange={(event) => setPaymentMethod(event.target.value)}
                        />
                        <AdminInput
                          placeholder="UTR / transaction ID (optional)"
                          value={transactionId}
                          onChange={(event) => setTransactionId(event.target.value)}
                        />
                      </>
                    ) : (
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={emailProspect}
                          onChange={(event) => setEmailProspect(event.target.checked)}
                        />
                        Email payment link to prospect
                      </label>
                    )}

                    <AdminButton
                      variant="primary"
                      disabled={
                        disabled
                        || installmentAmountsPaise.length === 0
                        || (payMode === "bank_link" && emailProspect && !paymentLink.trim())
                      }
                      onClick={() => void collectPayment()}
                    >
                      {payShape === "full"
                        ? payMode === "received"
                          ? "Collect full & activate"
                          : "Create full payment"
                        : "Create installment schedule"}
                    </AdminButton>
                  </div>
                ) : remainingPaise <= 0 ? (
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-emerald-700">Quote fully collected.</p>
                    <AdminButton variant="primary" onClick={() => setStep(4)}>View activated summary</AdminButton>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-lime-50 text-[#5AA700]">
                <Check size={16} />
              </span>
              <div>
                <h3 className="text-[14px] font-bold text-[#111827]">Activated summary</h3>
                <p className="text-[12px] font-semibold text-slate-500">
                  Customer access, remaining dues, password-setup email, and pause/resume.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Customer"
                value={
                  customerUid ? (
                    <Link
                      href={`/master-admin/customers/${encodeURIComponent(customerUid)}`}
                      className="font-bold text-[#4D8C00] hover:underline"
                    >
                      {customerUid}
                    </Link>
                  ) : (
                    "Not provisioned yet — record first paid installment"
                  )
                }
              />
              <Field
                label="Subscription"
                value={request.billSummary?.subscriptionStatus || request.statusLabel}
              />
              <Field
                label="Password setup email"
                value={
                  request.activationEmailSentAt
                    ? `Sent · ${new Date(request.activationEmailSentAt).toLocaleString("en-IN")}`
                    : customerUid
                      ? "Not sent yet (sent on first activation settle)"
                      : "Pending activation"
                }
              />
              <Field label="Paid" value={formatMoney(request.billSummary?.paidPaise || 0)} />
              <Field label="Remaining dues" value={formatMoney(request.billSummary?.remainingPaise || 0)} />
              <Field
                label="Next due"
                value={
                  nextDue
                    ? `${formatMoney(nextDue.amountPaise)}${nextDue.dueAt ? ` · ${nextDue.dueAt}` : ""}${nextDue.installmentLabel ? ` · ${nextDue.installmentLabel}` : ""}`
                    : "None"
                }
              />
            </div>

            {request.contracts[0] ? (
              <div className="rounded-[12px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[12px] font-semibold text-slate-700">
                Contract {request.contracts[0].contractUid} · {request.contracts[0].startsOn} → {request.contracts[0].expiresOn}
              </div>
            ) : null}

            {canManage && livePlanUid ? (
              <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] font-semibold text-amber-900">
                Missed QR / AR / Embed after payment? Open Quote, tick the features, then{" "}
                <span className="font-black">Update live plan features</span>.
                <div className="mt-2">
                  <AdminButton disabled={disabled} onClick={() => setStep(2)}>
                    Edit live plan features
                  </AdminButton>
                </div>
              </div>
            ) : null}

            {canManage && customerUid
              && (request.billSummary.subscriptionStatus === "active"
                || request.billSummary.subscriptionStatus === "paused") ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {request.billSummary.subscriptionStatus !== "paused" ? (
                    <AdminButton disabled={disabled} onClick={() => onLifecycleActionChange("pause")}>
                      <span className="inline-flex items-center gap-1"><Pause size={14} /> Pause</span>
                    </AdminButton>
                  ) : (
                    <AdminButton disabled={disabled} onClick={() => onLifecycleActionChange("resume")}>
                      <span className="inline-flex items-center gap-1"><Play size={14} /> Resume</span>
                    </AdminButton>
                  )}
                  <Link
                    href={`/master-admin/customers/${encodeURIComponent(customerUid)}/billing`}
                    className="dash-premium-btn-secondary inline-flex h-10 items-center px-3 text-[11px]"
                  >
                    Customer billing
                  </Link>
                </div>
                {lifecycleAction ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                    <p className="text-[12px] font-black text-slate-900">
                      {lifecycleAction === "pause" ? "Pause plan?" : "Resume plan?"}
                    </p>
                    <textarea
                      className="mt-2 min-h-16 w-full rounded-xl border border-slate-200 bg-white p-3 text-[12px]"
                      placeholder="Reason (min 5 characters)"
                      value={lifecycleReason}
                      onChange={(event) => onLifecycleReasonChange(event.target.value)}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <AdminButton
                        variant="primary"
                        disabled={disabled || lifecycleReason.trim().length < 5}
                        onClick={() => onConfirmLifecycle()}
                      >
                        Confirm {lifecycleAction}
                      </AdminButton>
                      <AdminButton disabled={disabled} onClick={() => onLifecycleActionChange(null)}>
                        Cancel
                      </AdminButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] font-semibold text-slate-500">
                {customerUid
                  ? "Subscription not active yet — complete a paid installment in Payment."
                  : "Account activates after the first paid installment."}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
