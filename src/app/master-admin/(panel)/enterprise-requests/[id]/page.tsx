"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Download,
  FileSignature,
  FileText,
  Mail,
  MessageSquarePlus,
  Pause,
  Phone,
  Plus,
  Play,
  UserRound,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminComposeMailModal, { type ComposeMailDefaults } from "@/components/features/master-admin/AdminComposeMailModal";
import { formatQuoteDate } from "@/lib/enterprise-sales/quote-dates";
import {
  AdminActionMessage,
  AdminButton,
  AdminInput,
  AdminLoadingState,
  AdminSelect,
} from "@/components/ui/admin";
import {
  ENTERPRISE_STATUS_LABELS,
  type EnterpriseCustomPlan,
  type EnterprisePayment,
  type EnterpriseRequestDetail,
  type EnterpriseStatus,
} from "@/lib/enterprise-sales/types";

const NEXT_STATUSES: Record<EnterpriseStatus, EnterpriseStatus[]> = {
  new: ["contacted", "rejected", "closed"],
  contacted: ["negotiating", "rejected", "closed"],
  negotiating: ["quoted", "rejected", "closed"],
  quoted: ["waiting_payment", "negotiating", "rejected", "closed"],
  waiting_payment: ["active", "negotiating", "rejected", "closed"],
  active: ["closed"],
  rejected: [],
  closed: [],
};

