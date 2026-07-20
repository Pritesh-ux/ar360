import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import { Suspense } from "react";
import { UserPageHeader } from "@/components/user-panel";
import MaterialsPageClient from "./MaterialsPageClient";

export const metadata = {
  title: "Materials Editor — AR360 Studio",
  description: "Configure materials, textures and surface finishes for your 3D products.",
};

export default async function MaterialsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3">
          <UserPageHeader
            title="Materials Editor"
            subtitle="Select a product to configure its materials, textures, and surface finishes."
          />
          <div className="grid flex-1 place-items-center text-sm font-semibold text-[#737373]">
            Loading products…
          </div>
        </div>
      }
    >
      <MaterialsPageClient />
    </Suspense>
  );
}

