"use client";

import Link from "next/link";
import { useEffect, useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { Download, Eye, Search, ScanLine, X } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminEmptyState, AdminLoadingState, AdminPagination } from "@/components/ui/admin";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import type { AdminCaptureJob } from "@/lib/master-admin/object-capture.service";
import type { PaginationMeta } from "@/lib/master-admin/pagination";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import { Activity, Clock, Layers, Scan, AlertTriangle } from "lucide-react";

type Payload = {
  jobs: AdminCaptureJob[];
  pagination: PaginationMeta;
  metrics: Record<string, number>;
  assignees: { id: number; name: string }[];
};

const PAGE_SIZE = 20;
const PROCESSING_OPTIONS = [
  "all",
  "pending",
  "uploading",
  "validating",
  "action_required",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
];
const REVIEW_OPTIONS = ["all", "unreviewed", "in_review", "approved", "rejected", "recapture_requested"];
const PRIORITY_OPTIONS = ["all", "low", "normal", "high", "urgent"];

const statusTone: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  processing: "bg-sky-50 text-sky-700",
  queued: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
  action_required: "bg-orange-50 text-orange-700",
};

function age(createdAt: string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 36e5));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function ObjectCaptureQueueClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("all"));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  const params = useCallback(
    (withPage = true) => {
      const value = new URLSearchParams();
      if (withPage) {
        value.set("page", String(page));
        value.set("pageSize", String(PAGE_SIZE));
      }
      if (search.trim()) value.set("search", search.trim());
      if (status !== "all") value.set("status", status);
      if (reviewStatus !== "all") value.set("reviewStatus", reviewStatus);
      if (assignee !== "all") value.set("assignee", assignee);
      if (priority !== "all") value.set("priority", priority);
      if (dateRange.from) value.set("dateFrom", dateRange.from);
      if (dateRange.to) value.set("dateTo", dateRange.to);
      return value;
    },
    [search, status, reviewStatus, assignee, priority, dateRange.from, dateRange.to, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/master-admin/object-capture/jobs?${params()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to load queue");
      setData(json);
      setSelected([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load queue");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  const loadFeatureFlag = useCallback(async () => {
    try {
      const res = await fetch("/api/master-admin/settings", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setFeatureEnabled(json.settings?.objectCaptureEnabled !== false);
      }
    } catch {
      /* keep default true */
    }
  }, []);
  useDeferredEffect(() => {
    void loadFeatureFlag();
  }, [loadFeatureFlag]);

  async function toggleFeature() {
    setToggling(true);
    try {
      const newState = !featureEnabled;
      const res = await fetch("/api/master-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { objectCaptureEnabled: newState },
          confirm: true,
          reason: newState ? "Re-enable Object Capture for all users" : "Disable Object Capture globally for all users",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update setting");
      }
      setFeatureEnabled(newState);
      setMessage(
        newState ? "Object Capture enabled for all users." : "Object Capture disabled. All users lost access.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Toggle failed");
    } finally {
      setToggling(false);
      setConfirmToggle(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setReviewStatus("all");
    setAssignee("all");
    setPriority("all");
    setDateRange(defaultDateRange("all"));
    setPage(1);
  }

  const hasFilters = Boolean(
    search ||
      status !== "all" ||
      reviewStatus !== "all" ||
      assignee !== "all" ||
      priority !== "all" ||
      dateRange.preset !== "all",
  );

  async function bulk(action: "assign" | "retry" | "cancel" | "priority") {
    const reason = window.prompt(`Reason for bulk ${action}:`)?.trim();
    if (!reason) return;
    let assignedAdminId: string | null | undefined;
    let priorityValue: string | undefined;
    if (action === "assign") assignedAdminId = window.prompt("Assignee admin ID (blank to unassign):") ?? undefined;
    if (action === "priority") priorityValue = window.prompt("Priority: low, normal, high, or urgent") || undefined;
    const response = await fetch("/api/master-admin/object-capture/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, action, reason, assignedAdminId, priority: priorityValue }),
    });
    const json = await response.json();
    setMessage(response.ok ? `${json.succeeded} job(s) updated.` : json.error || "Bulk action failed");
    if (response.ok) await load();
  }

  const allChecked = Boolean(data?.jobs.length) && data!.jobs.every((job) => selected.includes(job.id));
  const assigneeOptions = ["all", "unassigned", ...(data?.assignees.map((a) => String(a.id)) || [])];

  const metricCards = [
    { title: "Total", value: data?.metrics.total ?? 0, icon: Layers, accent: "sky" as const },
    { title: "Queued", value: data?.metrics.queued ?? 0, icon: Clock, accent: "amber" as const },
    { title: "Processing", value: data?.metrics.processing ?? 0, icon: Activity, accent: "violet" as const },
    { title: "Needs review", value: data?.metrics.review ?? 0, icon: Scan, accent: "lime" as const },
    { title: "Failed", value: data?.metrics.failed ?? 0, icon: AlertTriangle, accent: "rose" as const },
  ];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Object Capture"
        subtitle="Production reconstruction queue, quality review, and customer delivery."
        actions={
          <>
            <button
              type="button"
              onClick={() => setConfirmToggle(true)}
              className={`inline-flex h-10 items-center gap-2 rounded-[14px] px-3 text-[12px] font-semibold transition ${
                featureEnabled
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              }`}
              disabled={toggling}
            >
              <ScanLine size={15} />
              {toggling ? "Updating…" : featureEnabled ? "Feature ON" : "Feature OFF"}
            </button>
            <button
              type="button"
              onClick={() => window.open(`/api/master-admin/object-capture/jobs?${params(false)}&export=csv`, "_blank")}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <Download size={15} />
              Export CSV
            </button>
          </>
        }
      />

      {message ? (
        <div
          className={`dash-premium-card flex items-center justify-between gap-3 px-4 py-3 ${
            message.includes("updated") || message.includes("enabled")
              ? "border-[#DCFCE7] bg-[#F0FDF4]"
              : "border-[#FEE2E2] bg-[#FEF2F2]"
          }`}
        >
          <p
            className={`text-[13px] font-semibold ${
              message.includes("updated") || message.includes("enabled") ? "text-[#166534]" : "text-[#991B1B]"
            }`}
          >
            {message}
          </p>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="grid h-8 w-8 place-items-center rounded-[10px] hover:bg-white/70"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((card) => (
          <UserMetricCard
            key={card.title}
            title={card.title}
            value={String(card.value ?? "—")}
            icon={card.icon}
            accent={card.accent}
            compact
          />
        ))}
      </section>

      <section className="dash-premium-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
          <div className="relative min-w-[200px] flex-1 basis-[220px] max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Job, customer, email, product…"
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Processing"
            menuTitle="Processing status"
            value={status}
            options={PROCESSING_OPTIONS}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            renderOption={(v) => (v === "all" ? "All processing" : v.replaceAll("_", " "))}
            renderValue={(v) => (v === "all" ? "All processing" : v.replaceAll("_", " "))}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[138px] shrink-0"
            label="Review"
            menuTitle="Review status"
            value={reviewStatus}
            options={REVIEW_OPTIONS}
            onChange={(v) => {
              setReviewStatus(v);
              setPage(1);
            }}
            renderOption={(v) => (v === "all" ? "All reviews" : v.replaceAll("_", " "))}
            renderValue={(v) => (v === "all" ? "All reviews" : v.replaceAll("_", " "))}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Assignee"
            menuTitle="Assignee"
            value={assignee}
            options={assigneeOptions}
            onChange={(v) => {
              setAssignee(v);
              setPage(1);
            }}
            renderOption={(v) => {
              if (v === "all") return "All assignees";
              if (v === "unassigned") return "Unassigned";
              return data?.assignees.find((a) => String(a.id) === v)?.name || v;
            }}
            renderValue={(v) => {
              if (v === "all") return "All assignees";
              if (v === "unassigned") return "Unassigned";
              return data?.assignees.find((a) => String(a.id) === v)?.name || v;
            }}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[138px] shrink-0"
            label="Priority"
            menuTitle="Priority"
            value={priority}
            options={PRIORITY_OPTIONS}
            onChange={(v) => {
              setPriority(v);
              setPage(1);
            }}
            renderOption={(v) => (v === "all" ? "All priorities" : v)}
            renderValue={(v) => (v === "all" ? "All priorities" : v)}
          />

          <UserDateRangePicker value={dateRange} onChange={setDateRange} />

          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex h-10 shrink-0 items-center rounded-[14px] px-3 text-[12px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              Clear
            </button>
          ) : null}
        </div>

        {selected.length ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] bg-[#F0FDF4] px-4 py-3 text-[12px] font-semibold text-[#166534]">
            {selected.length} selected
            <button
              type="button"
              onClick={() => void bulk("assign")}
              className="inline-flex h-8 items-center rounded-[10px] border border-[#ECECEC] bg-white px-3 text-[11px] font-semibold text-[#111827] hover:bg-[#FAFAFB]"
            >
              Assign
            </button>
            <button
              type="button"
              onClick={() => void bulk("retry")}
              className="inline-flex h-8 items-center rounded-[10px] border border-[#ECECEC] bg-white px-3 text-[11px] font-semibold text-[#111827] hover:bg-[#FAFAFB]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void bulk("cancel")}
              className="inline-flex h-8 items-center rounded-[10px] border border-[#ECECEC] bg-white px-3 text-[11px] font-semibold text-[#111827] hover:bg-[#FAFAFB]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void bulk("priority")}
              className="inline-flex h-8 items-center rounded-[10px] border border-[#ECECEC] bg-white px-3 text-[11px] font-semibold text-[#111827] hover:bg-[#FAFAFB]"
            >
              Priority
            </button>
          </div>
        ) : null}

        {loading ? (
          <AdminLoadingState label="Loading capture queue…" />
        ) : !data?.jobs.length ? (
          <AdminEmptyState title="No capture jobs found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-left">
              <thead>
                <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => setSelected(e.target.checked ? data.jobs.map((j) => j.id) : [])}
                      className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                    />
                  </th>
                  <th className="px-3 py-3">Job / customer</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Review</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Progress</th>
                  <th className="px-3 py-3">Queue age</th>
                  <th className="px-3 py-3">Assignee</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((job) => (
                  <tr key={job.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(job.id)}
                        onChange={(e) =>
                          setSelected((s) => (e.target.checked ? [...s, job.id] : s.filter((id) => id !== job.id)))
                        }
                        className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        className="block text-[12px] font-bold text-[#111827] hover:text-[#5AA700]"
                        href={`/master-admin/object-capture/${job.id}`}
                      >
                        {job.id}
                      </Link>
                      <Link
                        className="text-[11px] font-medium text-[#9CA3AF] hover:underline"
                        href={`/master-admin/customers/${job.customerUid}`}
                      >
                        {job.customerName}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone[job.status] || "bg-slate-100"}`}
                      >
                        {job.status}
                      </span>
                      <p className="mt-1 text-[10px] text-[#9CA3AF]">{job.processingStage}</p>
                    </td>
                    <td className="px-3 py-3 text-[11px] font-semibold text-[#374151]">
                      {job.reviewStatus.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-3 text-[11px] font-bold uppercase text-[#111827]">{job.priority}</td>
                    <td className="px-3 py-3">
                      <div className="h-1.5 w-24 rounded bg-[#F3F4F6]">
                        <div className="h-full rounded bg-[#84D400]" style={{ width: `${job.progress}%` }} />
                      </div>
                      <span className="text-[10px] text-[#9CA3AF]">
                        {job.progress}% · {job.photoCount} photos
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[11px] font-semibold text-[#374151]">{age(job.createdAt)}</td>
                    <td className="px-3 py-3 text-[11px] text-[#374151]">{job.assignedAdminName || "Unassigned"}</td>
                    <td className="px-3 py-3">
                      {job.productId ? (
                        <Link
                          className="text-[11px] font-bold text-[#5AA700]"
                          href={`/master-admin/products/${job.productId}`}
                        >
                          {job.productTitle || job.productId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/master-admin/object-capture/${job.id}`}
                        aria-label="View job"
                        className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                      >
                        <Eye size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#ECECEC] px-2">
          <AdminPagination
            page={page}
            totalPages={data?.pagination.totalPages || 1}
            meta={data?.pagination}
            onPageChange={setPage}
          />
        </div>
      </section>

      {!featureEnabled && (
        <div className="dash-premium-card border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ScanLine size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Object Capture is DISABLED globally</p>
              <p className="text-[12px] font-medium text-red-600">
                All users have lost access. The sidebar link is hidden and API requests are blocked. New capture jobs
                cannot be created.
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmToggle}
        title={featureEnabled ? "Disable Object Capture?" : "Enable Object Capture?"}
        description={
          featureEnabled
            ? "All users will lose access immediately. The sidebar link will be hidden and new capture jobs will be blocked. Existing jobs in the queue will remain visible to admins."
            : "All users will regain access to Object Capture (subject to their plan permissions). The sidebar link will reappear."
        }
        confirmText={featureEnabled ? "Disable for All Users" : "Enable for All Users"}
        danger={featureEnabled}
        onCancel={() => setConfirmToggle(false)}
        onConfirm={() => void toggleFeature()}
      />
    </div>
  );
}
