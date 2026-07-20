"use client";

import { useEffect, useState } from "react";
import ProductDetailView, { type ProductDetailPayload } from "@/components/features/master-admin/ProductDetailView";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminActionMessage } from "@/components/ui/admin";

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

  async function mutate(action: "publish" | "disable") {
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
      setMessage(action === "publish" ? "Product published." : "Product archived.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="master-admin-panel space-y-4">
        <AdminPageHeader title="Product" backHref="/master-admin/products" backLabel="Back to Products" />
        <p className="p-8 text-center text-[13px] font-semibold text-slate-400">Loading product details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="master-admin-panel space-y-4">
        <AdminPageHeader title="Product" backHref="/master-admin/products" backLabel="Back to Products" />
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-[13px] font-bold text-red-700">
          {error || "Product not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="master-admin-panel space-y-4">
      <AdminPageHeader
        title={data.product.name}
        subtitle={`${data.product.code} · ${data.product.status}${
          data.clientDelivery ? ` · Client: ${data.clientDelivery.clientName}` : ""
        }`}
        backHref="/master-admin/products"
        backLabel="Back to Products"
        breadcrumbs={[
          { label: "Products", href: "/master-admin/products" },
          { label: data.product.name },
        ]}
      />
      {message ? (
        <AdminActionMessage
          message={message}
          variant={message.toLowerCase().includes("fail") ? "error" : "success"}
        />
      ) : null}
      <ProductDetailView
        data={data}
        onPublish={() => void mutate("publish")}
        onDisable={() => void mutate("disable")}
        onDelete={() => setMessage("Delete is disabled for now.")}
      />
      {pending ? <p className="text-[12px] font-semibold text-slate-400">Saving…</p> : null}
    </div>
  );
}
