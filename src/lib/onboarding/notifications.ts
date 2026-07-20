import { createCustomerNotification } from "@/lib/account/notify.service";

export async function createWelcomeNotification(customerUid: string) {
  await createCustomerNotification({
    customerUid,
    category: "welcome",
    title: "Welcome to AR360",
    body: "Create your first 3D product to get started.",
    href: "/dashboard/onboarding",
    dedupeKey: "welcome",
  });
}