type Assignee = { id: number; name: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

function paise(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function bytesFromGb(value: string) {
  const gb = Number(value);
  return value === "" || !Number.isFinite(gb) ? null : Math.round(gb * 1024 ** 3);
}

function gbFromBytes(value: number | null) {
  return value == null ? "—" : `${(value / 1024 ** 3).toLocaleString("en-IN")} GB`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-[13px] font-semibold text-slate-800">{value || "—"}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  id,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0FBD9] text-[#579D00]">
          <Icon size={16} />
        </span>
        <h2 className="text-[14px] font-black text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
    bad: "bg-rose-50 text-rose-800",
    accent: "bg-[#F0FBD9] text-[#3F7A00]",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tones[tone]}`}>
      {label}
    </span>
  );
}

function collectionTone(status?: string | null): "neutral" | "good" | "warn" | "bad" {
  if (status === "paid") return "good";
  if (status === "partial") return "warn";
  return "bad";
}

function PaymentEditor({
  payment,
  requestUid,
  disabled,
  onMarkPaid,
  onMarkFailed,
}: {
  payment: EnterprisePayment;
  requestUid: string;
  disabled: boolean;
  onMarkPaid: (paymentUid: string, body: object) => Promise<boolean>;
  onMarkFailed: (paymentUid: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(payment.status === "pending");
  const [transactionId, setTransactionId] = useState(payment.transactionId || "");
  const [paymentMethod, setPaymentMethod] = useState(payment.paymentMethod || "");

  const isPending = payment.status === "pending";

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-black text-slate-900">
              {payment.installmentLabel || "Installment"} · {formatMoney(payment.amountPaise)}
            </p>
            <StatusPill
              label={payment.status}
              tone={payment.status === "paid" ? "good" : payment.status === "failed" ? "bad" : "warn"}
            />
            {payment.invoiceUid ? (
              <StatusPill label={`Invoice ${payment.invoiceNumber || "ready"}`} tone="accent" />
            ) : null}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {payment.source === "razorpay_link" ? "Razorpay (auto)" : payment.paymentMethod || "Manual"}
            {payment.dueAt ? ` · Due ${payment.dueAt}` : ""}
            {payment.paidAt ? ` · Paid ${formatDate(String(payment.paidAt))}` : ""}
            {payment.transactionId ? ` · Txn ${payment.transactionId}` : ""}
          </p>
        </div>
        {payment.invoiceUid ? (
          <a
            href={`/api/master-admin/enterprise-requests/${encodeURIComponent(requestUid)}/payments/${encodeURIComponent(payment.paymentUid)}/invoice/download`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-700"
          >
            <Download size={13} /> PDF
          </a>
        ) : null}
      </button>

      {open && isPending ? (
        <div className="border-t border-slate-100 px-4 py-3">
          {payment.paymentLink ? (
            <a href={payment.paymentLink} target="_blank" rel="noreferrer" className="mb-3 block truncate text-[11px] font-bold text-[#4D8C00]">
              Open payment link
            </a>
          ) : null}
          <p className="mb-2 text-[11px] leading-4 text-slate-500">
            Ek click: GST invoice + Paid + plan activate (pehli payment pe). UTR optional.
          </p>
          <div className="grid gap-2">
            <AdminInput value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="UTR / Txn ID (optional)" />
            <AdminInput value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="Method (cash / gpay / neft…)" />
            <div className="flex flex-wrap gap-2">
              <AdminButton
                variant="primary"
                disabled={disabled}
                onClick={() => void onMarkPaid(payment.paymentUid, {
                  status: "paid",
                  transactionId: transactionId || null,
                  paymentMethod: paymentMethod || null,
                  paidAt: new Date().toISOString(),
                })}
              >
                Mark as Paid
              </AdminButton>
              <AdminButton disabled={disabled} onClick={() => void onMarkFailed(payment.paymentUid)}>
                Mark failed
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EnterpriseRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [request, setRequest] = useState<EnterpriseRequestDetail | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [customPlans, setCustomPlans] = useState<EnterpriseCustomPlan[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [planForm, setPlanForm] = useState({
    name: "", billingCycle: "monthly", price: "", storageGb: "", bandwidthGb: "",
    productLimit: "", modelLimit: "", arExperienceLimit: "", teamMemberLimit: "",
    qrLimit: "", shareLinkLimit: "",
    customBranding: false, allowCustomDomain: false, allowViewer: true, allowUpload: true, allowAr: true,
    allowQr: true, allowShare: true, allowEmbed: true, allowObjectCapture: true, advancedAnalytics: false,
    prioritySupport: false, dedicatedInfrastructure: false,
    slaSupport: false, supportLevel: "", notes: "",
    ocCapturesPerMonth: "", ocComputeSecondsPerMonth: "", ocConcurrentJobs: "", ocMaxRetries: "",
  });
  const [quoteForm, setQuoteForm] = useState({
    customPlanUid: "", billingCycle: "monthly", price: "", validUntil: "", terms: "", emailProspect: false,
  });
  const [paymentForm, setPaymentForm] = useState({
    quoteUid: "", amount: "", paymentLink: "", transactionId: "", paymentMethod: "cash",
    paidAt: "", status: "pending", notes: "", emailProspect: false,
    dueAt: "", installmentLabel: "",
    /** received = cash/UPI already paid; razorpay = auto via webhook; bank_link = your bank/UPI link */
    mode: "received" as "received" | "razorpay" | "bank_link",
  });
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"pause" | "resume" | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/master-admin/enterprise-requests/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Enterprise request");
      setRequest(data.request);
      setAssignees(data.assignees || []);
      setCustomPlans(data.customPlans || []);
      setCanManage(Boolean(data.canManage));
      setSelectedAssignee(data.request.assignedAdminId ? String(data.request.assignedAdminId) : "");
      setSelectedStatus("");
      const latestQuote = (data.request.quotes || [])[0];
      if (latestQuote) {
        setPaymentForm((current) => current.quoteUid ? current : {
          ...current,
          quoteUid: latestQuote.quoteUid,
          amount: String((latestQuote.remainingPaise ?? latestQuote.pricePaise) / 100),
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Enterprise request");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Initial route data is loaded client-side so later mutations can refresh the same model.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function mutate(path: string, method: "PATCH" | "POST", body: object, success: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/master-admin/enterprise-requests/${encodeURIComponent(id)}/${path}`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed");
      setRequest(data.request);
      if (data.customPlans) setCustomPlans(data.customPlans);
      setSelectedAssignee(data.request.assignedAdminId ? String(data.request.assignedAdminId) : "");
      setSelectedStatus("");
      const emailBits: string[] = [];
      if (data.email?.attempted) {
        emailBits.push(data.email.delivered ? "email delivered" : `email not delivered (${data.email.message || "check SMTP/Resend"})`);
      }
      if (data.activationEmail?.attempted) {
        emailBits.push(
          data.activationEmail.delivered
            ? "activation email delivered"
            : `activation email not delivered (${data.activationEmail.message || "check SMTP/Resend"})`,
        );
      }
      setMessage(emailBits.length ? `${success} · ${emailBits.join(" · ")}` : success);
      return true;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Update failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createPlan() {
    const ok = await mutate("plans", "POST", {
      name: planForm.name,
      billingCycle: planForm.billingCycle,
      pricePaise: paise(planForm.price),
      storageLimitBytes: bytesFromGb(planForm.storageGb),
      bandwidthLimitBytes: bytesFromGb(planForm.bandwidthGb),
      productLimit: planForm.productLimit === "" ? null : Number(planForm.productLimit),
      modelLimit: planForm.modelLimit === "" ? null : Number(planForm.modelLimit),
      arExperienceLimit: planForm.arExperienceLimit === "" ? null : Number(planForm.arExperienceLimit),
      teamMemberLimit: planForm.teamMemberLimit === "" ? null : Number(planForm.teamMemberLimit),
      qrLimit: planForm.qrLimit === "" ? null : Number(planForm.qrLimit),
      shareLinkLimit: planForm.shareLinkLimit === "" ? null : Number(planForm.shareLinkLimit),
      customBranding: planForm.customBranding,
      allowCustomDomain: planForm.allowCustomDomain,
      allowViewer: planForm.allowViewer,
      allowUpload: planForm.allowUpload,
      allowAr: planForm.allowAr,
      allowQr: planForm.allowQr,
      allowShare: planForm.allowShare,
      allowEmbed: planForm.allowEmbed,
      allowObjectCapture: planForm.allowObjectCapture,
      advancedAnalytics: planForm.advancedAnalytics,
      ocCapturesPerMonth: planForm.ocCapturesPerMonth === "" ? null : Number(planForm.ocCapturesPerMonth),
      ocComputeSecondsPerMonth:
        planForm.ocComputeSecondsPerMonth === "" ? null : Number(planForm.ocComputeSecondsPerMonth),
      ocConcurrentJobs: planForm.ocConcurrentJobs === "" ? null : Number(planForm.ocConcurrentJobs),
      ocMaxRetries: planForm.ocMaxRetries === "" ? null : Number(planForm.ocMaxRetries),
      prioritySupport: planForm.prioritySupport,
      dedicatedInfrastructure: planForm.dedicatedInfrastructure,
      slaSupport: planForm.slaSupport,
      supportLevel: planForm.supportLevel,
      notes: planForm.notes,
    }, "Reusable custom plan created.");
    if (ok) setPlanForm((current) => ({ ...current, name: "", price: "", notes: "" }));
  }

  function choosePlan(customPlanUid: string) {
    const plan = customPlans.find((item) => item.customPlanUid === customPlanUid);
    setQuoteForm((current) => ({
      ...current,
      customPlanUid,
      billingCycle: plan?.billingCycle || "monthly",
      price: plan ? String(plan.pricePaise / 100) : "",
    }));
  }

  async function createQuote() {
    const ok = await mutate("quotes", "POST", {
      ...quoteForm,
      pricePaise: paise(quoteForm.price),
    }, quoteForm.emailProspect ? "Quote created; email delivery attempted." : "Quote created.");
    if (ok) setQuoteForm((current) => ({ ...current, terms: "", emailProspect: false }));
  }

  async function createPayment() {
    const createRazorpayLink = paymentForm.mode === "razorpay";
    const settleNow = paymentForm.mode === "received";
    const emailProspect = paymentForm.mode !== "received" && paymentForm.emailProspect;
    const ok = await mutate("payments", "POST", {
      quoteUid: paymentForm.quoteUid,
      amountPaise: paise(paymentForm.amount),
      paymentLink: paymentForm.mode === "bank_link" ? (paymentForm.paymentLink || null) : null,
      transactionId: paymentForm.transactionId || null,
      paymentMethod: paymentForm.paymentMethod || (settleNow ? "cash" : createRazorpayLink ? "razorpay" : "bank_link"),
      paidAt: settleNow ? new Date().toISOString() : null,
      notes: paymentForm.notes || null,
      dueAt: paymentForm.dueAt || null,
      installmentLabel: paymentForm.installmentLabel || null,
      createRazorpayLink,
      settleNow,
      emailProspect,
    }, createRazorpayLink
      ? "Razorpay link ready — customer pay kare to automatic Paid."
      : settleNow
        ? "Cash entry done — invoice + Paid + plan activate."
        : emailProspect
          ? "Bank link saved; email bheja. Pay hone pe Mark as Paid dabao."
          : "Installment pending. Pay confirm hone pe Mark as Paid dabao.");
    if (ok) {
      setPaymentForm((current) => ({
        ...current,
        transactionId: "",
        paymentLink: "",
        notes: "",
        emailProspect: false,
        installmentLabel: "",
        dueAt: "",
        amount: "",
      }));
      setShowPaymentForm(false);
    }
  }

  async function confirmLifecycleAction() {
    const action = lifecycleAction;
    const customerUid = request?.billSummary?.customerUid;
    if (!action || !customerUid) {
      setError("No linked customer subscription yet. Record the first paid installment first.");
      return;
    }
    const reason = lifecycleReason.trim();
    if (reason.length < 5) {
      setError("Pause/Resume reason at least 5 characters likho.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/master-admin/customers/${encodeURIComponent(customerUid)}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, confirm: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `${action} failed`);
      setMessage(`Plan ${action}d.`);
      setLifecycleAction(null);
      setLifecycleReason("");
      await load();
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : `${action} failed`);
    } finally {
      setSaving(false);
    }
  }

  const requirements = useMemo(() => {
    if (!request) return [];
    return [
      ["More storage", request.needsMoreStorage],
      ["More bandwidth", request.needsMoreBandwidth],
      ["More products", request.needsMoreProducts],
      ["QR Codes", request.needsQr],
      ["Embed Viewer", request.needsEmbed],
      ["Share Links", request.needsShare],
      ["AR Experience", request.needsAr],
      ["Custom branding", request.needsCustomBranding],
      ["Advanced analytics", request.needsAnalytics],
      ["Team members", request.needsTeamMembers],
      ["Dedicated infrastructure", request.needsDedicatedInfrastructure],
      ["Priority support", request.needsPrioritySupport],
      ["SLA", request.needsSla],
    ] as const;
  }, [request]);

  const finalQuote = useMemo(() => {
    if (!request?.quotes?.length) return null;
    const active = request.quotes.find((quote) => ["sent", "accepted", "draft"].includes(quote.status));
    return active || request.quotes[0];
  }, [request]);

  const invoiceStats = useMemo(() => {
    const payments = request?.payments || [];
    return {
      withInvoice: payments.filter((payment) => payment.invoiceUid).length,
      missingInvoice: payments.filter((payment) => !payment.invoiceUid).length,
      paidCount: payments.filter((payment) => payment.status === "paid").length,
      pendingCount: payments.filter((payment) => payment.status === "pending").length,
    };
  }, [request]);

  const paidPercent = useMemo(() => {
    const total = request?.billSummary?.totalPaise || 0;
    const paid = request?.billSummary?.paidPaise || 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((paid / total) * 100));
  }, [request]);

  const composeDefaults = useMemo<ComposeMailDefaults | null>(() => {
    if (!request) return null;
    const pendingLink = request.payments.find((payment) => payment.paymentLink && payment.status === "pending");
    return {
      to: request.businessEmail,
      phone: request.phone,
      requestUid: request.requestUid,
      customerUid: request.billSummary?.customerUid || null,
      subject: finalQuote
        ? `AR360 Enterprise — ${finalQuote.quoteNumber}`
        : `AR360 Enterprise — ${request.companyName}`,
      text: `Hello ${request.contactName},\n\nSharing an update on your AR360 Enterprise plan for ${request.companyName}.\n\nRegards,\nAR360 Team`,
      paymentLink: pendingLink?.paymentLink || "",
      attachments: [
        ...request.quotes.map((quote) => ({
          id: `quote:${quote.quoteUid}`,
          kind: "quote" as const,
          label: `${quote.quoteNumber} v${quote.version} · ${formatMoney(quote.pricePaise)}`,
          requestUid: request.requestUid,
          quoteUid: quote.quoteUid,
        })),
        ...request.payments
          .filter((payment) => payment.invoiceUid)
          .map((payment) => ({
            id: `invoice:${payment.paymentUid}`,
            kind: "invoice" as const,
            label: `Invoice ${payment.invoiceNumber || payment.invoiceUid} · ${formatMoney(payment.amountPaise)}`,
            requestUid: request.requestUid,
            paymentUid: payment.paymentUid,
          })),
      ],
    };
  }, [request, finalQuote]);

  if (loading) return <AdminLoadingState label="Loading Enterprise request..." />;

  if (!request) {
    return (
      <div className="master-admin-panel">
        <AdminActionMessage message={error || "Enterprise request not found"} variant="error" />
      </div>
    );
  }

  return (
    <div className="master-admin-panel space-y-5">
      <AdminPageHeader
        title={request.companyName}
        subtitle={`${request.requestUid} · Submitted ${formatDate(request.createdAt)}`}
        actions={
          <Link
            href="/master-admin/enterprise-requests"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700"
          >
            <ArrowLeft size={16} />
            Back to queue
          </Link>
        }
      />

      {error ? <AdminActionMessage message={error} variant="error" /> : null}
      {message ? <AdminActionMessage message={message} variant="success" /> : null}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-[#F0FBD9] px-3 py-1 text-[11px] font-black text-[#4D8C00]">
              {request.statusLabel}
            </span>
            <p className="mt-2 text-[12px] font-semibold text-slate-500">
              Assigned to {request.assignedAdminName || "nobody"}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[11px] font-bold text-slate-500">
                Assignment
                <AdminSelect
                  value={selectedAssignee}
                  onChange={(event) => setSelectedAssignee(event.target.value)}
                  className="mt-1 block min-w-[190px]"
                >
                  <option value="">Unassigned</option>
                  {assignees.map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.name}</option>
                  ))}
                </AdminSelect>
              </label>
              <AdminButton
                disabled={saving}
                onClick={() =>
                  void mutate(
                    "assignment",
                    "PATCH",
                    { assignedAdminId: selectedAssignee || null },
                    "Assignment updated.",
                  )
                }
              >
                Save assignment
              </AdminButton>
              <label className="text-[11px] font-bold text-slate-500">
                Next status
                <AdminSelect
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="mt-1 block min-w-[170px]"
                >
                  <option value="">Select status</option>
                  {NEXT_STATUSES[request.status].map((status) => (
                    <option key={status} value={status}>{ENTERPRISE_STATUS_LABELS[status]}</option>
                  ))}
                </AdminSelect>
              </label>
              <AdminButton
                variant="primary"
                disabled={saving || !selectedStatus}
                onClick={() =>
                  void mutate(
                    "status",
                    "PATCH",
                    { status: selectedStatus },
                    "Status updated.",
                  )
                }
              >
                Update status
              </AdminButton>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section id="billing-snapshot" title="Deal billing snapshot" icon={CreditCard}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Final quote</p>
                  {finalQuote ? (
                    <>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {finalQuote.quoteNumber} · v{finalQuote.version}
                      </p>
                      <p className="text-[13px] font-semibold text-slate-600">
                        {finalQuote.planName} · {formatMoney(finalQuote.pricePaise)} / {finalQuote.billingCycle}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-500">
                        Quote valid until {formatQuoteDate(finalQuote.validUntil)}
                        {request.contracts[0]
                          ? ` · Plan ${formatQuoteDate(request.contracts[0].startsOn)} → ${formatQuoteDate(request.contracts[0].expiresOn)}`
                          : " · Plan period starts after first paid installment"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-500">No quote yet — create one from the sidebar.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={request.billSummary?.collectionStatus || "unpaid"}
                    tone={collectionTone(request.billSummary?.collectionStatus)}
                  />
                  <StatusPill label={`${request.quotes.length} quote${request.quotes.length === 1 ? "" : "s"}`} tone="neutral" />
                  <StatusPill
                    label={request.billSummary?.subscriptionStatus || "no subscription"}
                    tone={request.billSummary?.subscriptionStatus === "active" ? "good" : "neutral"}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Bill total</p>
                  <p className="mt-1 text-xl font-black text-slate-950">{formatMoney(request.billSummary?.totalPaise || 0)}</p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Paid aaya</p>
                  <p className="mt-1 text-xl font-black text-emerald-700">{formatMoney(request.billSummary?.paidPaise || 0)}</p>
                  <p className="text-[11px] font-semibold text-slate-500">{invoiceStats.paidCount} installment(s) paid</p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Pending / remaining</p>
                  <p className="mt-1 text-xl font-black text-amber-700">{formatMoney(request.billSummary?.remainingPaise || 0)}</p>
                  <p className="text-[11px] font-semibold text-slate-500">{invoiceStats.pendingCount} pending installment(s)</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Collection progress</span>
                  <span>{paidPercent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[#7BC800] transition-all" style={{ width: `${paidPercent}%` }} />
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700">
                  Invoices: <span className="font-black text-slate-950">{invoiceStats.withInvoice}</span> ban chuke
                  {invoiceStats.missingInvoice > 0 ? (
                    <span className="text-amber-700"> · {invoiceStats.missingInvoice} pending</span>
                  ) : (
                    <span className="text-emerald-700"> · sab ready</span>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700">
                  Quotes diya: <span className="font-black text-slate-950">{request.quotes.length}</span>
                  {finalQuote ? (
                    <span> · last final = <span className="font-black">v{finalQuote.version}</span></span>
                  ) : null}
                </div>
              </div>

              {canManage && request.billSummary?.customerUid
                && (request.billSummary.subscriptionStatus === "active"
                  || request.billSummary.subscriptionStatus === "paused") ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {request.billSummary.subscriptionStatus !== "paused" ? (
                      <AdminButton
                        disabled={saving}
                        onClick={() => {
                          setLifecycleAction("pause");
                          setLifecycleReason("");
                          setError("");
                        }}
                      >
                        <span className="inline-flex items-center gap-1"><Pause size={14} /> Pause plan</span>
                      </AdminButton>
                    ) : (
                      <AdminButton
                        disabled={saving}
                        onClick={() => {
                          setLifecycleAction("resume");
                          setLifecycleReason("");
                          setError("");
                        }}
                      >
                        <span className="inline-flex items-center gap-1"><Play size={14} /> Resume plan</span>
                      </AdminButton>
                    )}
                    <Link
                      href={`/master-admin/customers/${encodeURIComponent(request.billSummary.customerUid)}/billing`}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold"
                    >
                      Customer billing
                    </Link>
                  </div>
                  {lifecycleAction ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                      <p className="text-[12px] font-black text-slate-900">
                        {lifecycleAction === "pause" ? "Pause plan?" : "Resume plan?"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        {lifecycleAction === "pause"
                          ? "Upload / AR / QR band ho jayega. Short reason likho (audit ke liye)."
                          : "Customer access wapas chalu. Short reason likho."}
                      </p>
                      <textarea
                        className="mt-2 min-h-16 w-full rounded-xl border border-slate-200 bg-white p-3 text-[12px]"
                        placeholder="Reason (min 5 characters)"
                        value={lifecycleReason}
                        onChange={(event) => setLifecycleReason(event.target.value)}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <AdminButton variant="primary" disabled={saving || lifecycleReason.trim().length < 5} onClick={() => void confirmLifecycleAction()}>
                          Confirm {lifecycleAction}
                        </AdminButton>
                        <AdminButton
                          disabled={saving}
                          onClick={() => {
                            setLifecycleAction(null);
                            setLifecycleReason("");
                          }}
                        >
                          Cancel
                        </AdminButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : canManage && request.billSummary?.customerUid ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/master-admin/customers/${encodeURIComponent(request.billSummary.customerUid)}/billing`}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold"
                  >
                    Customer billing
                  </Link>
                  <p className="w-full text-[12px] font-semibold text-slate-500">
                    Pause/Resume pehli paid installment (active subscription) ke baad yahan dikhega.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-[12px] font-semibold text-slate-500">
                  Pehli paid installment ke baad customer + subscription activate hoga; tab Pause/Resume yahan dikhega.
                </p>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-wide text-slate-500">Quote history</h3>
                <a href="#quotes" className="text-[11px] font-bold text-[#4D8C00]">Manage quotes</a>
              </div>
              {request.quotes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500">
                  Abhi koi quote nahi — pehle custom plan + quote banao.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Quote</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Collection</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {request.quotes.map((quote) => {
                        const isFinal = finalQuote?.quoteUid === quote.quoteUid;
                        return (
                          <tr key={quote.quoteUid} className={`border-t border-slate-100 ${isFinal ? "bg-[#F7FCE8]" : "bg-white"}`}>
                            <td className="px-3 py-2.5">
                              <p className="font-black text-slate-900">
                                {quote.quoteNumber} · v{quote.version}
                                {isFinal ? <span className="ml-2 text-[10px] text-[#4D8C00]">FINAL</span> : null}
                              </p>
                              <p className="text-[11px] text-slate-500">{quote.planName} · valid {formatQuoteDate(quote.validUntil)}</p>
                            </td>
                            <td className="px-3 py-2.5 font-black">{formatMoney(quote.pricePaise)}</td>
                            <td className="px-3 py-2.5"><StatusPill label={quote.status} tone={isFinal ? "accent" : "neutral"} /></td>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-emerald-700">{formatMoney(quote.paidPaise)} paid</p>
                              <p className="text-[11px] text-amber-700">{formatMoney(quote.remainingPaise)} left</p>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <a
                                href={`/api/master-admin/enterprise-requests/${encodeURIComponent(id)}/quotes/${quote.quoteUid}/download`}
                                className="inline-flex items-center gap-1 font-bold text-[#4D8C00]"
                              >
                                <Download size={14} /> PDF
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-wide text-slate-500">
                  Payment / installment record ({request.payments.length})
                </h3>
                <a href="#payments" className="text-[11px] font-bold text-[#4D8C00]">Add installment</a>
              </div>
              {request.payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500">
                  Abhi koi payment nahi. Neeche se Add installment — cash ek click pe Paid, Razorpay auto, bank link baad mein Mark Paid.
                </p>
              ) : (
                <div className="space-y-2">
                  {request.payments.map((payment) => (
                    <PaymentEditor
                      key={payment.paymentUid}
                      payment={payment}
                      requestUid={id}
                      disabled={saving || !canManage}
                      onMarkPaid={(paymentUid, body) => mutate(
                        `payments/${paymentUid}`,
                        "PATCH",
                        body,
                        "Paid — invoice + plan update done.",
                      )}
                      onMarkFailed={(paymentUid) => mutate(
                        `payments/${paymentUid}`,
                        "PATCH",
                        { status: "failed" },
                        "Installment marked failed.",
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {request.contracts.length > 0 ? (
              <div className="mt-5">
                <h3 className="mb-2 text-[12px] font-black uppercase tracking-wide text-slate-500">Contracts</h3>
                <div className="space-y-2">
                  {request.contracts.map((contract) => (
                    <div key={contract.contractUid} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-[12px] font-black text-slate-900">{contract.contractUid}</p>
                        <p className="text-[11px] text-slate-500">
                          {contract.startsOn} → {contract.expiresOn}
                        </p>
                      </div>
                      <StatusPill label={contract.status} tone={contract.status === "active" ? "good" : "neutral"} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Section>

          <Section title="Company & contact profile" icon={Building2}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Company" value={request.companyName} />
              <Field label="Contact person" value={request.contactName} />
              <Field
                label="Business email"
                value={<a href={`mailto:${request.businessEmail}`} className="text-[#4D8C00]">{request.businessEmail}</a>}
              />
              <Field label="Phone" value={<a href={`tel:${request.phone}`}>{request.phone}</a>} />
              <Field
                label="Website"
                value={
                  request.companyWebsite ? (
                    <a href={request.companyWebsite} target="_blank" rel="noreferrer" className="text-[#4D8C00]">
                      {request.companyWebsite}
                    </a>
                  ) : "—"
                }
              />
              <Field label="Country" value={request.country} />
              <Field label="Industry" value={request.industry} />
              <Field label="Source" value={request.source} />
              <Field
                label="Customer ID"
                value={request.customerId ? (
                  <Link
                    href={`/master-admin/customers/${encodeURIComponent(request.customerId)}`}
                    className="font-bold text-[#4D8C00] hover:underline"
                  >
                    {request.customerId}
                  </Link>
                ) : canManage ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void mutate(
                        "customer",
                        "POST",
                        {},
                        "Suspended customer linked; invoices can now be generated.",
                      )}
                      className="text-left text-[#4D8C00] underline-offset-2 hover:underline"
                    >
                      Provision suspended customer
                    </button>
                  ) : "Not linked"
                }
              />
              <Field label="Created" value={formatDate(request.createdAt)} />
              <Field label="Last updated" value={formatDate(request.updatedAt)} />
            </div>
          </Section>

          <Section title="Capacity & requirements" icon={ClipboardList}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Expected products" value={request.expectedProducts} />
              <Field label="Expected storage" value={request.expectedStorageGb == null ? "—" : `${request.expectedStorageGb} GB`} />
              <Field
                label="Monthly bandwidth"
                value={request.expectedMonthlyBandwidthGb == null ? "—" : `${request.expectedMonthlyBandwidthGb} GB`}
              />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {requirements.map(([label, enabled]) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold ${
                    enabled
                      ? "border-lime-200 bg-lime-50 text-lime-800"
                      : "border-slate-100 bg-slate-50 text-slate-400"
                  }`}
                >
                  <Check size={14} className={enabled ? "" : "opacity-30"} />
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Additional requirements</p>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-slate-700">
                {request.additionalRequirements || "No additional requirements supplied."}
              </p>
            </div>
          </Section>

          <Section title="Internal notes & timeline" icon={CalendarDays}>
            {canManage ? (
              <div className="mb-5 flex flex-col gap-2 sm:flex-row">
                <AdminInput
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add an internal note..."
                  className="flex-1"
                />
                <AdminButton
                  variant="primary"
                  disabled={saving || !note.trim()}
                  onClick={() =>
                    void (async () => {
                      if (await mutate("notes", "POST", { note }, "Internal note added.")) setNote("");
                    })()
                  }
                >
                  <MessageSquarePlus size={16} />
                  Add note
                </AdminButton>
              </div>
            ) : null}
            <div className="space-y-3">
              {request.notes.length === 0 ? (
                <p className="text-[12px] font-semibold text-slate-400">No timeline entries yet.</p>
              ) : (
                request.notes.map((entry) => (
                  <div key={entry.noteUid} className="border-l-2 border-lime-300 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                        {entry.eventType.replace("_", " ")}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {entry.adminName || "System"} · {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-700">{entry.body}</p>
                  </div>
                ))
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Quick contact" icon={UserRound}>
            <div className="space-y-2">
              <AdminButton
                disabled={!canManage}
                onClick={() => setComposeOpen(true)}
              >
                <span className="inline-flex items-center gap-2"><Mail size={15} /> Compose mail / attach quote</span>
              </AdminButton>
              <a href={`mailto:${request.businessEmail}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-700">
                <Mail size={15} /> Open mail app
              </a>
              <a href={`tel:${request.phone}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-700">
                <Phone size={15} /> Call contact
              </a>
              {request.phone ? (
                <a
                  href={`https://wa.me/${String(request.phone).replace(/\D/g, "").length === 10 ? "91" : ""}${String(request.phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${request.contactName}, regarding your AR360 Enterprise plan.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-700"
                >
                  WhatsApp contact
                </a>
              ) : null}
            </div>
          </Section>

          <Section title="Plan templates" icon={Plus}>
            <p className="mb-3 text-[12px] leading-5 text-slate-500">
              <strong>Reusable custom plans</strong> = saved templates (price + limits + features) jo aap multiple Enterprise deals pe dubara use kar sakte ho.
              Yeh customer ka live plan nahi hai — sirf quote banate time template choose karne ke liye.
            </p>
            <div className="space-y-2">
              {customPlans.filter((plan) => plan.isActive).slice(0, 4).map((plan) => (
                <div key={plan.customPlanUid} className="rounded-xl border border-slate-200 p-3">
                  <span className="block text-[12px] font-black text-slate-800">{plan.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500">{formatMoney(plan.pricePaise)} / {plan.billingCycle}</span>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => { choosePlan(plan.customPlanUid); setShowQuoteForm(true); }}
                      className="mt-2 text-[10px] font-black text-[#4D8C00]"
                    >
                      Use for new quote
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {canManage ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminButton disabled={saving} onClick={() => setShowPlanForm((value) => !value)}>
                  {showPlanForm ? "Hide template form" : "Create plan template"}
                </AdminButton>
              </div>
            ) : null}
            {canManage && showPlanForm ? (
              <div className="mt-4 grid gap-2">
                <AdminInput placeholder="Plan name" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <AdminSelect value={planForm.billingCycle} onChange={(event) => setPlanForm({ ...planForm, billingCycle: event.target.value })}>
                    <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                  </AdminSelect>
                  <AdminInput type="number" min="0.01" step="0.01" placeholder="Price (₹)" value={planForm.price} onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })} />
                  <AdminInput type="number" min="0" placeholder="Storage (GB)" value={planForm.storageGb} onChange={(event) => setPlanForm({ ...planForm, storageGb: event.target.value })} />
                  <AdminInput type="number" min="0" placeholder="Bandwidth (GB)" value={planForm.bandwidthGb} onChange={(event) => setPlanForm({ ...planForm, bandwidthGb: event.target.value })} />
                  <AdminInput type="number" min="0" placeholder="Products (up to)" value={planForm.productLimit} onChange={(event) => setPlanForm({ ...planForm, productLimit: event.target.value })} />
                  <AdminInput type="number" min="0" placeholder="Team members" value={planForm.teamMemberLimit} onChange={(event) => setPlanForm({ ...planForm, teamMemberLimit: event.target.value })} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Feature gates</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                  {([
                    ["allowViewer", "3D Viewer"],
                    ["allowUpload", "Upload / Create"],
                    ["allowObjectCapture", "Object Capture"],
                    ["allowAr", "AR Experience"],
                    ["allowQr", "QR Codes"],
                    ["allowShare", "Share Links"],
                    ["allowEmbed", "Embed Viewer"],
                    ["customBranding", "Custom branding"],
                    ["allowCustomDomain", "Custom domain"],
                    ["advancedAnalytics", "Advanced analytics"],
                    ["prioritySupport", "Priority support"],
                    ["dedicatedInfrastructure", "Dedicated infrastructure"],
                    ["slaSupport", "SLA"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={planForm[key] as boolean} onChange={(event) => setPlanForm({ ...planForm, [key]: event.target.checked })} />{label}</label>
                  ))}
                </div>
                <AdminButton variant="primary" disabled={saving || !planForm.name || !planForm.price} onClick={() => void createPlan()}>Save template</AdminButton>
              </div>
            ) : null}
          </Section>

          <Section id="quotes" title={`Quotes (${request.quotes.length})`} icon={FileText}>
            <p className="mb-3 text-[12px] leading-5 text-slate-500">
              Latest quote is treated as <strong>FINAL</strong> for collection. Older versions stay in history.
            </p>
            <div className="space-y-2">
              {request.quotes.map((quote) => {
                const isFinal = finalQuote?.quoteUid === quote.quoteUid;
                return (
                <div key={quote.quoteUid} className={`rounded-xl border p-3 ${isFinal ? "border-[#A6FF2E] bg-[#F7FCE8]" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-black">
                        {quote.quoteNumber} · v{quote.version}
                        {isFinal ? <span className="ml-2 text-[10px] text-[#4D8C00]">FINAL</span> : null}
                      </p>
                      <p className="text-[10px] text-slate-500">{quote.planName} · {formatMoney(quote.pricePaise)} · {quote.status}</p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-600">
                        Paid {formatMoney(quote.paidPaise)} · Left {formatMoney(quote.remainingPaise)}
                      </p>
                    </div>
                    <a href={`/api/master-admin/enterprise-requests/${encodeURIComponent(id)}/quotes/${quote.quoteUid}/download`} className="text-[#4D8C00]" title="Download quote PDF"><Download size={16} /></a>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">{gbFromBytes(quote.storageLimitBytes)} storage · {quote.productLimit ?? "Unlimited"} products · valid until {formatQuoteDate(quote.validUntil)}</p>
                </div>
              );})}
            </div>
            {canManage ? (
              <div className="mt-3">
                <AdminButton disabled={saving} onClick={() => setShowQuoteForm((value) => !value)}>
                  {showQuoteForm ? "Hide quote form" : "Create next quote version"}
                </AdminButton>
                {showQuoteForm ? (
              <div className="mt-4 grid gap-2">
                <AdminSelect value={quoteForm.customPlanUid} onChange={(event) => choosePlan(event.target.value)}>
                  <option value="">Select active custom plan</option>
                  {customPlans.filter((plan) => plan.isActive).map((plan) => <option key={plan.customPlanUid} value={plan.customPlanUid}>{plan.name}</option>)}
                </AdminSelect>
                <div className="grid grid-cols-2 gap-2">
                  <AdminSelect value={quoteForm.billingCycle} onChange={(event) => setQuoteForm({ ...quoteForm, billingCycle: event.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></AdminSelect>
                  <AdminInput type="number" min="0.01" step="0.01" placeholder="Quote price (₹)" value={quoteForm.price} onChange={(event) => setQuoteForm({ ...quoteForm, price: event.target.value })} />
                </div>
                <AdminInput type="date" value={quoteForm.validUntil} onChange={(event) => setQuoteForm({ ...quoteForm, validUntil: event.target.value })} />
                <textarea className="min-h-20 rounded-xl border border-slate-200 p-3 text-[12px]" placeholder="Quote terms" value={quoteForm.terms} onChange={(event) => setQuoteForm({ ...quoteForm, terms: event.target.value })} />
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={quoteForm.emailProspect} onChange={(event) => setQuoteForm({ ...quoteForm, emailProspect: event.target.checked })} />Email PDF to prospect (best effort)</label>
                <AdminButton variant="primary" disabled={saving || !quoteForm.customPlanUid || !quoteForm.price || !quoteForm.validUntil} onClick={() => void createQuote()}>Save quote version</AdminButton>
              </div>
                ) : null}
              </div>
            ) : null}
          </Section>

          <Section id="payments" title="Record installment" icon={CreditCard}>
            <p className="mb-3 text-[12px] leading-5 text-slate-500">
              Snapshot upar history dikhati hai. Neeche se naya installment add karo — pehle mode choose karo.
            </p>
            {canManage ? (
              <div className="grid gap-2">
                <AdminButton disabled={saving} onClick={() => setShowPaymentForm((value) => !value)}>
                  {showPaymentForm ? "Hide form" : "Add installment"}
                </AdminButton>
                {showPaymentForm ? (
              <div className="grid gap-2">
                <div className="grid gap-2">
                  {([
                    {
                      id: "received" as const,
                      title: "Cash / UPI already received",
                      hint: "Ek click: save + GST invoice + Paid + plan start. UTR optional.",
                    },
                    {
                      id: "razorpay" as const,
                      title: "Razorpay link (auto Paid)",
                      hint: "Link banao → customer GPay/card se pay → yahan automatic Paid.",
                    },
                    {
                      id: "bank_link" as const,
                      title: "Bank / own payment link",
                      hint: "Apna bank link paste karo. Customer pay kare → yahan Mark as Paid dabao.",
                    },
                  ]).map((option) => (
                    <label
                      key={option.id}
                      className={`cursor-pointer rounded-xl border px-3 py-2 ${
                        paymentForm.mode === option.id
                          ? "border-[#4D8C00] bg-[#F4FAEC]"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          className="mt-1"
                          name="payment-mode"
                          checked={paymentForm.mode === option.id}
                          onChange={() => setPaymentForm({
                            ...paymentForm,
                            mode: option.id,
                            emailProspect: option.id === "razorpay" ? paymentForm.emailProspect : false,
                            paymentMethod: option.id === "received" ? (paymentForm.paymentMethod || "cash") : option.id === "razorpay" ? "razorpay" : "bank_link",
                          })}
                        />
                        <span>
                          <span className="block text-[12px] font-black text-slate-900">{option.title}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.hint}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <AdminSelect value={paymentForm.quoteUid} onChange={(event) => {
                  const quote = request.quotes.find((item) => item.quoteUid === event.target.value);
                  const remaining = quote?.remainingPaise ?? quote?.pricePaise ?? 0;
                  setPaymentForm({ ...paymentForm, quoteUid: event.target.value, amount: remaining ? String(remaining / 100) : "" });
                }}>
                  <option value="">Select quote (prefer FINAL)</option>
                  {request.quotes.map((quote) => <option key={quote.quoteUid} value={quote.quoteUid}>{quote.quoteNumber} v{quote.version}{finalQuote?.quoteUid === quote.quoteUid ? " · FINAL" : ""} · rem {formatMoney(quote.remainingPaise)}</option>)}
                </AdminSelect>
                <div className="grid grid-cols-2 gap-2">
                  <AdminInput type="number" min="0.01" step="0.01" placeholder="Installment amount (₹)" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
                  <AdminInput type="date" placeholder="Due date" value={paymentForm.dueAt} onChange={(event) => setPaymentForm({ ...paymentForm, dueAt: event.target.value })} />
                </div>
                <AdminInput placeholder="Installment label (optional)" value={paymentForm.installmentLabel} onChange={(event) => setPaymentForm({ ...paymentForm, installmentLabel: event.target.value })} />
                {paymentForm.mode === "bank_link" ? (
                  <AdminInput type="url" placeholder="Bank / UPI payment link (HTTPS)" value={paymentForm.paymentLink} onChange={(event) => setPaymentForm({ ...paymentForm, paymentLink: event.target.value })} />
                ) : null}
                {paymentForm.mode === "received" ? (
                  <>
                    <AdminInput placeholder="Payment method (cash / gpay / neft…)" value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })} />
                    <AdminInput placeholder="Transaction / UTR ID (optional)" value={paymentForm.transactionId} onChange={(event) => setPaymentForm({ ...paymentForm, transactionId: event.target.value })} />
                  </>
                ) : null}
                {paymentForm.mode === "bank_link" ? (
                  <AdminInput placeholder="Reference / UTR (optional now)" value={paymentForm.transactionId} onChange={(event) => setPaymentForm({ ...paymentForm, transactionId: event.target.value })} />
                ) : null}
                <textarea className="min-h-16 rounded-xl border border-slate-200 p-3 text-[12px]" placeholder="Internal payment notes" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
                {paymentForm.mode !== "received" ? (
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                    <input type="checkbox" checked={paymentForm.emailProspect} onChange={(event) => setPaymentForm({ ...paymentForm, emailProspect: event.target.checked })} />
                    Email payment link to prospect
                  </label>
                ) : null}
                <AdminButton
                  variant="primary"
                  disabled={
                    saving
                    || !paymentForm.quoteUid
                    || !paymentForm.amount
                    || (paymentForm.mode === "bank_link" && paymentForm.emailProspect && !paymentForm.paymentLink.trim())
                  }
                  onClick={() => void createPayment()}
                >
                  {paymentForm.mode === "razorpay"
                    ? "Create Razorpay link"
                    : paymentForm.mode === "received"
                      ? "Save & mark Paid"
                      : "Save pending installment"}
                </AdminButton>
                <p className="text-[11px] text-slate-500">
                  {paymentForm.mode === "razorpay"
                    ? "Pay hone pe automatic invoice + Paid."
                    : paymentForm.mode === "bank_link"
                      ? "Pay confirm hone pe history row pe Mark as Paid."
                      : "Isi click pe invoice + Paid + activate."}
                </p>
              </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">You do not have permission to record payments.</p>
            )}
          </Section>

          <Section id="contracts" title={`Contracts (${request.contracts.length})`} icon={FileSignature}>
            {request.contracts.length === 0 ? (
              <p className="text-[12px] leading-5 text-slate-500">
                Pehli paid installment ke baad contract yahan dikhega.
              </p>
            ) : (
              <div className="space-y-2">
                {request.contracts.map((contract) => (
                  <div key={contract.contractUid} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[12px] font-black">{contract.contractUid}</p>
                    <p className="text-[11px] text-slate-500">{contract.startsOn} → {contract.expiresOn}</p>
                    <div className="mt-2"><StatusPill label={contract.status} tone={contract.status === "active" ? "good" : "neutral"} /></div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      <AdminComposeMailModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        defaults={composeDefaults}
      />
    </div>
  );
}
