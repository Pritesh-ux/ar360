"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminLoadingState, adminTableHeadClass, adminTableRowClass } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type Detail = {
  client: {
    customerUid: string;
    companyName: string | null;
    email: string | null;
    updatePolicy: string;
    status: string;
    currentReleaseId: number | null;
    currentReleaseVersion: string | null;
    targetReleaseId: number | null;
    targetReleaseVersion: string | null;
    approvedAt: string | null;
    autoLabel: string;
    productCounts: {
      total: number;
      eligible: number;
      blocked: number;
      migrated: number;
      pending: number;
    };
  };
  products: Array<{
    productId: string;
    title: string | null;
    code: string;
    message: string;
  }>;
  publishedReleases: Array<{ id: number; version: string; channel: string; status: string }>;
};

export default function Ar360ClientUpdateDetailPage() {
  const params = useParams<{ customerUid: string }>();
  const customerUid = params?.customerUid ? decodeURIComponent(params.customerUid) : "";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [policy, setPolicy] = useState("MANUAL");
  const [targetId, setTargetId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/master-admin/ar360/client-updates/${encodeURIComponent(customerUid)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setDetail(data);
      setPolicy(data.client?.updatePolicy || "MANUAL");
      setTargetId(
        data.client?.targetReleaseId != null ? String(data.client.targetReleaseId) : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [customerUid]);

  useDeferredEffect(() => {
    if (customerUid) void load();
  }, [load, customerUid]);

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(
        `/api/master-admin/ar360/client-updates/${encodeURIComponent(customerUid)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setMessage(data.warning || "Saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium p-4">
        <AdminLoadingState label="Loading client update state…" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="master-admin-panel dash-premium p-4 text-[13px] font-semibold text-[#991B1B]">
        {error || "Client not found"}
      </div>
    );
  }

  const { client, products, publishedReleases } = detail;

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title={client.companyName || client.customerUid}
        subtitle={`Client update policy · ${client.status}`}
        backHref="/master-admin/ar360-system/client-updates"
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Client Updates", href: "/master-admin/ar360-system/client-updates" },
          { label: client.customerUid },
        ]}
      />

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="dash-premium-card border-[#D1FAE5] bg-[#ECFDF5] px-4 py-3 text-[13px] font-semibold text-[#065F46]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="dash-premium-card space-y-2 p-4 text-[13px]">
          <div className="font-semibold">Client</div>
          <div>{client.companyName || "—"}</div>
          <div className="text-[#6B7280]">{client.email || "—"}</div>
          <div className="text-[11px] text-[#6B7280]">{client.customerUid}</div>
          <div className="pt-2">
            Current release: <strong>{client.currentReleaseVersion || "—"}</strong>
          </div>
          <div>
            Available / target: <strong>{client.targetReleaseVersion || "—"}</strong>
          </div>
          <div>
            Status: <strong>{client.status}</strong>
          </div>
          {client.approvedAt ? (
            <div className="text-[12px] text-[#065F46]">
              Approved at {new Date(client.approvedAt).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="dash-premium-card space-y-3 p-4 text-[13px]">
          <div className="font-semibold">Policy</div>
          <select
            className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
          >
            <option value="MANUAL">MANUAL</option>
            <option value="APPROVAL_REQUIRED">APPROVAL_REQUIRED</option>
            <option value="AUTO">AUTO</option>
          </select>
          {policy === "AUTO" ? (
            <div className="rounded-lg bg-[#FFFBEB] px-3 py-2 text-[12px] font-semibold text-[#92400E]">
              {client.autoLabel}
            </div>
          ) : null}
          <button
            type="button"
            className="dash-premium-btn-primary h-9 px-3 text-[12px]"
            disabled={busy}
            onClick={() => void postAction({ action: "set_policy", policy })}
          >
            Save policy
          </button>

          <div className="pt-2 font-semibold">Target release</div>
          <select
            className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">— none —</option>
            {publishedReleases.map((r) => (
              <option key={r.id} value={r.id}>
                {r.version} ({r.channel}) #{r.id}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="dash-premium-btn-primary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() =>
                void postAction({
                  action: "set_target_release",
                  targetReleaseId: targetId ? Number(targetId) : null,
                })
              }
            >
              Set target
            </button>
            {client.updatePolicy === "APPROVAL_REQUIRED" ? (
              <button
                type="button"
                className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
                disabled={busy || !client.targetReleaseId}
                onClick={() => void postAction({ action: "approve" })}
              >
                Approve target
              </button>
            ) : null}
            <Link
              href="/master-admin/ar360-system/migrations"
              className="dash-premium-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
            >
              Open Migrations
            </Link>
          </div>
          <div className="text-[12px] text-[#6B7280]">
            Changing policy or target does not modify products, QR, subscriptions, or pointers.
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {(
          [
            ["Total", client.productCounts.total],
            ["Eligible", client.productCounts.eligible],
            ["Blocked", client.productCounts.blocked],
            ["Migrated", client.productCounts.migrated],
            ["Pending", client.productCounts.pending],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="dash-premium-card p-3">
            <div className="text-[11px] font-bold uppercase text-[#6B7280]">{label}</div>
            <div className="text-[18px] font-black">{value}</div>
          </div>
        ))}
      </div>

      <div className="dash-premium-card overflow-hidden p-0">
        <div className="border-b border-[#E5E7EB] px-4 py-3 text-[13px] font-semibold">
          Product eligibility (no migration)
        </div>
        <table className="min-w-full text-left text-[12px]">
          <thead>
            <tr className={adminTableHeadClass}>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId} className={adminTableRowClass}>
                <td className="px-4 py-2">
                  <div className="font-semibold">{p.title || "Untitled"}</div>
                  <div className="text-[11px] text-[#6B7280]">{p.productId}</div>
                </td>
                <td className="px-4 py-2 font-bold">{p.code}</td>
                <td className="px-4 py-2 text-[#6B7280]">{p.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
