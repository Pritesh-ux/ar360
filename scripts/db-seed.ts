import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";
import fs from "fs/promises";
import path from "path";
import { randomBytes, scryptSync } from "crypto";

loadEnvConfig(process.cwd());

const database = process.env.MYSQL_DATABASE || "arstudio";
const uri = process.env.MYSQL_URL || process.env.DATABASE_URL;

const customerEmail = (process.env.SEED_CUSTOMER_EMAIL || "customer@ar360.com").toLowerCase();
const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || "Customer@12345";
const customerName = process.env.SEED_CUSTOMER_NAME || "Demo Customer";
const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@ar360.com").toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
const adminName = process.env.SEED_ADMIN_NAME || "Master Admin";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

async function seedDemoAdminData(connection: mysql.Connection) {
  const { seedAdminRbac } = await import("../src/lib/seed/admin-rbac-seed");
  const { seedDemoCoupons } = await import("../src/lib/seed/demo-coupons");
  const { seedDemoSupportTickets } = await import("../src/lib/seed/demo-support-tickets");
  await seedAdminRbac(connection);
  await seedDemoCoupons(connection);
  await seedDemoSupportTickets(connection);
}

async function main() {
  const connectionOptions = uri
    ? { uri, multipleStatements: true }
    : {
        host: process.env.MYSQL_HOST || "localhost",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database,
        multipleStatements: true,
      };

  const connection = await mysql.createConnection(connectionOptions as any);

  // 1. Run 01_seed_plans.sql
  console.log("Seeding billing plans...");
  const seederPath = path.resolve(process.cwd(), "database", "seeders", "01_seed_plans.sql");
  const seederSql = await fs.readFile(seederPath, "utf-8");
  if (seederSql.trim()) {
    await connection.query(seederSql);
  }
  console.log("Billing plans seeded.");

  // 2. Seed Master Admin
  console.log("Seeding master admin...");
  const adminUid = `ADM-${randomBytes(10).toString("hex").toUpperCase()}`;
  await connection.execute(
    `INSERT INTO master_admins (admin_uid, name, email, password_hash, status, two_factor_enabled)
     VALUES (?, ?, ?, ?, 'Active', FALSE)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), status = 'Active'`,
    [adminUid, adminName, adminEmail, hashPassword(adminPassword)]
  );
  console.log(`Master admin ready: ${adminEmail}`);

  const { seedAdminRbac } = await import("../src/lib/seed/admin-rbac-seed");
  await seedAdminRbac(connection);

  // 3. Seed Users & Customers (conditional)
  if (process.env.SEED_DEMO_DATA === "true") {
    console.log("Seeding demo customer...");
    const userUid = `USR-${randomBytes(10).toString("hex").toUpperCase()}`;
    await connection.execute(
      `INSERT INTO users (user_uid, name, email, password_hash, role, status, email_verified, two_factor_enabled)
       VALUES (?, ?, ?, ?, 'user', 'Active', TRUE, FALSE)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), status = 'Active'`,
      [userUid, customerName, customerEmail, hashPassword(customerPassword)]
    );

    const [users]: any = await connection.execute("SELECT id, name, email FROM users WHERE email = ? LIMIT 1", [customerEmail]);
    const user = users[0];

    if (user) {
      const [customers]: any = await connection.execute("SELECT customer_uid FROM customers WHERE user_id = ? LIMIT 1", [user.id]);
      let customerUid = customers[0]?.customer_uid;

      if (!customerUid) {
        customerUid = `CUS-${Math.floor(100000 + Math.random() * 899999)}`;
        await connection.execute(
          "INSERT INTO customers (user_id, customer_uid, contact_name, email, plan_id, status) VALUES (?, ?, ?, ?, 'professional', 'Active')",
          [user.id, customerUid, user.name, user.email]
        );
      } else {
        await connection.execute(
          "UPDATE customers SET plan_id = 'professional', status = 'Active' WHERE customer_uid = ?",
          [customerUid]
        );
      }

      // Seed Active Customer Subscription
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30); // 30 days trial/active subscription

      await connection.execute(
        `INSERT INTO customer_subscriptions (customer_uid, plan_id, status, current_period_start, current_period_end)
         VALUES (?, 'professional', 'active', ?, ?)
         ON DUPLICATE KEY UPDATE plan_id = 'professional', status = 'active', current_period_start = ?, current_period_end = ?`,
        [customerUid, start, end, start, end]
      );

      await connection.execute(
        `INSERT INTO user_preferences (user_id, customer_uid, theme, default_product_view, items_per_page, date_format, language, timezone)
         VALUES (?, ?, 'light', 'grid', 12, 'dmy', 'en', 'Asia/Kolkata')
         ON DUPLICATE KEY UPDATE customer_uid = VALUES(customer_uid)`,
        [user.id, customerUid],
      ).catch(() => {
        console.warn("user_preferences not seeded — run `npm run db:migrate` first.");
      });

      console.log(`Demo customer ready: ${customerEmail}`);
    }

    await seedDemoAdminData(connection);
  } else {
    console.log("SEED_DEMO_DATA is not 'true'. Skipping demo customer, coupons, and support tickets seeding.");
  }

  await connection.end();
  console.log("Seeding completed successfully.");
}

main().catch((error) => {
  console.error("Seeding failed:");
  console.error(error);
  process.exit(1);
});
