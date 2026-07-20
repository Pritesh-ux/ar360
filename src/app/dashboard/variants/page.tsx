import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import { Suspense } from "react";
import { UserPageHeader } from "@/components/user-panel";
import VariantsPageClient from "./VariantsPageClient";

export const metadata = {
  title: "Variants & Configurations — AR360 Studio",
  description: "Manage product variants and material configurations for your 3D products.",
};

export default async function VariantsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3">
          <UserPageHeader
            title="Variants & Configurations"
            subtitle="Select a product to manage its colour variants and material configurations."
          />
          <div className="grid flex-1 place-items-center text-sm font-semibold text-[#737373]">
            Loading products…
          </div>
        </div>
      }
    >
      <VariantsPageClient />
    </Suspense>
  );
}

