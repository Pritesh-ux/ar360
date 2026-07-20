"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Box, CalendarDays, Download, Images, MessageSquare, Settings2, UserRound } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ModelViewer from "@/components/shared/ModelViewer";
import { AdminActionMessage, AdminButton, AdminInput, AdminLoadingState, AdminSelect } from "@/components/ui/admin";
import type { AdminCaptureJob, CapturePriority, CaptureReviewStatus } from "@/lib/master-admin/object-capture.service";

type Detail = {
  job: AdminCaptureJob; images: Record<string, unknown>[]; analysis: Record<string, unknown>[];
  events: Record<string, unknown>[]; notes: Record<string, unknown>[]; canManage: boolean; canDownload: boolean;
  assignees: { id: number; name: string }[];
};
function date(value: unknown) { return value ? new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(String(value))) : "—"; }
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><div className="mt-1 text-[12px] font-semibold text-slate-800">{value || "—"}</div></div>;
}
function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{size?:number}>; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><span className="rounded-lg bg-lime-50 p-2 text-[#579D00]"><Icon size={16}/></span><h2 className="text-[14px] font-black">{title}</h2></div>{children}</section>;
}

export default function ObjectCaptureDetailClient() {
  const { id } = useParams<{id:string}>();
  const [detail,setDetail] = useState<Detail|null>(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [reason,setReason] = useState("");
  const [note,setNote] = useState("");
  const load = useCallback(async()=>{
    try { const r=await fetch(`/api/master-admin/object-capture/jobs/${encodeURIComponent(id)}`,{cache:"no-store"}); const j=await r.json(); if(!r.ok) throw new Error(j.error); setDetail(j); }
    catch(e){setError(e instanceof Error?e.message:"Unable to load job");} finally{setLoading(false);}
  },[id]);
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  },[load]);
  async function action(name:string, extra:Record<string,unknown>={}, success="Job updated.") {
    if(!reason.trim()){setError("Enter a reason before changing this job.");return;}
    setSaving(true);setError("");setMessage("");
    try { const r=await fetch(`/api/master-admin/object-capture/jobs/${encodeURIComponent(id)}/action`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:name,reason,...extra})}); const j=await r.json(); if(!r.ok) throw new Error(j.error); setDetail((d)=>d?{...d,...j}:d);setMessage(success);setReason(""); }
    catch(e){setError(e instanceof Error?e.message:"Action failed");}finally{setSaving(false);}
  }
  if(loading)return <AdminLoadingState label="Loading capture job…"/>;
  if(!detail)return <div className="master-admin-panel"><AdminActionMessage message={error||"Job not found"} variant="error"/></div>;
  const {job}=detail;
  return <div className="master-admin-panel space-y-5">
    <AdminPageHeader title={`Capture ${job.id.slice(0,8)}`} subtitle={`${job.customerName} · created ${date(job.createdAt)}`}
      actions={<Link className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-[12px] font-bold" href="/master-admin/object-capture"><ArrowLeft size={16}/>Back to queue</Link>}/>
    {error?<AdminActionMessage message={error} variant="error"/>:null}{message?<AdminActionMessage message={message} variant="success"/>:null}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">{job.status}</span><span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700">{job.reviewStatus.replaceAll("_"," ")}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase text-amber-700">{job.priority}</span></div>
        {detail.canManage?<div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-bold text-slate-500">Reason<AdminInput className="mt-1 min-w-[260px]" value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Required for every change"/></label>
          <AdminSelect value={job.assignedAdminId||""} onChange={(e)=>void action("assign",{assignedAdminId:e.target.value},"Assignment updated.")}><option value="">Unassigned</option>{detail.assignees.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</AdminSelect>
          <AdminSelect value={job.priority} onChange={(e)=>void action("priority",{priority:e.target.value as CapturePriority},"Priority updated.")}>{["low","normal","high","urgent"].map(v=><option key={v}>{v}</option>)}</AdminSelect>
        </div>:null}
      </div>
      <div className="mt-4 h-2 rounded bg-slate-100"><div className="h-full rounded bg-[#73C817]" style={{width:`${job.progress}%`}}/></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-3"><div className="space-y-5 xl:col-span-2">
      <Section title="Customer & subscription" icon={UserRound}><div className="grid gap-4 sm:grid-cols-3">
        <Field label="Customer" value={<Link className="text-[#579D00]" href={`/master-admin/customers/${job.customerUid}`}>{job.customerName}</Link>}/><Field label="Customer ID" value={<Link className="text-[#579D00] hover:underline" href={`/master-admin/customers/${job.customerUid}`}>{job.customerUid}</Link>}/><Field label="Email" value={job.customerEmail}/>
        <Field label="Plan" value={job.planId}/><Field label="Subscription" value={`${job.subscriptionStatus || "Unknown"}${job.subscriptionEndsAt ? ` · until ${date(job.subscriptionEndsAt)}` : ""}`}/><Field label="Photos" value={job.photoCount}/>
        <Field label="Linked product" value={job.productId?<Link className="text-[#579D00]" href={`/master-admin/products/${job.productId}`}>{job.productTitle||job.productId}</Link>:"Not linked"}/>
      </div></Section>
      <Section title="Source image quality" icon={Images}><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{detail.images.map((image)=><figure key={String(image.id)} className="overflow-hidden rounded-xl border bg-slate-50">
        <Image unoptimized width={320} height={320} src={String(image.assetUrl)} alt={String(image.original_name||"Capture source")} className="aspect-square w-full object-cover"/>
        <figcaption className="p-2 text-[10px]"><b>{String(image.quality_status||"Unrated")}</b><br/>{String(image.width)}×{String(image.height)} · blur {String(image.blur_score??"—")}</figcaption>
      </figure>)}</div></Section>
      <Section title="Model preview & output" icon={Box}>{job.modelKey?<div className="overflow-hidden rounded-xl border"><div className="h-[420px]"><ModelViewer src={`/api/master-admin/object-capture/jobs/${id}/assets/preview-model`} showArButton={false}/></div></div>:<p className="text-[12px] text-slate-500">No model output is available yet.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Engine" value={job.processingEngine}/><Field label="Stage" value={job.processingStage}/><Field label="Worker" value={job.workerId}/><Field label="Quality" value={job.qualityScore}/><Field label="Coverage" value={job.coverageScore}/><Field label="Exposure" value={job.exposureStatus}/></div>
        {detail.canDownload&&job.modelKey?<a className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold text-[#579D00]" href={`/api/master-admin/object-capture/jobs/${id}/assets/model`}><Download size={15}/>Download GLB</a>:null}
      </Section>
      <Section title="Processing log & event timeline" icon={CalendarDays}>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-[11px] text-slate-200">{job.processingLog||"No processing log."}</pre>
        {detail.canDownload?<a className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-[#579D00]" href={`/api/master-admin/object-capture/jobs/${id}/assets/log`}><Download size={14}/>Download log</a>:null}
        <div className="mt-5 space-y-3">{detail.events.map((event)=><div key={String(event.id)} className="border-l-2 border-lime-300 pl-3 text-[12px]"><b>{String(event.event_type).replaceAll("_"," ")}</b><span className="ml-2 text-slate-400">{date(event.created_at)}</span><p className="text-slate-600">{String(event.message||"")}</p></div>)}</div>
      </Section>
    </div><div className="space-y-5">
      <Section title="Review controls" icon={Settings2}>{detail.canManage?<div className="grid gap-2">
        {([["approved","Approve"],["rejected","Reject"],["recapture_requested","Request recapture"],["in_review","Start review"]] as [CaptureReviewStatus,string][]).map(([value,label])=><AdminButton key={value} disabled={saving} onClick={()=>void action("review",{reviewStatus:value},`Review marked ${label.toLowerCase()}.`)}>{label}</AdminButton>)}
        <hr className="my-2 border-slate-100"/><AdminButton disabled={saving} onClick={()=>void action("retry",{},"Job requeued.")}>Retry</AdminButton><AdminButton disabled={saving} onClick={()=>void action("cancel",{},"Cancellation requested.")}>Cancel</AdminButton><AdminButton disabled={saving} onClick={()=>void action("fail",{},"Job failed.")}>Mark failed</AdminButton>
        {!job.productId&&job.modelKey?<AdminButton variant="primary" disabled={saving} onClick={()=>void action("create_product",{},"Draft product created.")}>Create draft product</AdminButton>:null}
      </div>:<p className="text-[12px] text-slate-500">Read-only access.</p>}</Section>
      <Section title="Internal notes" icon={MessageSquare}>{detail.canManage?<div className="flex gap-2"><AdminInput value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Internal note"/><AdminButton disabled={!note.trim()||saving} onClick={()=>void action("note",{note},"Note added.").then(()=>setNote(""))}>Add</AdminButton></div>:null}
        <div className="mt-4 space-y-3">{detail.notes.map((item)=><div key={String(item.id)} className="rounded-xl bg-slate-50 p-3 text-[12px]"><p>{String(item.body)}</p><span className="text-[10px] text-slate-400">{String(item.admin_name||"Admin")} · {date(item.created_at)}</span></div>)}</div>
      </Section>
      <Section title="Capture metadata" icon={CalendarDays}><div className="grid gap-4"><Field label="Job ID" value={job.id}/><Field label="Created" value={date(job.createdAt)}/><Field label="Started" value={date(job.startedAt)}/><Field label="Completed" value={date(job.completedAt)}/><Field label="Retries" value={job.retryCount}/><Field label="Last error" value={job.errorMessage}/></div></Section>
    </div></div>
  </div>;
}
