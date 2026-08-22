"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Rocket } from "lucide-react";
import { UserPageHeader } from "@/components/user-panel";

type ChecklistItem = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  message?: string;
};

export default function ProductPreviewClient() {
  const params = useParams();
  const router = useRouter();
  const productId = String(params.id || "");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [viewerUrl, setViewerUrl] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${productId}/publish`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Preview unavailable");
        setItems(data.items || []);
        setCanPublish(Boolean(data.canPublish));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview unavailable");
      } finally {
        setLoading(false);
      }
    }
    if (productId) void load();
  }, [productId]);

  const iconFor = useMemo(
    () => ({
      ok: CheckCircle2,
      warn: AlertTriangle,
      error: XCircle,
    }),
    [],
  );

  async function handlePublish() {
    setPublishing(true);
    setError("");
    try {
      const res = await fetch(`/api/products/${productId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish failed");
      setViewerUrl(data.viewerUrl || "");
      router.push(`/dashboard/products/${productId}?published=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
      setPublishing(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <UserPageHeader
        title="Publish preview"
        subtitle="Review checklist before going live"
        actions={
          <>
            <Link
              href={`/dashboard/products/${productId}`}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111]"
            >
              <ArrowLeft size={16} />
              Back to editor
            </Link>
            <button
              type="button"
              disabled={!canPublish || publishing}
              onClick={() => void handlePublish()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] disabled:cursor-not-allowed disabled:bg-[#ECECEC] disabled:text-[#A3A3A3]"
            >
              <Rocket size={16} />
              {publishing ? "Publishing..." : "Publish product"}
            </button>
          </>
        }
      />

      {loading ? (
        <p className="text-sm text-[#737373]">Loading checklist...</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-[#111111]">Pre-publish checklist</h2>
            <ul className="mt-4 space-y-3">
              {items.map((item) => {
                const Icon = iconFor[item.status];
                const tone =
                  item.status === "ok"
                    ? "text-[#5FA800]"
                    : item.status === "warn"
                      ? "text-amber-600"
                      : "text-red-600";
                return (
                  <li key={item.id} className="flex items-start gap-3 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2.5">
                    <Icon size={18} className={`mt-0.5 shrink-0 ${tone}`} />
                    <div>
                      <p className="text-[13px] font-semibold text-[#111111]">{item.label}</p>
                      {item.message ? (
                        <p className="mt-0.5 text-[12px] font-medium text-[#737373]">{item.message}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-[#111111]">What happens on publish</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[13px] font-medium text-[#525252]">
              <li>Public viewer link is activated</li>
              <li>QR code and share links are registered automatically</li>
              <li>Poster and camera settings are locked for the live viewer</li>
              <li>Draft remains editable after publishing</li>
            </ul>
            {viewerUrl ? (
              <p className="mt-4 text-[13px] font-semibold text-[#5FA800]">
                Live at{" "}
                <a href={viewerUrl} className="underline" target="_blank" rel="noreferrer">
                  {viewerUrl}
                </a>
              </p>
            ) : null}
            {error ? <p className="mt-4 text-[13px] font-medium text-red-600">{error}</p> : null}
          </section>
        </div>
      )}
    </div>
  );
}
