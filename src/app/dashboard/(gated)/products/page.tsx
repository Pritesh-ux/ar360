import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import ProductsClient from "./ProductsClient";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default async function ProductsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <UserWorkspaceLoading label="Loading Products" hint="Please wait while we load your products..." />
        }
      >
        <ProductsClient />
      </Suspense>
    </div>
  );
}
