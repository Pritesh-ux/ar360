import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import NewProductClient from "./NewProductClient";

export default async function NewProductPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return <NewProductClient />;
}
