"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CustomerDetailView, { type CustomerDetailPayload } from "@/components/features/master-admin/CustomerDetailView";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import { AdminActionMessage } from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";

type AddonAction = {
  type: "grant" | "revoke";
  slug: string;
  name: string;
};

export default function CustomerDetailClient({ data }: { data: CustomerDetailPayload }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [addonAction, setAddonAction] = useState<AddonAction | null>(null);
  const [addonReason, setAddonReason] = useState("");
  const [addonDuration, setAddonDuration] = useState<"never" | "monthly" | "yearly">("never");
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(action: "suspend" | "activate") {
    setBusy(true);
    setActionMessage("");
    try {
      const res = await fetch("/api/master-admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_uid: data.customer.customer_uid, action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `${action} failed`);
      setActionMessage(action === "suspend" ? "Customer suspended." : "Customer activated.");
      router.refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function impersonate() {
    setBusy(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/master-admin/customers/${encodeURIComponent(data.customer.customer_uid)}/impersonate`,
        { method: "POST" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Open as customer failed.");
      window.location.href = payload.redirectUrl || "/dashboard";
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Open as customer failed.");
      setBusy(false);
    }
  }

  async function resetPassword() {
    setBusy(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/master-admin/customers/${encodeURIComponent(data.customer.customer_uid)}/reset-password`,
        { method: "POST" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Password reset failed.");
      setConfirmReset(false);
      const extra = payload.devResetUrl ? ` Dev link: ${payload.devResetUrl}` : "";
      setActionMessage((payload.message || "Password reset email sent.") + extra);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomer() {
    setBusy(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/master-admin/customers/${encodeURIComponent(data.customer.customer_uid)}`,
        { method: "DELETE" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Delete failed.");
      setConfirmDelete(false);
      router.push("/master-admin/customers");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Delete failed.");
      setBusy(false);
    }
  }

  function openGrant(slug: string) {
    const addon = data.addons.find((a) => a.slug === slug);
    setAddonReason("");
    setAddonDuration("never");
    setAddonAction({ type: "grant", slug, name: addon?.name || slug });
  }

  function openRevoke(slug: string) {
    const addon = data.addons.find((a) => a.slug === slug);
    setAddonReason("");
    setAddonAction({ type: "revoke", slug, name: addon?.name || slug });
  }

  async function submitAddonAction() {
    if (!addonAction) return;
    if (addonReason.trim().length < 5) {
      setActionMessage("Reason must be at least 5 characters.");
      return;
    }
    setBusy(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/master-admin/customers/${encodeURIComponent(data.customer.customer_uid)}/addons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: addonAction.type,
            slug: addonAction.slug,
            duration: addonAction.type === "grant" ? addonDuration : undefined,
            reason: addonReason.trim(),
            confirm: true,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Add-on update failed.");
      setAddonAction(null);
      setActionMessage(
        addonAction.type === "grant"
          ? `${addonAction.name} granted.`
          : `${addonAction.name} revoked.`,
      );
      router.refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Add-on update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {actionMessage ? (
        <AdminActionMessage
          message={actionMessage}
          variant={/fail|error|cannot|not found|must be/i.test(actionMessage) ? "error" : "success"}
          className="mb-4"
        />
      ) : null}
      <CustomerDetailView
        data={data}
        busy={busy}
        onSuspend={() => void patch("suspend")}
        onActivate={() => void patch("activate")}
        onImpersonate={() => void impersonate()}
        onResetPassword={() => setConfirmReset(true)}
        onDelete={() => setConfirmDelete(true)}
        onGrantAddon={openGrant}
        onRevokeAddon={openRevoke}
      />
      <ConfirmModal
        open={confirmReset}
        title="Send password reset?"
        description={`Email a reset link to ${data.customer.email}. Customer must click the link within 60 minutes.`}
        confirmText={busy ? "Sending..." : "Send reset email"}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void resetPassword()}
      />
      <ConfirmModal
        open={confirmDelete}
        title="Delete customer?"
        description="This soft-deletes the customer account and cancels active subscriptions."
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteCustomer()}
      />
      <ConfirmModal
        open={Boolean(addonAction)}
        title={
          addonAction?.type === "revoke"
            ? `Revoke ${addonAction.name}?`
            : `Grant ${addonAction?.name || "add-on"}?`
        }
        description={
          addonAction?.type === "revoke"
            ? "Customer will lose access to this module immediately."
            : "Customer gets this module without checkout. Choose duration and add a reason."
        }
        confirmText={
          busy
            ? "Saving..."
            : addonAction?.type === "revoke"
              ? "Revoke access"
              : "Grant access"
        }
        danger={addonAction?.type === "revoke"}
        onCancel={() => setAddonAction(null)}
        onConfirm={() => void submitAddonAction()}
      >
        <div className="mb-4 space-y-3">
          {addonAction?.type === "grant" ? (
            <UserFilterDropdown
              compact
              className="w-full"
              menuWidth={240}
              label="Duration"
              menuTitle="Duration"
              value={addonDuration}
              options={["never", "monthly", "yearly"]}
              onChange={(value) => setAddonDuration(value as "never" | "monthly" | "yearly")}
              renderOption={(value) =>
                value === "never" ? "No expiry (manual)" : value === "monthly" ? "1 month" : "1 year"
              }
              renderValue={(value) =>
                value === "never" ? "No expiry (manual)" : value === "monthly" ? "1 month" : "1 year"
              }
            />
          ) : null}
          <label className="block text-[12px] font-bold text-slate-600">
            Reason (required)
            <textarea
              value={addonReason}
              onChange={(e) => setAddonReason(e.target.value)}
              rows={3}
              placeholder="e.g. Comp for Business upgrade support"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-800 outline-none focus:border-slate-400"
            />
          </label>
        </div>
      </ConfirmModal>
    </>
  );
}
