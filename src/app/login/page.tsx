import { redirect } from "next/navigation";
import { getCurrentUser, ensureCustomerForUser } from "@/lib/auth";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";
import CustomerLoginForm from "@/app/login/CustomerLoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next &&
    params.next.startsWith("/") &&
    !params.next.startsWith("//") &&
    !params.next.includes("\\")
      ? params.next.slice(0, 500)
      : null;

  const user = await getCurrentUser();
  if (user?.customerUid) {
    if (nextPath) redirect(nextPath);
    const customer = await ensureCustomerForUser(user);
    const destination = await resolveCustomerPostAuthDestination(customer.customer_uid, {
      userStatus: user.status,
      customerStatus: customer.status,
    });
    redirect(destination);
  }

  const errorMessage =
    params.error === "account_suspended"
      ? "Your account is suspended. Please contact support."
      : params.error || null;

  return (
    <CustomerLoginForm
      initialError={errorMessage}
      initialEmail={params.email || ""}
      nextPath={nextPath}
    />
  );
}
