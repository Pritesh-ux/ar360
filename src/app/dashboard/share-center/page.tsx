import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import ShareCenterClient from "./ShareCenterClient";

export default async function ShareCenterPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <Suspense
      fallback={
        <div className="grid min-h-[40vh] place-items-center text-sm font-semibold text-[var(--ar-text-muted)]">
          Loading Share Center…
        </div>
      }
    >
      <ShareCenterClient />
    </Suspense>
  );
}
