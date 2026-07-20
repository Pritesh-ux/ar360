import { requireUser } from "@/lib/auth";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import BrandingClient from "./BrandingClient";

export default async function BrandingPage() {
  const user = await requireUser();
  const plan = user.customerUid ? await resolveCustomerPlanLimits(user.customerUid) : null;

  return <BrandingClient enabled={Boolean(plan?.allowCustomBranding)} />;
}
