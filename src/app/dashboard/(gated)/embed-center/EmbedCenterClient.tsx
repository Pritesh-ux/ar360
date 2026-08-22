"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useSearchParams } from "next/navigation";
import { Copy, ExternalLink, Check } from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import type { EmbedConfigRecord } from "@/lib/growth/embed.service";

export default function EmbedCenterClient() {
  const searchParams = useSearchParams();
  const productIdFilter = searchParams.get("productId") || "";

  const [embeds, setEmbeds] = useState<EmbedConfigRecord[]>([]);
  const [selected, setSelected] = useState<EmbedConfigRecord | null>(null);
  const [snippetType, setSnippetType] = useState<"html" | "react" | "next">("html");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (productIdFilter) params.set("productId", productIdFilter);
      const res = await fetch(`/api/embed?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const list = data.embeds || [];
      setEmbeds(list);
      setSelected((prev) => {
        if (prev && list.some((e: EmbedConfigRecord) => e.id === prev.id)) return prev;
        return list[0] || null;
      });
    } finally {
      setLoading(false);
    }
  }, [productIdFilter]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  const snippet =
    selected &&
    (snippetType === "html"
      ? selected.htmlSnippet
      : snippetType === "react"
        ? selected.reactSnippet
        : selected.nextSnippet);

  async function copySnippet() {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function toggleStatus(next: "active" | "inactive") {
    if (!selected) return;
    const res = await fetch("/api/embed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, status: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(String(body.error || "Could not update embed status."));
      return;
    }
    setSelected({ ...selected, status: next });
    void load();
  }

  return (
    <UserPanelPageShell className="gap-4">
      <UserPageHeader title="Embed Center" subtitle="One embed snippet per published product" />

      {loading ? (
        <UserWorkspaceLoading
          className="rounded-[16px] border border-[#ECECEC]"
          label="Loading Embeds"
          hint="Please wait while we load embed configs..."
        />
      ) : embeds.length === 0 ? (
        <div className="dash-premium-card p-6 text-sm text-[#737373]">
          Publish a product to generate its website embed code automatically.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-2">
            {embeds.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  selected?.id === item.id ? "border-[#84D400] bg-[#EEF9E0]" : "border-[#ECECEC] bg-white"
                }`}
              >
                <p className="text-[14px] font-semibold text-[#111111]">{item.title}</p>
                <p className="text-[12px] text-[#737373]">{item.status === "active" ? "Active" : "Inactive"}</p>
              </button>
            ))}
          </aside>

          {selected ? (
            <section className="space-y-4 dash-premium-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                {(["html", "react", "next"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSnippetType(type)}
                    className={`rounded-xl px-3 py-1.5 text-[12px] font-semibold ${
                      snippetType === type ? "bg-[#111111] text-white" : "bg-[#FAFAFA] text-[#525252]"
                    }`}
                  >
                    {type === "html" ? "HTML iframe" : type === "react" ? "React" : "Next.js"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void copySnippet()}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#84D400] px-3 py-1.5 text-[12px] font-semibold text-[#102000]"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  Copy code
                </button>
                <a
                  href={selected.embedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#ECECEC] px-3 py-1.5 text-[12px] font-semibold"
                >
                  <ExternalLink size={14} />
                  Preview
                </a>
              </div>

              <pre className="overflow-x-auto rounded-xl bg-[#111111] p-4 text-[12px] text-[#E8F5D0]">{snippet}</pre>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void toggleStatus("active")}
                  disabled={selected.status === "active"}
                  className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${
                    selected.status === "active"
                      ? "border-[#84D400] bg-[#F3FFD6] text-[#3F6A00]"
                      : "border-[#ECECEC] text-[#171717]"
                  }`}
                >
                  Set active
                </button>
                <button
                  type="button"
                  onClick={() => void toggleStatus("inactive")}
                  disabled={selected.status === "inactive"}
                  className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${
                    selected.status === "inactive"
                      ? "border-[#D4D4D4] bg-[#F5F5F5] text-[#525252]"
                      : "border-[#ECECEC] text-[#171717]"
                  }`}
                >
                  Set inactive
                </button>
              </div>

              <p className="text-[12px] text-[#737373]">
                Views: {selected.viewCount} · Unique visitors: {selected.uniqueVisitors}
              </p>
            </section>
          ) : null}
        </div>
      )}
    </UserPanelPageShell>
  );
}
