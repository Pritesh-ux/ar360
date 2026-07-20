import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import QrEditClient from "./QrEditClient";

export default async function QrEditPage(props: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  const { id } = await props.params;

  return (
    <Suspense
      fallback={
        <div className="grid min-h-[45vh] place-items-center text-sm font-semibold text-[var(--ar-text-muted)]">
          Loading QR Configurator…
        </div>
      }
    >
      <QrEditClient qrId={id} />
    </Suspense>
  );
}
