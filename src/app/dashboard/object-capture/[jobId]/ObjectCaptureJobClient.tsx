"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Download, RefreshCw } from "lucide-react";
import ModelViewer from "@/components/shared/ModelViewer";
import type { CaptureJob } from "@/hooks/useObjectCaptureUpload";

type Detail = {
  job: CaptureJob;
  images: Array<{
    id: string; original_name: string; width: number; height: number;
    byte_size: number; asset_url: string;
  }>;
  analysis: {
    summary: Record<string, unknown> | null;
    images: Array<Record<string, unknown>>;
  } | null;
  events: Array<{
    id: number; event_type: string; message: string; created_at: string;
    from_status?: string | null; to_status?: string | null;
  }>;
};

const terminal = new Set(["completed", "failed", "cancelled", "action_required"]);

export default function ObjectCaptureJobClient({ jobId }: { jobId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`/api/object-capture/jobs/${jobId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Job details are unavailable.");
      setDetail(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job details are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const currentStatus = detail?.job.status;
  useEffect(() => {
    if (!currentStatus || terminal.has(currentStatus)) return;
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [currentStatus, load]);

  async function mutate(action: "retry" | "cancel" | "override") {
    let url = `/api/object-capture/jobs/${jobId}`;
    let method = "DELETE";
    let body: string | undefined;
    if (action === "retry") {
      url += "/retry"; method = "POST";
    } else if (action === "override") {
      const reason = window.prompt("Why do you accept the quality risk? This reason is audited.");
      if (reason === null) return;
      if (reason.trim().length < 8 || reason.trim().length > 500) {
        setError("Override reason must be between 8 and 500 characters.");
        return;
      }
      url += "/override"; method = "POST";
      body = JSON.stringify({ reason: reason.trim() });
    }
    setBusy(action);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `Could not ${action} this job.`);
      await load();
      if (action === "retry" || action === "override") {
        void fetch("/api/object-capture/worker/run", { method: "POST" });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} this job.`);
    } finally {
      setBusy("");
    }
  }

  async function createProduct() {
    setBusy("product");
    setError("");
    try {
      const response = await fetch("/api/object-capture/create-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not create the product.");
      window.location.assign(data.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the product.");
      setBusy("");
    }
  }

  if (loading) return <div className="grid min-h-72 place-items-center text-sm text-slate-500">Loading capture job…</div>;
  if (!detail) return (
    <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
      {error}<button onClick={() => void load()} className="ml-3 underline">Try again</button>
    </div>
  );

  const { job } = detail;
  const modelUrl = `/api/object-capture/jobs/${jobId}/assets/model`;
  const canCancel = ["pending", "uploading", "validating", "action_required", "queued", "processing"].includes(job.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/object-capture" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><ArrowLeft className="h-3.5 w-3.5" /> Object Capture</Link>
          <h1 className="text-2xl font-bold text-slate-900">Capture job {job.id.slice(0, 8)}</h1>
          <p className="text-sm capitalize text-slate-500">{job.status.replaceAll("_", " ")} · {job.processing_stage?.replaceAll("_", " ") || "Waiting"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCancel && <button disabled={!!busy} onClick={() => void mutate("cancel")} className="h-10 rounded-xl border px-4 text-xs font-semibold disabled:opacity-50">Cancel</button>}
          {["failed", "cancelled"].includes(job.status) && <button disabled={!!busy} onClick={() => void mutate("retry")} className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white disabled:opacity-50">Retry</button>}
          {job.status === "action_required" && <button disabled={!!busy} onClick={() => void mutate("override")} className="h-10 rounded-xl bg-amber-600 px-4 text-xs font-semibold text-white disabled:opacity-50">Accept risk & queue</button>}
          {job.status === "completed" && !job.product_id && <button disabled={!!busy} onClick={() => void createProduct()} className="h-10 rounded-xl bg-cyan-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{busy === "product" ? "Creating…" : "Create product"}</button>}
          {job.product_id && <Link href={`/dashboard/products/${job.product_id}`} className="inline-flex h-10 items-center rounded-xl bg-cyan-600 px-4 text-xs font-semibold text-white">Open product editor</Link>}
        </div>
      </div>

      {error && <div role="alert" className="flex gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Progress</h2><span className="text-sm font-bold">{job.progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-cyan-500 transition-all" style={{ width: `${job.progress}%` }} /></div>
          {job.error_message && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><strong>Processing failed:</strong> {job.error_message}<p className="mt-1 text-xs">Retry the job. If it fails again, improve photo coverage or contact support with this job ID.</p></div>}
        </section>
        <section className="grid grid-cols-2 gap-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          {[["Quality", job.quality_score], ["Coverage", job.coverage_score], ["Blurred", job.blur_count], ["Duplicates", job.duplicate_count]].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] uppercase text-slate-400">{label}</p><p className="text-xl font-bold">{value ?? "—"}</p></div>
          ))}
        </section>
      </div>

      {job.status === "completed" && (
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">3D model</h2><a href={modelUrl} download className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700"><Download className="h-4 w-4" /> Download GLB</a></div>
          <div className="h-[420px] overflow-hidden rounded-2xl bg-slate-100"><ModelViewer src={modelUrl} cameraControls autoRotate /></div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Source photos ({detail.images.length})</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {detail.images.map((image) => <a key={image.id} href={image.asset_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border">
            {/* Authenticated image responses are intentionally not routed through the public image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.asset_url} alt={image.original_name} loading="lazy" className="aspect-square w-full object-cover transition group-hover:scale-105" />
            <p className="truncate p-2 text-[10px] text-slate-500">{image.original_name}</p>
          </a>)}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Processing timeline</h2><button onClick={() => void load()} className="text-slate-500" aria-label="Refresh timeline"><RefreshCw className="h-4 w-4" /></button></div>
        <ol className="space-y-4 border-l border-slate-200 pl-5">
          {detail.events.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-cyan-500" /><p className="text-sm font-semibold capitalize">{event.event_type.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{event.message}</p><time className="text-[10px] text-slate-400">{new Date(event.created_at).toLocaleString()}</time></li>)}
        </ol>
      </section>
    </div>
  );
}
