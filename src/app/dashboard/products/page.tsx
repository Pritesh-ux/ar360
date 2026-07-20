import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="grid flex-1 place-items-center text-sm font-semibold text-[#737373]">
            Loading products…
          </div>
        }
      >
        <ProductsClient />
      </Suspense>
    </div>
  );
}
