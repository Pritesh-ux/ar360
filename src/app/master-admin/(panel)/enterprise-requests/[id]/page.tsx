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
  Edit3,
  FileSignature,
  FileText,
  Mail,
  MessageSquarePlus,
  Pause,
  Phone,
  Plus,
  Play,
  UserRound,
  X,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminComposeMailModal, { type ComposeMailDefaults } from "@/components/features/master-admin/AdminComposeMailModal";
import EnterpriseFulfillWizard from "@/components/features/master-admin/EnterpriseFulfillWizard";
import AdminMetricCard from "@/components/ui/admin/AdminMetricCard";
import {
  buildEnterpriseComposeMailSubject,
  buildEnterpriseComposeMailText,
} from "@/lib/enterprise-sales/compose-mail";
import { formatQuoteDate } from "@/lib/enterprise-sales/quote-dates";
import { DEFAULT_ENTERPRISE_QUOTE_TERMS } from "@/lib/enterprise-sales/quote-terms";
import {
  AdminActionMessage,
  AdminButton,
  AdminInput,
  AdminLoadingState,
} from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import "@/components/dashboard/dashboard-premium.css";
import {
  ENTERPRISE_STATUS_LABELS,
  type EnterpriseCustomPlan,
  type EnterprisePayment,
  type EnterpriseRequestDetail,
  type EnterpriseStatus,
} from "@/lib/enterprise-sales/types";

const NEXT_STATUSES: Record<EnterpriseStatus, EnterpriseStatus[]> = {
  new: ["contacted", "negotiating", "quoted", "rejected", "closed"],
  contacted: ["negotiating", "quoted", "waiting_payment", "rejected", "closed"],
  negotiating: ["quoted", "waiting_payment", "rejected", "closed"],
  quoted: ["waiting_payment", "negotiating", "rejected", "closed"],
  waiting_payment: ["active", "negotiating", "quoted", "rejected", "closed"],
  active: ["closed"],
  rejected: [],
  closed: [],
};

const REQUIREMENT_FLAGS = [
  { key: "needsMoreStorage", label: "More storage" },
  { key: "needsMoreBandwidth", label: "More bandwidth" },
  { key: "needsMoreProducts", label: "More products" },
  { key: "needsQr", label: "QR Codes" },
  { key: "needsEmbed", label: "Embed Viewer" },
  { key: "needsShare", label: "Share Links" },
  { key: "needsAr", label: "AR Experience" },
  { key: "needsCustomBranding", label: "Custom branding" },
  { key: "needsAnalytics", label: "Advanced analytics" },
  { key: "needsTeamMembers", label: "Team members" },
  { key: "needsDedicatedInfrastructure", label: "Dedicated infrastructure" },
  { key: "needsPrioritySupport", label: "Priority support" },
  { key: "needsSla", label: "SLA" },
] as const;

type RequirementsFormState = {
  expectedProducts: string;
  expectedStorageGb: string;
  expectedMonthlyBandwidthGb: string;
  additionalRequirements: string;
} & Record<(typeof REQUIREMENT_FLAGS)[number]["key"], boolean>;

