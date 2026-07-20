import { redirect } from "next/navigation";

export default function LegacyAnalyticsRedirect() {
  redirect("/master-admin/viewer-analytics");
}
