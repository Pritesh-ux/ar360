import { Suspense } from "react";
import ContactClient from "./ContactClient";
import MarketingShell from "@/components/landing/MarketingShell";
import { getMarketingChrome } from "@/lib/website/marketing-chrome";

export const metadata = {
  title: "Contact — AR360",
  description:
    "Contact the AR360 team for sales, demos, enterprise plans, or product support. We reply within one business day.",
};

export const revalidate = 15;

export default async function ContactPage() {
  const chrome = await getMarketingChrome();

  return (
    <MarketingShell {...chrome}>
      <Suspense
        fallback={
          <div className="grid min-h-[50vh] place-items-center text-sm font-medium text-[#6B7280]">
            Loading contact…
          </div>
        }
      >
        <ContactClient />
      </Suspense>
    </MarketingShell>
  );
}
