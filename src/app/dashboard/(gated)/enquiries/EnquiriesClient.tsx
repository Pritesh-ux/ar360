"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { Inbox, Search } from "lucide-react";
import Link from "next/link";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import StatusBadge from "@/components/user-panel/StatusBadge";
import ViewportPortal from "@/components/shared/ViewportPortal";
import { panelTable, panelTableRowClass } from "@/components/user-panel/panel-table";
import { useUserPanelSession } from "@/components/user-panel/UserPanelContext";
import type { EnquiryStatus, ProductEnquiryRecord } from "@/lib/viewer-contact/types";

const STATUS_TABS: { key: EnquiryStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "converted", label: "Converted" },
  { key: "closed", label: "Closed" },
];

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusTone(status: string): "success" | "warning" | "neutral" | "danger" {
  if (status === "new") return "warning";
  if (status === "converted") return "success";
  if (status === "closed") return "neutral";
  return "neutral";
}

export default function EnquiriesClient() {
  const session = useUserPanelSession();
  const allowed = session?.features?.allowProductContact === true;
  const [items, setItems] = useState<ProductEnquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<EnquiryStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ProductEnquiryRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, pageSize: "50" });
      if (q) params.set("q", q);
      const res = await fetch(`/api/product-enquiries?${params}`, { cache: "no-store" });
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useDeferredEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, allowed]);

  const selectedLive = useMemo(
    () => items.find((item) => item.enquiryUid === selected?.enquiryUid) || selected,
    [items, selected],
  );

  async function updateStatus(enquiryUid: string, next: EnquiryStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/product-enquiries/${encodeURIComponent(enquiryUid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setItems((prev) =>
        prev.map((item) => (item.enquiryUid === enquiryUid ? { ...item, ...(data.enquiry || {}), status: next } : item)),
      );
      setSelected((prev) => (prev?.enquiryUid === enquiryUid ? { ...prev, status: next } : prev));
    } finally {
      setSaving(false);
    }
  }

  return (
    <UserPanelPageShell>
      {!allowed ? (
        <>
          <UserPageHeader
            title="Enquiries"
            subtitle="Leads from Enquire on your public product viewers."
          />
          <section className="dash-premium-card p-6">
            <p className="text-sm font-medium text-[#525252]">
              Enquire inbox is available on Trial, Business, and Enterprise plans.
            </p>
            <Link
              href="/dashboard/subscription"
              className="mt-4 inline-flex h-10 items-center rounded-2xl bg-[#B6FF38] px-4 text-sm font-semibold text-[#102000]"
            >
              Upgrade plan
            </Link>
          </section>
        </>
      ) : (
        <>
      <UserPageHeader
        title="Enquiries"
        subtitle="Leads from Enquire on your public product viewers."
        actions={
          <div className="dash-products-search min-w-0 flex-1 sm:min-w-[280px]">
            <Search size={16} className="dash-products-search__icon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQ(search.trim())}
              placeholder="Search name, phone, email, product..."
              className="dash-products-input dash-products-input--icon"
            />
          </div>
        }
      />

      <section className="flex min-h-[480px] flex-1 flex-col overflow-hidden dash-premium-card">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ECECEC] px-3 sm:px-5">
          <div className="flex overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const active = status === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatus(tab.key)}
                  className={`relative shrink-0 px-3 py-3.5 text-[13px] font-semibold ${
                    active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                  }`}
                >
                  {tab.label}
                  {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <UserWorkspaceLoading className="min-h-[420px]" label="Loading Enquiries" hint="Fetching viewer leads..." />
        ) : items.length === 0 ? (
          <div className="flex min-h-[420px] flex-1 items-center justify-center px-5 py-12 text-center">
            <div>
              <Inbox size={32} className="mx-auto text-[#D4D4D4]" />
              <p className="mt-3 text-sm font-semibold text-[#111111]">No enquiries yet</p>
              <p className="mt-1 text-xs font-medium text-[#737373]">
                Enable Enquire in Settings, then shoppers can send leads from the viewer.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className={panelTable.table}>
              <thead>
                <tr className={panelTable.theadRow}>
                  <th className={panelTable.th}>Customer</th>
                  <th className={panelTable.th}>Product</th>
                  <th className={panelTable.th}>Message</th>
                  <th className={panelTable.th}>Date</th>
                  <th className={panelTable.th}>Status</th>
                  <th className={panelTable.th}>Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.enquiryUid}
                    className={panelTableRowClass({ clickable: true, active: selected?.enquiryUid === item.enquiryUid })}
                    onClick={() => setSelected(item)}
                  >
                    <td className={panelTable.td}>
                      <div className="font-semibold text-[#111111]">{item.visitorName}</div>
                      <div className="text-xs text-[#737373]">{item.visitorPhone}</div>
                      {item.visitorEmail ? <div className="text-xs text-[#737373]">{item.visitorEmail}</div> : null}
                    </td>
                    <td className={panelTable.td}>{item.productTitle}</td>
                    <td className={`${panelTable.td} max-w-[240px] truncate text-[#525252]`}>
                      {item.message || "—"}
                    </td>
                    <td className={panelTable.td}>{fmtDate(item.createdAt)}</td>
                    <td className={panelTable.td}>
                      <StatusBadge label={item.status} tone={statusTone(item.status)} />
                    </td>
                    <td className={panelTable.td}>{item.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedLive ? (
        <ViewportPortal>
          <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-t-[20px] border border-[#ECECEC] bg-white sm:rounded-[20px]">
              <div className="border-b border-[#ECECEC] px-5 py-4">
                <h2 className="text-lg font-semibold text-[#111111]">{selectedLive.visitorName}</h2>
                <p className="mt-1 text-xs font-medium text-[#737373]">{selectedLive.productTitle}</p>
              </div>
              <div className="space-y-2 px-5 py-4 text-sm">
                <p><span className="font-semibold">Phone:</span> {selectedLive.visitorPhone}</p>
                <p><span className="font-semibold">Email:</span> {selectedLive.visitorEmail || "—"}</p>
                <p><span className="font-semibold">Date:</span> {fmtDate(selectedLive.createdAt)}</p>
                <p><span className="font-semibold">Source:</span> {selectedLive.source}</p>
                {selectedLive.viewerUrl ? (
                  <p className="break-all">
                    <span className="font-semibold">Viewer:</span> {selectedLive.viewerUrl}
                  </p>
                ) : null}
                <p className="rounded-2xl bg-[#FAFAFA] p-3 text-[#525252]">{selectedLive.message || "No message"}</p>
                <UserFilterDropdown
                  label="Status"
                  value={selectedLive.status}
                  options={["new", "contacted", "converted", "closed"]}
                  onChange={(value) => void updateStatus(selectedLive.enquiryUid, value as EnquiryStatus)}
                />
              </div>
              <div className="flex justify-end border-t border-[#ECECEC] px-5 py-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setSelected(null)}
                  className="h-11 rounded-2xl border border-[#ECECEC] px-4 text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ViewportPortal>
      ) : null}
        </>
      )}
    </UserPanelPageShell>
  );
}
