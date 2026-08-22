import { requireUser } from "@/lib/auth";
import { requirePlanPermission } from "@/lib/subscription/require-active-subscription";
import BrandingClient from "./BrandingClient";

export default async function BrandingPage() {
  const user = await requireUser();
  await requirePlanPermission(user.customerUid, "custom_branding");

  return <BrandingClient enabled />;
}