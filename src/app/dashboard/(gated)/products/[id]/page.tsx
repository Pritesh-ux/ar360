import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import { getUserPanelSessionSummary } from "@/lib/user-panel/session-context";
import ProductDetailClient from "./ProductDetailClient";

export default async function ProductDetailPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  const session = await getUserPanelSessionSummary(user);

  return <ProductDetailClient session={session} />;
}
