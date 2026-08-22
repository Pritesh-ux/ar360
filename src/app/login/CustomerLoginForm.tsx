"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  authInputClassName,
} from "@/components/auth/AuthFormPrimitives";
import PasswordInput from "@/components/auth/PasswordInput";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { emitSiteBusinessEvent } from "@/lib/web-analytics/emit-site-event";

export default function CustomerLoginForm({
  initialError,
  initialEmail,
  nextPath,
}: {
  initialError?: string | null;
  initialEmail?: string;
  nextPath?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState(initialError || "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      next: nextPath || undefined,
    };

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string;
      };

      if (!response.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }

      emitSiteBusinessEvent("login");
      // Full document navigation after Set-Cookie is committed (avoids stuck dashboard loading).
      window.location.replace(data.redirectUrl || "/dashboard");
    } catch {
      setError("Login failed. Please try again.");
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <AuthSplitLayout stepKey="login">
      <AuthHeading title="Welcome back" subtitle="Sign in to continue building immersive product experiences." />
      <AuthError message={error || null} />

      <form onSubmit={onSubmit} className="space-y-5">
        <AuthField label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className={authInputClassName()}
            defaultValue={initialEmail || ""}
          />
        </AuthField>

        <AuthField label="Password">
          <PasswordInput name="password" autoComplete="current-password" placeholder="Your password" />
        </AuthField>

        <div className="flex items-center justify-between pt-1 text-[13px]">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-[#525252]">
            <input type="checkbox" name="remember" className="h-4 w-4 rounded border-0 accent-[#b9ff2c]" />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-[#6b9008] hover:underline">
            Forgot password?
          </Link>
        </div>

        <div className="pt-2">
          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </AuthPrimaryButton>
        </div>
      </form>

      <p className="mt-8 text-center text-[14px] text-[#737373]">
        New to AR360?{" "}
        <Link href="/signup" className="font-semibold text-[#6b9008] hover:underline">
          Create account
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
