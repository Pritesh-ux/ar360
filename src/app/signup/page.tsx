import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/auth/actions";
import { getCurrentUser, ensureCustomerForUser } from "@/lib/auth";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  authInputClassName,
} from "@/components/auth/AuthFormPrimitives";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string; period?: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.customerUid) {
    const customer = await ensureCustomerForUser(user);
    const destination = await resolveCustomerPostAuthDestination(customer.customer_uid, {
      userStatus: user.status,
      customerStatus: customer.status,
    });
    redirect(destination);
  }

  const params = await searchParams;
  const selectedPlan = String(params.plan || "").trim();
  const selectedPeriod = String(params.period || "monthly").trim();

  return (
    <AuthSplitLayout stepKey="signup">
      <AuthHeading
        title="Create account"
        subtitle="Set up your workspace and start turning products into 3D experiences."
      />
      <AuthError message={params.error || null} />

      <form action={signupAction} className="space-y-4">
        {selectedPlan ? <input type="hidden" name="plan" value={selectedPlan} /> : null}
        {selectedPeriod ? <input type="hidden" name="period" value={selectedPeriod} /> : null}

        <AuthField label="Full name">
          <input name="name" required autoComplete="name" placeholder="Alex Morgan" className={authInputClassName()} />
        </AuthField>

        <AuthField label="Company name">
          <input
            name="companyName"
            required
            autoComplete="organization"
            placeholder="Your company"
            className={authInputClassName()}
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
          />
        </AuthField>

        <AuthField label="Password" hint="At least 8 characters with uppercase, lowercase, and a number.">
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Create a password"
            className={authInputClassName()}
          />
        </AuthField>

        <AuthField label="Confirm password">
          <input
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirm password"
            className={authInputClassName()}
          />
        </AuthField>

        <div className="pt-3">
          <AuthPrimaryButton type="submit">Create Account</AuthPrimaryButton>
        </div>
      </form>

      <p className="mt-8 text-center text-[14px] text-[#737373]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#5AA700] hover:underline">
          Login
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
