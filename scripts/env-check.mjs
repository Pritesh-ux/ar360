const specs = [
  ["MYSQL_HOST", true],
  ["MYSQL_USER", true],
  ["MYSQL_DATABASE", true],
  ["NEXT_PUBLIC_APP_URL", true],
  ["RAZORPAY_KEY_ID", false],
  ["RAZORPAY_KEY_SECRET", false],
  ["NEXT_PUBLIC_RAZORPAY_KEY_ID", false],
  ["RAZORPAY_WEBHOOK_SECRET", false],
  ["BILLING_SELLER_NAME", false],
  ["BILLING_SELLER_GSTIN", false],
  ["SMTP_HOST", false],
  ["SMTP_USER", false],
  ["SMTP_PASSWORD", false],
  ["WORKER_SECRET", false],
];

let failed = false;
console.log("\nARStudio360 env check\n");
for (const [key, required] of specs) {
  const present = Boolean(process.env[key]);
  const label = present ? "OK" : required ? "MISSING" : "OPTIONAL";
  console.log(`${label.padEnd(8)} ${key}`);
  if (required && !present) failed = true;
}
if (failed) process.exit(1);
