"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  authInputClassName,
} from "@/components/auth/AuthFormPrimitives";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevLink(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return;
      }
      setMessage(data.message || "Check your email for a reset link.");
      if (data.devResetUrl) setDevLink(data.devResetUrl);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout stepKey="forgot">
      <AuthHeading
        title="Reset password"
        subtitle="Enter your work email and we’ll send a reset link if an account exists."
      />
      <AuthError message={error} />
      {message ? (
        <div className="mb-6 rounded-xl bg-[#F3FAEB] px-4 py-3 text-[13px] font-medium text-[#3F6212]">
          {message}
          {devLink ? (
            <p className="mt-2 break-all text-[12px]">
              Dev link:{" "}
              <a href={devLink} className="underline">
                {devLink}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={authInputClassName()}
          />
        </AuthField>
        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-8 text-center text-[14px] text-[#737373]">
        <Link href="/login" className="font-semibold text-[#5AA700] hover:underline">
          Back to login
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
