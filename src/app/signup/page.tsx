import { redirect } from "next/navigation";
import { getCurrentUser, ensureCustomerForUser } from "@/lib/auth";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";
import CustomerSignupForm from "./CustomerSignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    plan?: string;
    period?: string;
    name?: string;
    companyName?: string;
    email?: string;
  }>;
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

  return (
    <CustomerSignupForm
      initialError={params.error || null}
      initialName={params.name || ""}
      initialEmail={params.email || ""}
      initialCompanyName={params.companyName || ""}
      selectedPlan={String(params.plan || "").trim()}
      selectedPeriod={String(params.period || "monthly").trim()}
    />
  );
}
