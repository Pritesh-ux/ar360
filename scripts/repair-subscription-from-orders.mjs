/**
 * Repair subscriptions from paid billing_orders when verify-payment
 * recorded payment but subscription activation failed.
 *
 * Usage: node scripts/repair-subscription-from-orders.mjs [customer_uid]
 */
import mysql from "mysql2/promise";

const customerUid = process.argv[2] || "";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "arstudio",
});

const where = customerUid ? "AND bo.customer_uid = ?" : "";
const params = customerUid ? [customerUid] : [];

const [orders] = await conn.query(
  `SELECT bo.customer_uid, bo.plan_id, bo.billing_period, bo.updated_at
   FROM billing_orders bo
   INNER JOIN billing_payments bp ON bp.order_uid = bo.order_uid AND bp.status = 'captured'
   WHERE bo.status = 'paid' ${where}
   ORDER BY bo.updated_at DESC`,
  params,
);

const seen = new Set();
let repaired = 0;

for (const order of orders) {
  if (seen.has(order.customer_uid)) continue;
  seen.add(order.customer_uid);

  const periodEndSql =
    order.billing_period === "yearly"
      ? "DATE_ADD(NOW(), INTERVAL 1 YEAR)"
      : "DATE_ADD(NOW(), INTERVAL 1 MONTH)";

  const [plans] = await conn.query(
    "SELECT products, storage_gb, bandwidth_gb FROM billing_plans WHERE id = ? LIMIT 1",
    [order.plan_id],
  );
  const plan = plans[0] || { products: 5, storage_gb: 0.5, bandwidth_gb: 5 };
  const storageMb = Math.round(Number(plan.storage_gb) * 1024);
  const bandwidthMb = Math.round(Number(plan.bandwidth_gb) * 1024);

  await conn.query(
    `INSERT INTO customer_subscriptions (
       customer_uid, plan_id, status, billing_period,
       current_period_start, current_period_end, trial_used,
       product_limit, storage_limit_mb, bandwidth_limit_mb, provider
     ) VALUES (?, ?, 'active', ?, NOW(), ${periodEndSql}, 1, ?, ?, ?, 'razorpay')
     ON DUPLICATE KEY UPDATE
       plan_id = VALUES(plan_id),
       status = 'active',
       billing_period = VALUES(billing_period),
       current_period_start = NOW(),
       current_period_end = ${periodEndSql},
       product_limit = VALUES(product_limit),
       storage_limit_mb = VALUES(storage_limit_mb),
       bandwidth_limit_mb = VALUES(bandwidth_limit_mb),
       updated_at = NOW()`,
    [order.customer_uid, order.plan_id, order.billing_period, plan.products, storageMb, bandwidthMb],
  );

  await conn.query(
    `UPDATE customers SET plan_id = ?, status = 'Active', updated_at = NOW() WHERE customer_uid = ?`,
    [order.plan_id, order.customer_uid],
  );

  console.log(`Repaired ${order.customer_uid} → ${order.plan_id}`);
  repaired += 1;
}

console.log(`Done. Repaired ${repaired} customer(s).`);
await conn.end();
