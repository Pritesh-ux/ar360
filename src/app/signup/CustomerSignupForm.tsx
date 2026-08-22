"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  authInputClassName,
} from "@/components/auth/AuthFormPrimitives";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { emitSiteBusinessEvent } from "@/lib/web-analytics/emit-site-event";

type Props = {
  initialError?: string | null;
  initialName?: string;
  initialEmail?: string;
  initialCompanyName?: string;
  selectedPlan?: string;
  selectedPeriod?: string;
};

export default function CustomerSignupForm({
  initialError,
  initialName,
  initialEmail,
  initialCompanyName,
  selectedPlan,
  selectedPeriod,
}: Props) {
  const [error, setError] = useState(initialError || "");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      companyName: String(formData.get("companyName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
      plan: String(formData.get("plan") || "").trim(),
      period: String(formData.get("period") || "monthly").trim(),
    };

    try {
      const response = await fetch("/api/auth/signup", {
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
        setError(data.error || "Could not create account.");
        setLoading(false);
        return;
      }

      emitSiteBusinessEvent("signup");
      // Full document navigation after Set-Cookie (avoids stuck loading / blank flash).
      window.location.replace(data.redirectUrl || "/dashboard/onboarding");
    } catch {
      setError("Could not create account. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout stepKey="signup">
      <AuthHeading
        title="Create account"
        subtitle="Set up your workspace and start turning products into 3D experiences."
      />
      <AuthError message={error || null} />

      <form onSubmit={onSubmit} className="space-y-4">
        {selectedPlan ? <input type="hidden" name="plan" value={selectedPlan} /> : null}
        {selectedPeriod ? <input type="hidden" name="period" value={selectedPeriod} /> : null}

        <AuthField label="Full name">
          <input
            name="name"
            required
            autoComplete="name"
            placeholder="Alex Morgan"
            className={authInputClassName()}
            defaultValue={initialName || ""}
          />
        </AuthField>

        <AuthField label="Company name">
          <input
            name="companyName"
            required
            autoComplete="organization"
            placeholder="Your company"
            className={authInputClassName()}
            defaultValue={initialCompanyName || ""}
          />
        </AuthField>

        <AuthField label="Work email">
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
          <PasswordInput
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordStrengthMeter password={password} />
        </AuthField>

        <AuthField label="Confirm password">
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm password"
          />
        </AuthField>

        <div className="pt-3">
          <AuthPrimaryButton type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </AuthPrimaryButton>
        </div>
      </form>

      <p className="mt-8 text-center text-[14px] text-[#737373]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#6b9008] hover:underline">
          Login
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
