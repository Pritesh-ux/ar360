-- Migration 56: Spreadsheet plan catalog + Intermediate + Organisation display name
-- Keeps plan id `enterprise` for Organisation (custom / sales-assisted).

INSERT INTO billing_plans (
  id, name, tagline, description, storage_gb, bandwidth_gb, products,
  price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
  features_json, custom_branding, advanced_analytics, embed_viewer,
  priority_processing, priority_support, is_active, sort_order,
  unlimited_storage, unlimited_bandwidth, bandwidth_resets_monthly, qr_limit, share_link_limit, sales_channel
) VALUES (
  'trial', 'TRIAL', 'Move your first steps with ARStudio360', 'Free plan for testing your first 3D/AR product.',
  0.10, 1.00, 10, 0, 0, 72, 0, '3 Days Trial', 'paper',
  '["10 Active Products", "3D Viewer & AR", "QR Code Sharing", "Public Share Link", "Basic Analytics", "Auto delete after 3 days if not upgraded"]',
  0, 0, 0, 0, 0, 1, 0,
  0, 0, 0, 3, 5, 'self_service'
), (
  'starter', 'STARTER', 'Upgrade your info-commerce', 'For small sellers who need clean 3D viewer, QR and AR.',
  0.50, 2.00, 10, 999, 9990, NULL, 0, NULL, 'plane',
  '["10 Active Products", "AR Experience", "3D Viewer", "QR Codes", "Share Links", "Email support", "Download QR", "Viewer Link"]',
  0, 0, 0, 0, 0, 1, 1,
  0, 0, 0, 10, NULL, 'self_service'
), (
  'intermediate', 'INTERMEDIATE', 'Grow with embed-ready product experiences', 'For growing sellers who need more products and website embed.',
  2.00, 100.00, 50, 1799, 17990, NULL, 0, NULL, 'plane',
  '["50 Active Products", "AR Experience", "All Basic features", "3D Viewer", "QR Codes", "Share Links", "Email support", "Download QR", "Viewer Link", "Embed Viewer"]',
  0, 0, 1, 0, 0, 1, 2,
  0, 0, 0, 50, NULL, 'self_service'
), (
  'pro', 'PRO', 'Boost your e-commerce', 'Best for Amazon, Flipkart, furniture, tile and product brands.',
  5.00, 250.00, 100, 2599, 25990, NULL, 1, 'Most Popular', 'rocket',
  '["100 Active Products", "AR Experience", "All Basic features", "3D Viewer", "QR Codes", "Share Links", "Email support", "Download QR", "Viewer Link", "Embed Viewer", "Advanced Analytics", "Custom Branding", "Priority Support"]',
  1, 1, 1, 0, 1, 1, 3,
  0, 0, 0, 100, NULL, 'self_service'
), (
  'business', 'BUSINESS', 'Scale client delivery with high usage', 'For agencies and high-volume businesses managing multiple clients.',
  10.00, 500.00, 200, 4999, 49990, NULL, 0, NULL, 'planet',
  '["200 Active Products", "AR Experience", "All Basic features", "3D Viewer", "QR Codes", "Share Links", "Email support", "Download QR", "Viewer Link", "Embed Viewer", "Advanced Analytics", "Custom Branding", "Priority Support", "Client Management", "High Usage"]',
  1, 1, 1, 1, 1, 1, 4,
  0, 0, 0, 200, NULL, 'self_service'
), (
  'enterprise', 'ORGANISATION', 'Fully custom contracts for your organisation', 'Sales-assisted plans with negotiated limits, pricing, and support.',
  25.00, 250.00, 250, NULL, NULL, NULL, 0, NULL, 'planet',
  '["Fully custom limits and workflows", "Dedicated onboarding", "Priority support", "Contract billing", "White Label viewer", "Custom Domain", "Client Management"]',
  1, 1, 1, 1, 1, 1, 5,
  0, 0, 0, NULL, NULL, 'manual'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  tagline = VALUES(tagline),
  description = VALUES(description),
  storage_gb = VALUES(storage_gb),
  bandwidth_gb = VALUES(bandwidth_gb),
  products = VALUES(products),
  price_monthly_inr = VALUES(price_monthly_inr),
  price_yearly_inr = VALUES(price_yearly_inr),
  trial_hours = VALUES(trial_hours),
  popular = VALUES(popular),
  badge = VALUES(badge),
  icon = VALUES(icon),
  features_json = VALUES(features_json),
  custom_branding = VALUES(custom_branding),
  advanced_analytics = VALUES(advanced_analytics),
  embed_viewer = VALUES(embed_viewer),
  priority_processing = VALUES(priority_processing),
  priority_support = VALUES(priority_support),
  is_active = VALUES(is_active),
  sort_order = VALUES(sort_order),
  unlimited_storage = VALUES(unlimited_storage),
  unlimited_bandwidth = VALUES(unlimited_bandwidth),
  bandwidth_resets_monthly = VALUES(bandwidth_resets_monthly),
  qr_limit = VALUES(qr_limit),
  share_link_limit = VALUES(share_link_limit),
  sales_channel = VALUES(sales_channel);

-- Align plan_level with new hierarchy when column exists
UPDATE billing_plans SET plan_level = 0 WHERE id IN ('trial', 'free');
UPDATE billing_plans SET plan_level = 1 WHERE id IN ('basic', 'starter');
UPDATE billing_plans SET plan_level = 2 WHERE id = 'intermediate';
UPDATE billing_plans SET plan_level = 3 WHERE id IN ('professional', 'pro');
UPDATE billing_plans SET plan_level = 4 WHERE id = 'business';
UPDATE billing_plans SET plan_level = 5, sales_channel = 'manual' WHERE id IN ('enterprise', 'agency');

INSERT INTO plans (
  id, name, description, monthly_price, yearly_price, products, storage, bandwidth, views, team_members, analytics, api_access, custom_branding, white_label, support, status, popular, sort_order
) VALUES (
  'trial', 'TRIAL', 'Free plan for testing your first 3D/AR product.', 0, 0, '1', '0.10 GB', '1.00 GB', '50,000/month', '1', 'Basic', 0, 0, 0, 'Email', 'Active', 0, 0
), (
  'starter', 'STARTER', 'For small sellers who need clean 3D viewer, QR and AR.', 999, 9990, '10', '0.50 GB', '2.00 GB', '50,000/month', '1', 'Basic', 0, 0, 0, 'Email', 'Active', 0, 1
), (
  'intermediate', 'INTERMEDIATE', 'For growing sellers who need more products and website embed.', 1799, 17990, '50', '2.00 GB', '100.00 GB', '50,000/month', '1', 'Basic', 0, 0, 0, 'Email', 'Active', 0, 2
), (
  'pro', 'PRO', 'Best for Amazon, Flipkart, furniture, tile and product brands.', 2599, 25990, '100', '5.00 GB', '250.00 GB', '50,000/month', '1', 'Advanced', 0, 1, 0, 'Priority', 'Active', 1, 3
), (
  'business', 'BUSINESS', 'For agencies and high-volume businesses managing multiple clients.', 4999, 49990, '200', '10.00 GB', '500.00 GB', 'Custom', 'Custom', 'Advanced', 1, 1, 0, 'Priority', 'Active', 0, 4
), (
  'enterprise', 'ORGANISATION', 'Sales-assisted plans with negotiated limits, pricing, and support.', 0, 0, '250', '25.00 GB', '250.00 GB', 'Custom', 'Custom', 'Advanced', 1, 1, 1, 'Priority', 'Active', 0, 5
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  monthly_price = VALUES(monthly_price),
  yearly_price = VALUES(yearly_price),
  products = VALUES(products),
  storage = VALUES(storage),
  bandwidth = VALUES(bandwidth),
  views = VALUES(views),
  team_members = VALUES(team_members),
  analytics = VALUES(analytics),
  api_access = VALUES(api_access),
  custom_branding = VALUES(custom_branding),
  white_label = VALUES(white_label),
  support = VALUES(support),
  status = VALUES(status),
  popular = VALUES(popular),
  sort_order = VALUES(sort_order);
