import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import { redirect } from "next/navigation";

/** Legacy full-page upload — always send users to Products with the upload popup. */
export default async function NewProductPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);
  redirect("/dashboard/products?upload=1");
}
