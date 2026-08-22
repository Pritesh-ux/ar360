"use client";

import { Download, ExternalLink, Eye, Mail, X } from "lucide-react";
import { AdminButton, AdminLoadingState } from "@/components/ui/admin";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";
import ViewportPortal from "@/components/shared/ViewportPortal";

export type EmailLogDetail = {
  id: number;
  recipient: string;
  subject: string;
  template: string;
  templateLabel: string;
  status: string;
  messageId: string | null;
  errorMessage: string | null;
  sentAt: string;
  createdAt: string;
  deliveryMode: string | null;
  bodyPreview: string | null;
  content: {
    title?: string;
    intro?: string;
    lines?: string[];
    details?: Array<{ label: string; value: string }>;
    actionLabel?: string | null;
    actionUrl?: string | null;
  } | null;
  invoice: {
    invoiceUid: string;
    invoiceNumber: string;
    customerUid: string;
    buyerName: string | null;
    buyerEmail: string | null;
    planId: string | null;
    status: string | null;
    totalPaise: number | null;
    issuedAt: string | null;
    viewUrl: string;
    downloadUrl: string;
  } | null;
  customerUid: string | null;
};

type Props = {
  open: boolean;
  loading?: boolean;
  log: EmailLogDetail | null;
  error?: string;
  onClose: () => void;
};

function statusClass(status: string) {
  if (status === "sent") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function formatMoney(paise: number | null | undefined) {
  if (paise == null || !Number.isFinite(paise)) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export default function EmailLogDetailModal({ open, loading, log, error, onClose }: Props) {
  if (!open) return null;

  return (
    <ViewportPortal>
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#ECECEC] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#ECECEC] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
              <Mail size={14} className="text-[#84D400]" />
              Email detail
            </div>
            <h2 className="truncate text-[18px] font-black text-[#111827]">
              {log?.subject || (loading ? "Loading..." : "Email log")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? <AdminLoadingState label="Loading email detail..." /> : null}
          {!loading && error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">{error}</p>
          ) : null}
          {!loading && !error && log ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Recipient" value={log.recipient} />
                <DetailField label="Template" value={log.templateLabel} />
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Status</p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClass(log.status)}`}
                  >
                    {log.status}
                  </span>
                </div>
                <DetailField label="Sent" value={fmtDateTime(log.sentAt)} />
                {log.deliveryMode ? <DetailField label="Delivery" value={log.deliveryMode} /> : null}
                {log.messageId ? <DetailField label="Message ID" value={log.messageId} /> : null}
                {log.customerUid ? <DetailField label="Customer UID" value={log.customerUid} /> : null}
              </div>

              {log.errorMessage ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-red-500">Error</p>
                  <p className="mt-1 text-[13px] font-semibold text-red-700">{log.errorMessage}</p>
                </div>
              ) : null}

              {log.invoice ? (
                <div className="rounded-2xl border border-[#E8F5C8] bg-[#F7FCE8] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#4D8C00]">
                        Linked invoice
                      </p>
                      <p className="mt-1 text-[16px] font-black text-[#102000]">
                        {log.invoice.invoiceNumber}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-[#3D6600]">
                        {log.invoice.buyerName ? <span>{log.invoice.buyerName}</span> : null}
                        {log.invoice.planId ? <span>Plan: {log.invoice.planId}</span> : null}
                        {formatMoney(log.invoice.totalPaise) ? (
                          <span>Total: {formatMoney(log.invoice.totalPaise)}</span>
                        ) : null}
                        {log.invoice.status ? <span>Status: {log.invoice.status}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={log.invoice.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-1.5 rounded-[14px] border border-[#ECECEC] bg-white px-4 text-[13px] font-semibold text-[#374151] transition hover:bg-[#FAFAFB]"
                      >
                        <Eye size={14} />
                        View invoice
                      </a>
                      <a
                        href={log.invoice.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-[#B6FF38] px-4 text-[13px] font-bold text-[#102000] transition hover:bg-[#A6FF2E]"
                      >
                        <Download size={14} />
                        Download PDF
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-[#ECECEC] bg-[#FAFAFB] px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  Mail content
                </p>
                {log.content?.title ? (
                  <p className="mt-2 text-[15px] font-black text-[#111827]">{log.content.title}</p>
                ) : null}
                {log.content?.intro ? (
                  <p className="mt-1 text-[13px] font-medium leading-6 text-[#4B5563]">{log.content.intro}</p>
                ) : null}
                {log.content?.details?.length ? (
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {log.content.details.map((detail) => (
                      <div key={`${detail.label}-${detail.value}`} className="rounded-xl bg-white px-3 py-2">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                          {detail.label}
                        </dt>
                        <dd className="text-[13px] font-semibold text-[#111827]">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {log.content?.actionUrl ? (
                  <a
                    href={log.content.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#4D8C00] hover:underline"
                  >
                    {log.content.actionLabel || "Open link"}
                    <ExternalLink size={13} />
                  </a>
                ) : null}
                {!log.content?.title && log.bodyPreview ? (
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[13px] font-medium leading-6 text-[#374151]">
                    {log.bodyPreview}
                  </pre>
                ) : null}
                {!log.content?.title && !log.bodyPreview ? (
                  <p className="mt-2 text-[13px] font-medium text-[#9CA3AF]">
                    Full body was not stored for this older log. Subject and delivery details are shown above.
                    {log.invoice
                      ? " Use View / Download to open the linked invoice."
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#ECECEC] px-5 py-4">
          <AdminButton type="button" variant="secondary" onClick={onClose}>
            Close
          </AdminButton>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className="break-all text-[13px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
