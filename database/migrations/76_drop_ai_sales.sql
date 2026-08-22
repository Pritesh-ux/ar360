-- Remove AI Sales module completely.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS ai_sales_jobs;
DROP TABLE IF EXISTS ai_sales_usage;
DROP TABLE IF EXISTS ai_sales_dnc;
DROP TABLE IF EXISTS ai_sales_activities;
DROP TABLE IF EXISTS ai_sales_messages;
DROP TABLE IF EXISTS ai_sales_conversations;
DROP TABLE IF EXISTS ai_sales_outreach;
DROP TABLE IF EXISTS ai_sales_prospects;
DROP TABLE IF EXISTS ai_sales_contacts;
DROP TABLE IF EXISTS ai_sales_companies;
DROP TABLE IF EXISTS ai_sales_campaigns;
DROP TABLE IF EXISTS ai_sales_settings;
DROP TABLE IF EXISTS ai_sales_products;

SET FOREIGN_KEY_CHECKS = 1;

DELETE FROM admin_role_permissions WHERE permission_code IN ('ai_sales.read', 'ai_sales.manage');
DELETE FROM admin_permissions WHERE code IN ('ai_sales.read', 'ai_sales.manage');
