import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const to = process.argv[2]?.trim() || "asodariyapritesh5@gmail.com";
  const { sendEmail } = await import("../src/lib/email/send-email.ts");
  const { renderCustomerLifecycleEmail, absoluteAppUrl } = await import(
    "../src/lib/email/templates/customer-lifecycle.ts"
  );

  const content = renderCustomerLifecycleEmail("Pritesh", {
    subject: "Your AR360 invoice INV-SAMPLE-001",
    title: "Invoice ready",
    intro: "Your latest invoice is ready. You can review the details below or open billing in your dashboard.",
    details: [
      { label: "Invoice", value: "INV-SAMPLE-001" },
      { label: "Plan", value: "Enterprise" },
      { label: "Amount", value: "Rs. 1,50,000" },
      { label: "Due date", value: "31 Jul 2026" },
      { label: "Status", value: "Paid" },
    ],
    actionLabel: "Open billing",
    actionUrl: absoluteAppUrl("/dashboard/billing"),
  });

  const result = await sendEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  console.log("TO", to);
  console.log("RESULT", JSON.stringify(result, null, 2));
  process.exit(result.delivered ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
