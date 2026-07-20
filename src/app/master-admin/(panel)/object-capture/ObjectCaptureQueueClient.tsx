"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, Eye, Search } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminActionMessage, AdminButton, AdminEmptyState, AdminFilterBar, AdminInput,
  AdminLoadingState, AdminPagination, AdminSelect, AdminTablePanel,
} from "@/components/ui/admin";
import type { AdminCaptureJob } from "@/lib/master-admin/object-capture.service";
import type { PaginationMeta } from "@/lib/master-admin/pagination";

type Payload = {
  jobs: AdminCaptureJob[]; pagination: PaginationMeta;
  metrics: Record<string, number>; assignees: { id: number; name: string }[];
};
const PAGE_SIZE = 20;
const statusTone: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700", processing: "bg-sky-50 text-sky-700",
  queued: "bg-amber-50 text-amber-700", failed: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-600", action_required: "bg-orange-50 text-orange-700",
};
function age(createdAt: string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 36e5));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function ObjectCaptureQueueClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", status: "", reviewStatus: "", assignee: "", priority: "", dateFrom: "", dateTo: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const params = useCallback((withPage = true) => {
    const value = new URLSearchParams();
    if (withPage) { value.set("page", String(page)); value.set("pageSize", String(PAGE_SIZE)); }
    Object.entries(filters).forEach(([key, item]) => { if (item.trim()) value.set(key, item.trim()); });
    return value;
  }, [filters, page]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/master-admin/object-capture/jobs?${params()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to load queue");
      setData(json); setSelected([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load queue"); }
    finally { setLoading(false); }
  }, [params]);
  useEffect(() => { const timer = setTimeout(() => void load(), 200); return () => clearTimeout(timer); }, [load]);

  function update(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value })); setPage(1);
  }
  async function bulk(action: "assign" | "retry" | "cancel" | "priority") {
    const reason = window.prompt(`Reason for bulk ${action}:`)?.trim();
    if (!reason) return;
    let assignedAdminId: string | null | undefined;
    let priority: string | undefined;
    if (action === "assign") assignedAdminId = window.prompt("Assignee admin ID (blank to unassign):") ?? undefined;
    if (action === "priority") priority = window.prompt("Priority: low, normal, high, or urgent") || undefined;
    const response = await fetch("/api/master-admin/object-capture/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, action, reason, assignedAdminId, priority }),
    });
    const json = await response.json();
    setMessage(response.ok ? `${json.succeeded} job(s) updated.` : json.error || "Bulk action failed");
    if (response.ok) await load();
  }
  const allChecked = Boolean(data?.jobs.length) && data!.jobs.every((job) => selected.includes(job.id));

  return (
    <div className="master-admin-panel space-y-5">
      <AdminPageHeader title="Object Capture" subtitle="Production reconstruction queue, quality review, and customer delivery."
        actions={<AdminButton onClick={() => window.open(`/api/master-admin/object-capture/jobs?${params(false)}&export=csv`, "_blank")}><Download size={16}/>Export CSV</AdminButton>} />
      {message ? <AdminActionMessage message={message} variant={message.includes("updated") ? "success" : "error"} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[["Total","total"],["Queued","queued"],["Processing","processing"],["Needs review","review"],["Failed","failed"]].map(([label,key]) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{data?.metrics[key] ?? "—"}</p>
          </div>
        ))}
      </div>
      <AdminTablePanel>
        <AdminFilterBar onClear={() => { setFilters({ search:"",status:"",reviewStatus:"",assignee:"",priority:"",dateFrom:"",dateTo:"" }); setPage(1); }}>
          <div className="relative min-w-[230px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <AdminInput soft className="w-full pl-9" placeholder="Job, customer, email, product…" value={filters.search} onChange={(e) => update("search", e.target.value)}/></div>
          <AdminSelect value={filters.status} onChange={(e) => update("status",e.target.value)}><option value="">All processing</option>{["pending","uploading","validating","action_required","queued","processing","completed","failed","cancelled"].map((v)=><option key={v}>{v}</option>)}</AdminSelect>
          <AdminSelect value={filters.reviewStatus} onChange={(e) => update("reviewStatus",e.target.value)}><option value="">All reviews</option>{["unreviewed","in_review","approved","rejected","recapture_requested"].map((v)=><option key={v}>{v}</option>)}</AdminSelect>
          <AdminSelect value={filters.assignee} onChange={(e) => update("assignee",e.target.value)}><option value="">All assignees</option><option value="unassigned">Unassigned</option>{data?.assignees.map((a)=><option key={a.id} value={a.id}>{a.name}</option>)}</AdminSelect>
          <AdminSelect value={filters.priority} onChange={(e) => update("priority",e.target.value)}><option value="">All priorities</option>{["low","normal","high","urgent"].map((v)=><option key={v}>{v}</option>)}</AdminSelect>
          <AdminInput type="date" title="Created from" value={filters.dateFrom} onChange={(e) => update("dateFrom",e.target.value)}/>
          <AdminInput type="date" title="Created to" value={filters.dateTo} onChange={(e) => update("dateTo",e.target.value)}/>
        </AdminFilterBar>
        {selected.length ? <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-lime-50/60 p-3 text-[12px] font-bold">
          {selected.length} selected <AdminButton onClick={()=>void bulk("assign")}>Assign</AdminButton><AdminButton onClick={()=>void bulk("retry")}>Retry</AdminButton>
          <AdminButton onClick={()=>void bulk("cancel")}>Cancel</AdminButton><AdminButton onClick={()=>void bulk("priority")}>Priority</AdminButton>
        </div> : null}
        {loading ? <AdminLoadingState label="Loading capture queue…"/> : !data?.jobs.length ? <AdminEmptyState title="No capture jobs found."/> :
          <div className="overflow-x-auto"><table className="w-full min-w-[1160px] text-left">
            <thead><tr className="border-b bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
              <th className="p-3"><input type="checkbox" checked={allChecked} onChange={(e)=>setSelected(e.target.checked ? data.jobs.map((j)=>j.id):[])}/></th>
              <th className="p-3">Job / customer</th><th className="p-3">Status</th><th className="p-3">Review</th>
              <th className="p-3">Priority</th><th className="p-3">Progress</th><th className="p-3">Queue age</th>
              <th className="p-3">Assignee</th><th className="p-3">Product</th><th className="p-3"></th>
            </tr></thead><tbody>{data.jobs.map((job)=><tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="p-3"><input type="checkbox" checked={selected.includes(job.id)} onChange={(e)=>setSelected((s)=>e.target.checked?[...s,job.id]:s.filter((id)=>id!==job.id))}/></td>
              <td className="p-3"><Link className="block text-[12px] font-black hover:text-[#579D00]" href={`/master-admin/object-capture/${job.id}`}>{job.id}</Link>
                <Link className="text-[11px] font-semibold text-slate-500 hover:underline" href={`/master-admin/customers/${job.customerUid}`}>{job.customerName}</Link></td>
              <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusTone[job.status] || "bg-slate-100"}`}>{job.status}</span><p className="mt-1 text-[10px] text-slate-400">{job.processingStage}</p></td>
              <td className="p-3 text-[11px] font-bold text-slate-600">{job.reviewStatus.replaceAll("_"," ")}</td>
              <td className="p-3 text-[11px] font-black uppercase">{job.priority}</td>
              <td className="p-3"><div className="h-1.5 w-24 rounded bg-slate-100"><div className="h-full rounded bg-[#73C817]" style={{width:`${job.progress}%`}}/></div><span className="text-[10px]">{job.progress}% · {job.photoCount} photos</span></td>
              <td className="p-3 text-[11px] font-bold">{age(job.createdAt)}</td><td className="p-3 text-[11px]">{job.assignedAdminName || "Unassigned"}</td>
              <td className="p-3">{job.productId?<Link className="text-[11px] font-bold text-[#579D00]" href={`/master-admin/products/${job.productId}`}>{job.productTitle || job.productId}</Link>:"—"}</td>
              <td className="p-3"><Link href={`/master-admin/object-capture/${job.id}`} aria-label="View job"><Eye size={16}/></Link></td>
            </tr>)}</tbody>
          </table></div>}
        <AdminPagination page={page} totalPages={data?.pagination.totalPages || 1} meta={data?.pagination} onPageChange={setPage}/>
      </AdminTablePanel>
    </div>
  );
}
