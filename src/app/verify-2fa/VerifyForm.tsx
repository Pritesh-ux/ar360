"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPrimaryButton, authInputClassName } from "@/components/auth/AuthFormPrimitives";

export default function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("code", code);

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Invalid code");
        return;
      }

      localStorage.setItem("ar360_current_user", JSON.stringify(data.user));
      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <input
        className={`${authInputClassName()} text-center text-2xl font-semibold tracking-[0.35em]`}
        inputMode="numeric"
        maxLength={6}
        name="code"
        placeholder="000000"
        required
        aria-label={`Verification code for ${email || "account"}`}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />

      <AuthPrimaryButton type="submit" disabled={loading || code.length !== 6}>
        {loading ? "Verifying…" : "Verify & Continue"}
      </AuthPrimaryButton>
    </form>
  );
}
