import { redirect } from "next/navigation";

export default function BillingInvoicesRedirectPage() {
  redirect("/dashboard/billing?tab=invoices");
}
