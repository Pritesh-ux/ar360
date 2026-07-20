import { redirect } from "next/navigation";

export default function LegacyBillingPaymentsRedirect() {
  redirect("/master-admin/billing");
}
