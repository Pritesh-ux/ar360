"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import ProductDetailView, { type ProductDetailPayload } from "@/components/features/master-admin/ProductDetailView";
import { AdminActionMessage } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

export default function ProductDetailClient({ productId }: { productId: string }) {
  const [data, setData] = useState<ProductDetailPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/products/${productId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load product");
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }

  async function mutate(action: "publish" | "disable" | "delete") {
    setPending(true);
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Action failed");
      if (action === "delete") {
        setMessage("Product deleted. Redirecting...");
        setTimeout(() => {
          window.location.href = "/master-admin/products";
        }, 1500);
        return;
      }
      setMessage(action === "publish" ? "Product published." : "Product archived.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  useDeferredEffect(() => {
    void load();
  }, [productId]);

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <Link
          href="/master-admin/products"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151]"
        >
          <ArrowLeft size={14} />
          Back to Products
        </Link>
        <p className="p-8 text-center text-[13px] font-semibold text-[#9CA3AF]">Loading product details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <Link
          href="/master-admin/products"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151]"
        >
          <ArrowLeft size={14} />
          Back to Products
        </Link>
        <div className="dash-premium-card border-red-100 bg-red-50 p-6 text-[13px] font-bold text-red-700">
          {error || "Product not found."}
        </div>
      </div>
    );
  }

  return (
    <>
      {message ? (
        <div className="master-admin-panel dash-premium px-0 pb-0 pt-3">
          <AdminActionMessage
            message={message}
            variant={message.toLowerCase().includes("fail") ? "error" : "success"}
          />
        </div>
      ) : null}
      <ProductDetailView
        data={data}
        onPublish={() => void mutate("publish")}
        onDisable={() => void mutate("disable")}
        onDelete={() => {
          if (window.confirm("Delete this product permanently? This cannot be undone.")) void mutate("delete");
        }}
      />
      {pending ? (
        <p className="master-admin-panel dash-premium px-0 pb-3 pt-0 text-[12px] font-semibold text-[#9CA3AF]">
          Saving…
        </p>
      ) : null}
    </>
  );
}
