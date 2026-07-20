import { redirect } from "next/navigation";

export default function LegacyInvoicesRedirect() {
  redirect("/master-admin/billing");
}
