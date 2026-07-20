-- Make Object Capture/customer notification deduplication atomic under concurrent status updates.
DELETE older
FROM customer_notifications older
JOIN customer_notifications newer
  ON newer.customer_uid = older.customer_uid
 AND newer.dedupe_key = older.dedupe_key
 AND newer.id > older.id
WHERE older.dedupe_key IS NOT NULL;

ALTER TABLE customer_notifications
  DROP INDEX IF EXISTS idx_customer_notifications_dedupe,
  ADD UNIQUE INDEX IF NOT EXISTS uq_customer_notifications_dedupe (customer_uid, dedupe_key);
