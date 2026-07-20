"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";

export default function SampleProductButton({ label = "Try Sample Product" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const createSample = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/sample-product", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create sample product");
      router.push(json.redirect || `/dashboard/products/${json.productId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create sample product");
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-2">
      <UserButton variant="outline" onClick={() => void createSample()} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        {label}
      </UserButton>
      {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}
