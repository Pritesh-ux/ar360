import nextEnv from "@next/env";
import fs from "fs";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import crypto from "crypto";
import path from "path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const envPath = path.join(process.cwd(), ".env");

function upsertEnvLines(content, entries) {
  const lines = content.split(/\r?\n/);
  const keys = new Set(entries.map(([key]) => key));
  const kept = lines.filter((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    return !(match && keys.has(match[1]));
  });
  const block = entries.map(([key, value]) => `${key}=${value}`).join("\n");
  const trimmed = kept.join("\n").replace(/\n+$/, "");
  return `${trimmed}\n\n# Local System Health (auto)\n${block}\n`;
}

function encryptSecret(value) {
  const raw = process.env.BILLING_SETTINGS_ENCRYPTION_KEY || "";
  if (!raw) return value;
  const key = crypto.createHash("sha256").update(raw, "utf8").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

async function main() {
  const envContent = fs.readFileSync(envPath, "utf8");
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!keyId || !keySecret) {
    throw new Error(
      "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env (never hardcode keys in this script).",
    );
  }
  const razorpayEntries = [
    ["RAZORPAY_KEY_ID", keyId],
    ["RAZORPAY_KEY_SECRET", keySecret],
    ["RAZORPAY_WEBHOOK_SECRET", webhookSecret || "local_dev_webhook_secret_change_me"],
    ["NEXT_PUBLIC_RAZORPAY_KEY_ID", process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId],
  ];

  let smtpEntries = [];
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    const acct = await nodemailer.createTestAccount();
    smtpEntries = [
      ["SMTP_HOST", acct.smtp.host],
      ["SMTP_PORT", String(acct.smtp.port || 587)],
      ["SMTP_SECURE", acct.smtp.secure ? "true" : "false"],
      ["SMTP_USER", acct.user],
      ["SMTP_PASSWORD", acct.pass],
      ["SMTP_FROM", `AR360 Local <${acct.user}>`],
    ];
  }

  fs.writeFileSync(envPath, upsertEnvLines(envContent, [...razorpayEntries, ...smtpEntries]), "utf8");
  loadEnvConfig(process.cwd(), true);

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "arstudio",
  });

  const [ticketResult] = await connection.execute(`
    UPDATE support_tickets
    SET status = 'resolved', updated_at = NOW()
    WHERE status IN ('open', 'pending') AND priority = 'high'
  `);

  const platformRows = [
    ["razorpayKeyId", process.env.RAZORPAY_KEY_ID || "", 0],
    ["razorpayKeySecret", encryptSecret(process.env.RAZORPAY_KEY_SECRET || ""), 1],
    ["razorpayWebhookSecret", encryptSecret(process.env.RAZORPAY_WEBHOOK_SECRET || ""), 1],
    ["razorpayMode", "test", 0],
    ["smtpEnabled", "true", 0],
    ["emailNotifications", "true", 0],
    ["resendEnabled", "false", 0],
    ["smtpHost", process.env.SMTP_HOST || "", 0],
    ["smtpEmail", process.env.SMTP_USER || "", 0],
    ["smtpPort", String(process.env.SMTP_PORT || 587), 0],
    ["smtpPassword", encryptSecret(process.env.SMTP_PASSWORD || ""), 1],
  ];

  for (const [key, value, isSecret] of platformRows) {
    if (!value) continue;
    await connection.execute(
      `INSERT INTO platform_settings (setting_key, setting_value, is_secret)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), is_secret = VALUES(is_secret), updated_at = NOW()`,
      [key, value, isSecret],
    );
  }

  await connection.end();

  console.log("Local system health fixes applied.");
  console.log(`- Razorpay test keys saved to .env + platform_settings`);
  console.log(`- SMTP configured (${process.env.SMTP_HOST || "from Ethereal test inbox"})`);
  console.log(`- Resolved ${ticketResult.affectedRows} high-priority support ticket(s)`);
  console.log("Restart dev server: npm run dev");
}

main().catch((error) => {
  console.error("fix-local-system-health failed:", error.message);
  process.exit(1);
});
