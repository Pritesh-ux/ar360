import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage(props: {
  searchParams: Promise<{ tab?: string; expired?: string }>;
}) {
  const searchParams = await props.searchParams;
  if (searchParams.tab === "billing" || searchParams.tab === "subscription" || searchParams.expired === "1") {
    const expiredQuery = searchParams.expired === "1" ? "?expired=1" : "";
    redirect(`/dashboard/subscription${expiredQuery}`);
  }
  if (searchParams.tab === "invoices") {
    redirect("/dashboard/billing?tab=invoices");
  }
  if (searchParams.tab === "branding") {
    redirect("/dashboard/branding");
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SettingsClient />
    </div>
  );
}
