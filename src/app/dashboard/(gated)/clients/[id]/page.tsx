"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Search, X } from "lucide-react";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import ViewportPortal from "@/components/shared/ViewportPortal";
import ClientWorkspaceShell from "@/components/features/clients/workspace/ClientWorkspaceShell";
import { useUserPanelToast } from "@/components/user-panel/UserPanelToastContext";
import type {
  ClientWorkspaceData,
  ClientWorkspaceTab,
} from "@/lib/user-panel/client-workspace";

function resourceIdOf(item: Record<string, unknown>) {
  return String(item.id || item.productUid || item.product_uid || item.domain || "").trim();
}

function resourceLabelOf(item: Record<string, unknown>) {
  return String(item.title || item.name || item.domain || "Untitled").trim();
}

export default function ClientWorkspacePage() {
  const router = useRouter();
  const { id: clientUid } = useParams() as { id: string };
  const { showToast } = useUserPanelToast();

  const [data, setData] = useState<ClientWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ClientWorkspaceTab>("products");
  const [saving, setSaving] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [searchResourceQuery, setSearchResourceQuery] = useState("");
  const [unlinkedResources, setUnlinkedResources] = useState<Record<string, unknown>[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkingBusy, setLinkingBusy] = useState(false);

  const loadClientDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientUid}`, { cache: "no-store" });
      const body = await res.json();
      if (res.ok && body.success) {
        setData({
          client: body.client,
          products: body.products || [],
          qrCodes: body.qrCodes || [],
          domains: body.domains || [],
          activities: body.activities || [],
        });
      } else {
        setError(body.error || "Client profile not found.");
      }
    } catch (err) {
      console.error(err);
      setError("Workspace communication failed.");
    } finally {
      setLoading(false);
    }
  }, [clientUid]);

  useDeferredEffect(() => {
    if (clientUid) void loadClientDetails();
  }, [clientUid, loadClientDetails]);

  useDeferredEffect(() => {
    if (!showAssign) return;
    setLinkLoading(true);
    setUnlinkedResources([]);
    setSearchResourceQuery("");
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientUid}?linkable=product`, {
          cache: "no-store",
        });
        const body = await res.json();
        if (res.ok) {
          setUnlinkedResources(Array.isArray(body.items) ? body.items : []);
        } else {
          showToast(body.error || "Could not load products.", "err");
        }
      } catch {
        showToast("Could not load products.", "err");
      } finally {
        setLinkLoading(false);
      }
    })();
  }, [showAssign, clientUid]);

  const filteredUnlinkedList = useMemo(() => {
    const q = searchResourceQuery.trim().toLowerCase();
    if (!q) return unlinkedResources;
    return unlinkedResources.filter((item) => resourceLabelOf(item).toLowerCase().includes(q));
  }, [unlinkedResources, searchResourceQuery]);

  async function handleAssign(resourceId: string) {
    if (linkingBusy || !resourceId) return;
    setLinkingBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientUid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link",
          resourceType: "product",
          resourceId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowAssign(false);
        showToast("Product assigned.");
        await loadClientDetails();
      } else {
        showToast(body.error || "Assign failed.", "err");
      }
    } finally {
      setLinkingBusy(false);
    }
  }

  async function handleUnlinkProduct(productId: string) {
    if (!confirm("Remove this product from the client workspace?")) return;
    const res = await fetch(`/api/clients/${clientUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unlink",
        resourceType: "product",
        resourceId: productId,
      }),
    });
    if (res.ok) {
      showToast("Product removed.");
      await loadClientDetails();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || "Remove failed.", "err");
    }
  }

  async function handleSave(payload: Record<string, unknown>) {
    const silent = Boolean(payload.silent);
    const body = { ...payload };
    delete body.silent;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (!silent) {
          showToast("Saved.");
          await loadClientDetails();
        }
      } else {
        showToast(json.error || "Save failed.", "err");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadLogo(file: File) {
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch(`/api/clients/${clientUid}/logo`, { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast("Logo uploaded.");
      await loadClientDetails();
    } else {
      showToast(body.error || "Logo upload failed.", "err");
    }
  }

  async function handleRemoveLogo() {
    const res = await fetch(`/api/clients/${clientUid}/logo`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast("Logo removed.");
      await loadClientDetails();
    } else {
      showToast(body.error || "Could not remove logo.", "err");
    }
  }

  async function handleDeleteClient() {
    if (!confirm("Delete this client permanently?")) return;
    const res = await fetch(`/api/clients/${clientUid}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/clients");
    else showToast("Delete failed.", "err");
  }

  if (loading) {
    return (
      <UserPanelPageShell>
        <UserWorkspaceLoading
          label="Loading Client"
          hint="Please wait while we prepare this client workspace..."
        />
      </UserPanelPageShell>
    );
  }

  if (error || !data) {
    return (
      <UserPanelPageShell>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
          <AlertCircle className="text-amber-500" />
          <p className="text-sm font-semibold text-[#111111]">{error || "Not found"}</p>
        </div>
      </UserPanelPageShell>
    );
  }

  return (
    <UserPanelPageShell>
      <ClientWorkspaceShell
        data={data}
        tab={tab}
        onTabChange={setTab}
        saving={saving}
        onAssignProduct={() => setShowAssign(true)}
        onUnlinkProduct={(id) => void handleUnlinkProduct(id)}
        onSave={handleSave}
        onUploadLogo={handleUploadLogo}
        onRemoveLogo={handleRemoveLogo}
        onDeleteClient={() => void handleDeleteClient()}
      />

      {showAssign ? (
        <ViewportPortal>
          <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            onClick={() => setShowAssign(false)}
            role="presentation"
          >
            <div
              className="flex max-h-[86dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-[#ECECEC] px-5 py-4">
                <h3 className="text-base font-extrabold text-[#111111]">Assign product</h3>
                <button
                  type="button"
                  onClick={() => setShowAssign(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="border-b border-[#ECECEC] px-5 py-3">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]"
                  />
                  <input
                    value={searchResourceQuery}
                    onChange={(e) => setSearchResourceQuery(e.target.value)}
                    placeholder="Search…"
                    className="h-10 w-full rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] pl-9 pr-3 text-sm outline-none focus:border-[#84D400]"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {linkLoading ? (
                  <p className="p-6 text-center text-sm text-[#737373]">Loading…</p>
                ) : filteredUnlinkedList.length === 0 ? (
                  <p className="p-6 text-center text-sm text-[#737373]">
                    No products available to assign.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {filteredUnlinkedList.map((item) => {
                      const id = resourceIdOf(item);
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            disabled={linkingBusy || !id}
                            onClick={() => void handleAssign(id)}
                            className="flex w-full items-center justify-between rounded-2xl border border-[#ECECEC] px-4 py-3 text-left text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-50"
                          >
                            <span className="truncate">{resourceLabelOf(item)}</span>
                            <span className="text-[11px] font-bold text-[#5FA800]">Assign</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </ViewportPortal>
      ) : null}
    </UserPanelPageShell>
  );
}
