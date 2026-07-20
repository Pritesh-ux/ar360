import { query } from "@/lib/db";
import { getCustomerOnboarding } from "@/lib/onboarding/onboarding.service";

export type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  href: string;
};

export type OnboardingChecklist = {
  dismissed: boolean;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
};

async function hasCompleteProfile(customerUid: string) {
  const rows = await query<{ company_name: string | null }>(
    "SELECT company_name FROM customers WHERE customer_uid = ? LIMIT 1",
    [customerUid],
  );
  return Boolean(rows[0]?.company_name?.trim());
}

async function countProducts(customerUid: string) {
  const rows = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",
    [customerUid],
  );
  return Number(rows[0]?.total || 0);
}

async function countPublished(customerUid: string) {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM products
      WHERE customer_uid = ? AND deleted_at IS NULL
        AND LOWER(status) IN ('published', 'active')`,
    [customerUid],
  );
  return Number(rows[0]?.total || 0);
}

async function countQr(customerUid: string) {
  const rows = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM product_qr_codes WHERE customer_uid = ? AND deleted_at IS NULL",
    [customerUid],
  );
  return Number(rows[0]?.total || 0);
}

async function countShareLinks(customerUid: string) {
  const rows = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM share_links WHERE customer_uid = ? AND deleted_at IS NULL",
    [customerUid],
  );
  return Number(rows[0]?.total || 0);
}

export async function getOnboardingChecklist(customerUid: string): Promise<OnboardingChecklist> {
  const onboarding = await getCustomerOnboarding(customerUid);
  const [profileDone, products, published, qr, shares] = await Promise.all([
    hasCompleteProfile(customerUid),
    countProducts(customerUid),
    countPublished(customerUid),
    countQr(customerUid),
    countShareLinks(customerUid),
  ]);

  const items: ChecklistItem[] = [
    { id: "profile", label: "Complete company profile", completed: profileDone, href: "/dashboard/settings" },
    { id: "product", label: "Create first product", completed: products > 0, href: "/dashboard/products/new" },
    { id: "publish", label: "Publish product", completed: published > 0, href: "/dashboard/products" },
    { id: "qr", label: "Create QR code", completed: qr > 0, href: "/dashboard/qr-center" },
    { id: "share", label: "Share product", completed: shares > 0, href: "/dashboard/share-center" },
  ];

  const completedCount = items.filter((item) => item.completed).length;

  return {
    dismissed: Boolean(onboarding?.checklistDismissedAt),
    items,
    completedCount,
    totalCount: items.length,
  };
}
