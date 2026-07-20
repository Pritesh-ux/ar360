import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import QrCenterClient from "./QrCenterClient";

export default async function QrCenterPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="grid min-h-0 flex-1 place-items-center text-sm font-semibold text-[var(--ar-text-muted)]">
            Loading QR Center…
          </div>
        }
      >
        <QrCenterClient />
      </Suspense>
    </div>
  );
}
