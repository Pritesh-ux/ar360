import { redirect } from "next/navigation";

export default function LegacyBandwidthRedirect() {
  redirect("/master-admin/viewer-analytics");
}
