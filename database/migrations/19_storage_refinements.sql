-- Migration 19: Storage refinements and unique index for product_assets
-- Idempotent

-- Clean up any invalid or orphan records in product_assets
DELETE FROM product_assets WHERE customer_uid IS NULL OR product_uid IS NULL OR file_path IS NULL;

-- Remove duplicates before adding unique index
CREATE TABLE IF NOT EXISTS product_assets_temp AS
SELECT MIN(id) as id
FROM product_assets
GROUP BY customer_uid, product_uid, file_path;

DELETE FROM product_assets
WHERE id NOT IN (SELECT id FROM product_assets_temp);

DROP TABLE IF EXISTS product_assets_temp;

-- Add UNIQUE index to enforce single record per file per product
ALTER TABLE product_assets ADD UNIQUE INDEX uq_customer_product_file (customer_uid, product_uid, file_path);
