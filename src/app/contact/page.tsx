import { Suspense } from "react";
import ContactClient from "./ContactClient";

export const metadata = {
  title: "Contact — AR360",
  description:
    "Contact the AR360 team for sales, demos, enterprise plans, or product support. We reply within one business day.",
};

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-white text-sm font-medium text-[#6B7280]">
          Loading contact…
        </main>
      }
    >
      <ContactClient />
    </Suspense>
  );
}
