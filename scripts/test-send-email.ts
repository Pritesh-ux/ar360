import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const to = process.argv[2]?.trim() || process.env.EMAIL_TEST_TO?.trim() || "";
  const { resolveEmailDeliveryConfig, getEmailDeliveryStatus } = await import(
    "../src/lib/email/delivery-config.ts"
  );
  const { sendEmail } = await import("../src/lib/email/send-email.ts");

  const status = await getEmailDeliveryStatus();
  console.log("STATUS", JSON.stringify(status, null, 2));

  const delivery = await resolveEmailDeliveryConfig();
  console.log(
    "PROVIDER",
    delivery.provider,
    delivery.provider === "disabled" ? delivery.reason : "",
  );

  if (!to) {
    console.log("USAGE: npx tsx --env-file=.env.local scripts/test-send-email.ts you@email.com");
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: "AR360 Studio live email test",
    text: "This is a live delivery test from AR360 Studio.",
    html: "<p>This is a <strong>live delivery test</strong> from AR360 Studio.</p>",
  });

  console.log("RESULT", JSON.stringify(result, null, 2));
  process.exit(result.delivered ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
