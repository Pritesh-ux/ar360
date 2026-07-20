import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "@/lib/db";

test("durable webhook inbox dedupes concurrent delivery keys in MySQL", async () => {
  const pool = await getPool();
  const connection = await pool.getConnection();
  const nonce = crypto.randomBytes(8).toString("hex");
  const dedupeKey = `integration:${nonce}`;
  try {
    await connection.beginTransaction();
    const sql = `INSERT IGNORE INTO billing_webhook_events
      (event_uid, provider, provider_mode, event_type, provider_event_id, dedupe_key,
       signature_valid, payload, payload_hash, status, event_created_at)
      VALUES (?, 'razorpay', 'test', 'payment.captured', ?, ?, 1, '{}', ?, 'received', 1720000000)`;
    const [first] = await connection.execute<ResultSetHeader>(
      sql, [`wh_it_${nonce}_1`, `delivery_${nonce}`, dedupeKey, nonce.padEnd(64, "0")],
    );
    const [duplicate] = await connection.execute<ResultSetHeader>(
      sql, [`wh_it_${nonce}_2`, `delivery_${nonce}`, dedupeKey, nonce.padEnd(64, "0")],
    );
    assert.equal(first.affectedRows, 1);
    assert.equal(duplicate.affectedRows, 0);

    const [outboxColumns] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_notification_outbox'`,
    );
    assert.ok(Number(outboxColumns[0].total) >= 10);
  } finally {
    await connection.rollback();
    connection.release();
    await pool.end();
  }
});
