"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  authInputClassName,
} from "@/components/auth/AuthFormPrimitives";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Reset failed.");
        return;
      }
      setMessage(data.message || "Password updated.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <AuthSplitLayout stepKey="reset-invalid">
        <AuthHeading title="Invalid reset link" subtitle="Request a new password reset from the login page." />
        <p className="mt-8 text-center text-[14px]">
          <Link href="/forgot-password" className="font-semibold text-[#018abe] hover:underline">
            Request reset link
          </Link>
        </p>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout stepKey="reset">
      <AuthHeading title="Set new password" subtitle={`Choose a strong password for ${email}`} />
      <AuthError message={error} />
      {message ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
          {message}{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="New password">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInputClassName()} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] transition hover:text-[#525252]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </AuthField>
        <AuthField label="Confirm password">
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${authInputClassName()} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] transition hover:text-[#525252]"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </AuthField>
        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </AuthPrimaryButton>
      </form>
      <p className="mt-5 text-center text-[13px] text-[#737373]">
        <Link href="/login" className="font-semibold text-[#018abe] hover:underline">
          Back to login
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