function requirementsFormFromRequest(request: EnterpriseRequestDetail): RequirementsFormState {
  return {
    expectedProducts: request.expectedProducts == null ? "" : String(request.expectedProducts),
    expectedStorageGb: request.expectedStorageGb == null ? "" : String(request.expectedStorageGb),
    expectedMonthlyBandwidthGb:
      request.expectedMonthlyBandwidthGb == null ? "" : String(request.expectedMonthlyBandwidthGb),
    additionalRequirements: request.additionalRequirements || "",
    needsMoreStorage: request.needsMoreStorage,
    needsMoreBandwidth: request.needsMoreBandwidth,
    needsMoreProducts: request.needsMoreProducts,
    needsQr: request.needsQr,
    needsEmbed: request.needsEmbed,
    needsShare: request.needsShare,
    needsAr: request.needsAr,
    needsCustomBranding: request.needsCustomBranding,
    needsAnalytics: request.needsAnalytics,
    needsTeamMembers: request.needsTeamMembers,
    needsDedicatedInfrastructure: request.needsDedicatedInfrastructure,
    needsPrioritySupport: request.needsPrioritySupport,
    needsSla: request.needsSla,
  };
}

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
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <div className="mt-1 text-[13px] font-semibold text-[#111827]">{value || "—"}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  id,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
}) {
  return (
    <section id={id} className="dash-premium-card p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-lime-50 text-[#5AA700]">
            <Icon size={16} />
          </span>
          <h2 className="text-[14px] font-bold text-[#111827]">{title}</h2>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
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
    <div className="dash-activity-row rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB]">
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
            className="dash-premium-btn-secondary inline-flex h-9 items-center gap-1 px-3 text-[11px]"
          >
            <Download size={13} /> PDF
          </a>
        ) : null}
      </button>

      {open && isPending ? (
        <div className="border-t border-[#ECECEC] px-4 py-3">
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
    customPlanUid: "",
    billingCycle: "monthly",
    price: "",
    validUntil: "",
    terms: DEFAULT_ENTERPRISE_QUOTE_TERMS,
    emailProspect: false,
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
  const [showAdvancedFulfill, setShowAdvancedFulfill] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"pause" | "resume" | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [editingRequirements, setEditingRequirements] = useState(false);
  const [requirementsForm, setRequirementsForm] = useState<RequirementsFormState | null>(null);

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
    if (ok) {
      setQuoteForm((current) => ({
        ...current,
        terms: DEFAULT_ENTERPRISE_QUOTE_TERMS,
        emailProspect: false,
      }));
    }
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
    return REQUIREMENT_FLAGS.map((item) => [item.label, request[item.key]] as const);
  }, [request]);

  function beginEditRequirements() {
    if (!request) return;
    setRequirementsForm(requirementsFormFromRequest(request));
    setEditingRequirements(true);
  }

  function cancelEditRequirements() {
    setEditingRequirements(false);
    setRequirementsForm(null);
  }

  async function saveRequirements() {
    if (!requirementsForm) return;
    const ok = await mutate(
      "requirements",
      "PATCH",
      {
        expectedProducts: requirementsForm.expectedProducts.trim() || null,
        expectedStorageGb: requirementsForm.expectedStorageGb.trim() || null,
        expectedMonthlyBandwidthGb: requirementsForm.expectedMonthlyBandwidthGb.trim() || null,
        additionalRequirements: requirementsForm.additionalRequirements.trim() || null,
        needsMoreStorage: requirementsForm.needsMoreStorage,
        needsMoreBandwidth: requirementsForm.needsMoreBandwidth,
        needsMoreProducts: requirementsForm.needsMoreProducts,
        needsQr: requirementsForm.needsQr,
        needsEmbed: requirementsForm.needsEmbed,
        needsShare: requirementsForm.needsShare,
        needsAr: requirementsForm.needsAr,
        needsCustomBranding: requirementsForm.needsCustomBranding,
        needsAnalytics: requirementsForm.needsAnalytics,
        needsTeamMembers: requirementsForm.needsTeamMembers,
        needsDedicatedInfrastructure: requirementsForm.needsDedicatedInfrastructure,
        needsPrioritySupport: requirementsForm.needsPrioritySupport,
        needsSla: requirementsForm.needsSla,
      },
      "Capacity & requirements updated.",
    );
    if (ok) {
      setEditingRequirements(false);
      setRequirementsForm(null);
    }
  }

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
    const quoteAttachments = request.quotes.map((quote) => ({
      id: `quote:${quote.quoteUid}`,
      kind: "quote" as const,
      label: `${quote.quoteNumber} v${quote.version} · ${formatMoney(quote.pricePaise)}`,
      requestUid: request.requestUid,
      quoteUid: quote.quoteUid,
    }));
    const invoiceAttachments = request.payments
      .filter((payment) => payment.invoiceUid)
      .map((payment) => ({
        id: `invoice:${payment.paymentUid}`,
        kind: "invoice" as const,
        label: `Invoice ${payment.invoiceNumber || payment.invoiceUid} · ${formatMoney(payment.amountPaise)}`,
        requestUid: request.requestUid,
        paymentUid: payment.paymentUid,
      }));
    return {
      to: request.businessEmail,
      phone: request.phone,
      requestUid: request.requestUid,
      customerUid: request.billSummary?.customerUid || null,
      subject: buildEnterpriseComposeMailSubject(request, finalQuote),
      text: buildEnterpriseComposeMailText(request, finalQuote),
      paymentLink: pendingLink?.paymentLink || "",
      selectedAttachmentIds: finalQuote ? [`quote:${finalQuote.quoteUid}`] : [],
      attachments: [...quoteAttachments, ...invoiceAttachments],
    };
  }, [request, finalQuote]);

  if (loading) return <AdminLoadingState label="Loading Enterprise request..." />;

  if (!request) {
    return (
      <div className="master-admin-panel dash-premium animate-dash-fade-in">
        <AdminActionMessage message={error || "Enterprise request not found"} variant="error" />
      </div>
    );
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/master-admin/enterprise-requests"
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151] transition hover:border-[#D4D4D4]"
        >
          <ArrowLeft size={14} />
          Back to queue
        </Link>
        <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF]">
          <Link href="/master-admin/enterprise-requests" className="hover:text-[#6B7280]">
            Enterprise
          </Link>
          <span>/</span>
          <span className="text-[#374151]">{request.companyName}</span>
        </nav>
      </div>

      <AdminPageHeader
        title={request.companyName}
        subtitle={`${request.requestUid} · Submitted ${formatDate(request.createdAt)}`}
      />

      {error ? <AdminActionMessage message={error} variant="error" /> : null}
      {message ? <AdminActionMessage message={message} variant="success" /> : null}

      <EnterpriseFulfillWizard
        request={request}
        assignees={assignees}
        customPlans={customPlans}
        canManage={canManage}
        saving={saving}
        onMutate={mutate}
        onRefresh={async () => {
          await load();
        }}
        onError={(text) => {
          setError(text);
          setMessage("");
        }}
        onSuccess={(text) => {
          setMessage(text);
          setError("");
        }}
        onComposeMail={() => setComposeOpen(true)}
        lifecycleAction={lifecycleAction}
        lifecycleReason={lifecycleReason}
        onLifecycleActionChange={(action) => {
          setLifecycleAction(action);
          setLifecycleReason("");
          setError("");
        }}
        onLifecycleReasonChange={setLifecycleReason}
        onConfirmLifecycle={() => void confirmLifecycleAction()}
      />

      <section className="dash-premium-card p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-lime-50 px-3 py-1 text-[11px] font-bold text-[#5AA700]">
              {request.statusLabel}
            </span>
            <p className="mt-2 text-[12px] font-semibold text-[#6B7280]">
              Assigned to {request.assignedAdminName || "nobody"}
              <span className="text-[#9CA3AF]"> · change owner in Contact step above</span>
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap items-end gap-3">
              <UserFilterDropdown
                compact
                className="min-w-[170px]"
                menuWidth={200}
                label="Next status"
                menuTitle="Next status"
                value={selectedStatus || "none"}
                options={["none", ...NEXT_STATUSES[request.status]]}
                onChange={(value) => setSelectedStatus(value === "none" ? "" : value)}
                renderOption={(value) =>
                  value === "none"
                    ? "Select status"
                    : ENTERPRISE_STATUS_LABELS[value as keyof typeof ENTERPRISE_STATUS_LABELS] || value
                }
                renderValue={(value) =>
                  value === "none"
                    ? "Select status"
                    : ENTERPRISE_STATUS_LABELS[value as keyof typeof ENTERPRISE_STATUS_LABELS] || value
                }
              />
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

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <Section id="billing-snapshot" title="Deal billing snapshot" icon={CreditCard}>
            <div className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-4">
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
                    <p className="mt-1 text-sm font-semibold text-slate-500">No quote yet — use the Fulfill wizard Quote step.</p>
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
                <AdminMetricCard
                  title="Bill total"
                  value={formatMoney(request.billSummary?.totalPaise || 0)}
                  layout="compact"
                />
                <AdminMetricCard
                  title="Paid aaya"
                  value={formatMoney(request.billSummary?.paidPaise || 0)}
                  note={`${invoiceStats.paidCount} installment(s) paid`}
                  layout="compact"
                  changeTone="positive"
                />
                <AdminMetricCard
                  title="Pending / remaining"
                  value={formatMoney(request.billSummary?.remainingPaise || 0)}
                  note={`${invoiceStats.pendingCount} pending installment(s)`}
                  layout="compact"
                  changeTone="negative"
                />
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-[#6B7280]">
                  <span>Collection progress</span>
                  <span>{paidPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                  <div className="dash-progress-bar h-full rounded-full bg-[#84D400]" style={{ width: `${paidPercent}%` }} />
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[14px] border border-[#ECECEC] bg-white px-3 py-2 text-[12px] font-semibold text-[#374151]">
                  Invoices: <span className="font-black text-slate-950">{invoiceStats.withInvoice}</span> ban chuke
                  {invoiceStats.missingInvoice > 0 ? (
                    <span className="text-amber-700"> · {invoiceStats.missingInvoice} pending</span>
                  ) : (
                    <span className="text-emerald-700"> · sab ready</span>
                  )}
                </div>
                <div className="rounded-[14px] border border-[#ECECEC] bg-white px-3 py-2 text-[12px] font-semibold text-[#374151]">
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
                          <tr
                            key={quote.quoteUid}
                            className={`border-t border-slate-100 transition ${
                              isFinal
                                ? "admin-table-row--accent bg-[#F7FCE8]"
                                : "bg-white"
                            }`}
                          >
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
              <Field label="Address" value={request.address || "—"} />
              <Field label="Country" value={request.country} />
              <Field label="State" value={request.state || "—"} />
              <Field label="Industry" value={request.industry} />
              <Field label="Source" value={request.source} />
              <Field
                label="Customer"
                value={request.billSummary?.customerUid ? (
                  <Link
                    href={`/master-admin/customers/${encodeURIComponent(request.billSummary.customerUid)}`}
                    className="font-bold text-[#4D8C00] hover:underline"
                  >
                    {request.billSummary.customerUid}
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

          <Section
            title="Capacity & requirements"
            icon={ClipboardList}
            action={
              canManage ? (
                editingRequirements ? (
                  <>
                    <AdminButton disabled={saving} onClick={cancelEditRequirements}>
                      <span className="inline-flex items-center gap-1.5"><X size={14} /> Cancel</span>
                    </AdminButton>
                    <AdminButton
                      variant="primary"
                      disabled={saving || !requirementsForm}
                      onClick={() => void saveRequirements()}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </AdminButton>
                  </>
                ) : (
                  <AdminButton disabled={saving} onClick={beginEditRequirements}>
                    <span className="inline-flex items-center gap-1.5"><Edit3 size={14} /> Edit</span>
                  </AdminButton>
                )
              ) : null
            }
          >
            {editingRequirements && requirementsForm ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Expected products
                    <AdminInput
                      className="mt-1.5 w-full"
                      type="number"
                      min={0}
                      step={1}
                      value={requirementsForm.expectedProducts}
                      onChange={(event) =>
                        setRequirementsForm((current) =>
                          current ? { ...current, expectedProducts: event.target.value } : current,
                        )
                      }
                      placeholder="e.g. 500"
                    />
                  </label>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Expected storage (GB)
                    <AdminInput
                      className="mt-1.5 w-full"
                      type="number"
                      min={0}
                      step={1}
                      value={requirementsForm.expectedStorageGb}
                      onChange={(event) =>
                        setRequirementsForm((current) =>
                          current ? { ...current, expectedStorageGb: event.target.value } : current,
                        )
                      }
                      placeholder="e.g. 200"
                    />
                  </label>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Monthly bandwidth (GB)
                    <AdminInput
                      className="mt-1.5 w-full"
                      type="number"
                      min={0}
                      step={1}
                      value={requirementsForm.expectedMonthlyBandwidthGb}
                      onChange={(event) =>
                        setRequirementsForm((current) =>
                          current
                            ? { ...current, expectedMonthlyBandwidthGb: event.target.value }
                            : current,
                        )
                      }
                      placeholder="e.g. 1000"
                    />
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {REQUIREMENT_FLAGS.map((item) => {
                    const enabled = requirementsForm[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setRequirementsForm((current) =>
                            current ? { ...current, [item.key]: !current[item.key] } : current,
                          )
                        }
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] font-bold transition ${
                          enabled
                            ? "border-lime-200 bg-lime-50 text-lime-800"
                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                        }`}
                      >
                        <Check size={14} className={enabled ? "" : "opacity-30"} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Additional requirements
                  <textarea
                    className="mt-1.5 min-h-[100px] w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#84D400]"
                    value={requirementsForm.additionalRequirements}
                    onChange={(event) =>
                      setRequirementsForm((current) =>
                        current
                          ? { ...current, additionalRequirements: event.target.value }
                          : current,
                      )
                    }
                    placeholder="Security, SSO, timeline, deployment…"
                    maxLength={10000}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Expected products" value={request.expectedProducts} />
                  <Field
                    label="Expected storage"
                    value={request.expectedStorageGb == null ? "—" : `${request.expectedStorageGb} GB`}
                  />
                  <Field
                    label="Monthly bandwidth"
                    value={
                      request.expectedMonthlyBandwidthGb == null
                        ? "—"
                        : `${request.expectedMonthlyBandwidthGb} GB`
                    }
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
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Additional requirements
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-slate-700">
                    {request.additionalRequirements || "No additional requirements supplied."}
                  </p>
                </div>
              </>
            )}
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
                  <div
                    key={entry.noteUid}
                    className="dash-activity-row rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#6B7280]">
                        {entry.eventType.replace("_", " ")}
                      </span>
                      <span className="text-[11px] font-semibold text-[#9CA3AF]">
                        {entry.adminName || "System"} · {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#374151]">{entry.body}</p>
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
              <a href={`mailto:${request.businessEmail}`} className="dash-activity-row flex items-center gap-2 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[12px] font-semibold text-[#111827]">
                <Mail size={15} /> Open mail app
              </a>
              <a href={`tel:${request.phone}`} className="dash-activity-row flex items-center gap-2 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[12px] font-semibold text-[#111827]">
                <Phone size={15} /> Call contact
              </a>
              {request.phone ? (
                <a
                  href={`https://wa.me/${String(request.phone).replace(/\D/g, "").length === 10 ? "91" : ""}${String(request.phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${request.contactName}, regarding your AR360 Enterprise plan.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="dash-activity-row flex items-center gap-2 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[12px] font-semibold text-[#111827]"
                >
                  WhatsApp contact
                </a>
              ) : null}
            </div>
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

          <section className="dash-premium-card p-4 md:p-5">
            <button
              type="button"
              onClick={() => setShowAdvancedFulfill((value) => !value)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <div>
                <h2 className="text-[14px] font-bold text-[#111827]">Advanced</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  Legacy plan templates, quote versions, and raw installment form
                </p>
              </div>
              {showAdvancedFulfill ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
            </button>
            {showAdvancedFulfill ? (
              <div className="mt-4 space-y-5 border-t border-[#ECECEC] pt-4">
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
                  <UserFilterDropdown
                    hideLabel
                    compact
                    className="w-full"
                    menuWidth={180}
                    label="Billing cycle"
                    menuTitle="Billing cycle"
                    value={planForm.billingCycle}
                    options={["monthly", "yearly"]}
                    onChange={(value) => setPlanForm({ ...planForm, billingCycle: value })}
                    renderOption={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
                    renderValue={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
                  />
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
                <UserFilterDropdown
                  hideLabel
                  compact
                  className="w-full"
                  menuWidth={280}
                  label="Custom plan"
                  menuTitle="Custom plan"
                  value={quoteForm.customPlanUid || "none"}
                  options={["none", ...customPlans.filter((plan) => plan.isActive).map((plan) => plan.customPlanUid)]}
                  onChange={(value) => choosePlan(value === "none" ? "" : value)}
                  renderOption={(value) =>
                    value === "none"
                      ? "Select active custom plan"
                      : customPlans.find((plan) => plan.customPlanUid === value)?.name || value
                  }
                  renderValue={(value) =>
                    value === "none"
                      ? "Select active custom plan"
                      : customPlans.find((plan) => plan.customPlanUid === value)?.name || value
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <UserFilterDropdown
                    hideLabel
                    compact
                    className="w-full"
                    menuWidth={180}
                    label="Billing cycle"
                    menuTitle="Billing cycle"
                    value={quoteForm.billingCycle}
                    options={["monthly", "yearly"]}
                    onChange={(value) => setQuoteForm({ ...quoteForm, billingCycle: value })}
                    renderOption={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
                    renderValue={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
                  />
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
                <UserFilterDropdown
                  hideLabel
                  compact
                  className="w-full"
                  menuWidth={320}
                  label="Quote"
                  menuTitle="Quote"
                  value={paymentForm.quoteUid || "none"}
                  options={["none", ...request.quotes.map((quote) => quote.quoteUid)]}
                  onChange={(value) => {
                    const nextUid = value === "none" ? "" : value;
                    const quote = request.quotes.find((item) => item.quoteUid === nextUid);
                    const remaining = quote?.remainingPaise ?? quote?.pricePaise ?? 0;
                    setPaymentForm({
                      ...paymentForm,
                      quoteUid: nextUid,
                      amount: remaining ? String(remaining / 100) : "",
                    });
                  }}
                  renderOption={(value) => {
                    if (value === "none") return "Select quote (prefer FINAL)";
                    const quote = request.quotes.find((item) => item.quoteUid === value);
                    if (!quote) return value;
                    return `${quote.quoteNumber} v${quote.version}${finalQuote?.quoteUid === quote.quoteUid ? " · FINAL" : ""} · rem ${formatMoney(quote.remainingPaise)}`;
                  }}
                  renderValue={(value) => {
                    if (value === "none") return "Select quote (prefer FINAL)";
                    const quote = request.quotes.find((item) => item.quoteUid === value);
                    if (!quote) return value;
                    return `${quote.quoteNumber} v${quote.version}${finalQuote?.quoteUid === quote.quoteUid ? " · FINAL" : ""}`;
                  }}
                />
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
              </div>
            ) : null}
          </section>
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
