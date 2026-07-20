import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth/actions";
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
  const errorMessage =
    params.error === "account_suspended"
      ? "Your account is suspended. Please contact support."
      : params.error || null;

  return (
    <AuthSplitLayout stepKey="login">
      <AuthHeading title="Welcome back" subtitle="Sign in to continue building immersive product experiences." />
      <AuthError message={errorMessage} />

      <form action={loginAction} className="space-y-5">
        <AuthField label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className={authInputClassName()}
          />
        </AuthField>

        <AuthField label="Password">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            className={authInputClassName()}
          />
        </AuthField>

        <div className="flex items-center justify-between pt-1 text-[13px]">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-[#525252]">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded border-0 accent-[#B9FF2C]"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-[#5AA700] hover:underline">
            Forgot password
          </Link>
        </div>

        <div className="pt-2">
          <AuthPrimaryButton type="submit">Login</AuthPrimaryButton>
        </div>
      </form>

      <p className="mt-8 text-center text-[14px] text-[#737373]">
        New to AR360?{" "}
        <Link href="/signup" className="font-semibold text-[#5AA700] hover:underline">
          Create account
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
