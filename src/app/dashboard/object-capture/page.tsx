import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/billing/permissions";
import { SUBSCRIPTION_EXPIRED_PATH } from "@/lib/subscription/subscription-paths";
import { redirect } from "next/navigation";
import ObjectCapturePage from "./ObjectCaptureClient";
import { Suspense } from "react";
import { UserPageHeader } from "@/components/user-panel";

export const metadata = {
  title: "Object Capture — AR360 Studio",
  description: "Capture real-world objects and convert them into 3D models using photogrammetry.",
};

export default async function ObjectCaptureServerPage() {
  const user = await requireUser();
  const permission = await assertCan(user.customerUid, "object_capture");
  if (!permission.allowed) {
    redirect(SUBSCRIPTION_EXPIRED_PATH);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <UserPageHeader
              title="Object Capture"
              subtitle="Capture real-world objects and turn them into 3D models."
            />
            <div className="grid flex-1 place-items-center text-sm font-semibold text-[#737373]">
              Loading Object Capture…
            </div>
          </div>
        }
      >
        <ObjectCapturePage />
      </Suspense>
    </div>
  );
}
