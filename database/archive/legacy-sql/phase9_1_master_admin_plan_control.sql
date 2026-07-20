CREATE TABLE IF NOT EXISTS billing_plans (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  tagline VARCHAR(180) NULL,
  description TEXT NULL,
  storage_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
  bandwidth_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
  products INT NOT NULL DEFAULT 0,
  price_monthly_inr INT NULL,
  price_yearly_inr INT NULL,
  trial_hours INT NULL,
  popular TINYINT(1) NOT NULL DEFAULT 0,
  badge VARCHAR(80) NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'paper',
  features_json JSON NULL,
  custom_branding TINYINT(1) NOT NULL DEFAULT 0,
  advanced_analytics TINYINT(1) NOT NULL DEFAULT 0,
  embed_viewer TINYINT(1) NOT NULL DEFAULT 0,
  priority_processing TINYINT(1) NOT NULL DEFAULT 0,
  priority_support TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_uid VARCHAR(80) NOT NULL,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'trialing',
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_subscription_customer (customer_uid),
  INDEX idx_customer_subscriptions_plan (plan_id),
  INDEX idx_customer_subscriptions_status (status)
);

INSERT INTO billing_plans (
  id, name, tagline, description, storage_gb, bandwidth_gb, products,
  price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
  features_json, custom_branding, advanced_analytics, embed_viewer,
  priority_processing, priority_support, is_active, sort_order
)
VALUES
('trial','STARTER','Move your first steps with ARStudio360','24 hours trial for testing your first 3D/AR product.',0.10,1,1,0,0,24,0,'24 Hours Trial','paper',JSON_ARRAY('1 Active Product','3D Viewer & AR','QR Code Sharing','Public Share Link','Basic Analytics','Auto delete after 24 hours if not upgraded'),0,0,0,0,0,1,0),
('basic','BASIC','Upgrade your info-commerce','For small sellers who need clean 3D viewer, QR and AR.',0.50,5,5,249,2499,NULL,0,NULL,'plane',JSON_ARRAY('5 Active Products','All Starter features','Download QR','Viewer Link','Basic Analytics','Email support'),0,0,0,0,0,1,1),
('professional','PROFESSIONAL','Boost your e-commerce','Best for Amazon, Flipkart, furniture, tile and product brands.',5.00,50,50,999,9999,NULL,1,'Most Popular','rocket',JSON_ARRAY('50 Active Products','All Basic features','Advanced Analytics','Custom Branding','Embed Viewer','Priority Processing'),1,1,1,1,0,1,2),
('enterprise','ENTERPRISE','If it’s digital, it’s your job','For high-volume businesses and custom AR workflows.',25.00,250,250,NULL,NULL,NULL,0,NULL,'planet',JSON_ARRAY('250 Active Products','All Professional features','Custom Solution','Priority Support','High Usage','Dedicated Setup'),1,1,1,1,1,1,3)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), tagline = VALUES(tagline), description = VALUES(description),
  storage_gb = VALUES(storage_gb), bandwidth_gb = VALUES(bandwidth_gb), products = VALUES(products),
  price_monthly_inr = VALUES(price_monthly_inr), price_yearly_inr = VALUES(price_yearly_inr),
  trial_hours = VALUES(trial_hours), popular = VALUES(popular), badge = VALUES(badge), icon = VALUES(icon),
  features_json = VALUES(features_json), custom_branding = VALUES(custom_branding),
  advanced_analytics = VALUES(advanced_analytics), embed_viewer = VALUES(embed_viewer),
  priority_processing = VALUES(priority_processing), priority_support = VALUES(priority_support),
  is_active = VALUES(is_active), sort_order = VALUES(sort_order), updated_at = NOW();
