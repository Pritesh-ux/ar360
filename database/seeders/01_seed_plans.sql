-- Seeder 01: Default Billing Plans

INSERT INTO billing_plans (
  id, name, tagline, description, storage_gb, bandwidth_gb, products,
  price_monthly_inr, price_yearly_inr, trial_hours, popular, badge, icon,
  features_json, custom_branding, advanced_analytics, embed_viewer,
  priority_processing, priority_support, is_active, sort_order
) VALUES (
  'trial', 'TRIAL', 'Move your first steps with ARStudio360', 'Free plan for testing your first 3D/AR product.',
  0.10, 1.00, 1, 0, 0, 24, 0, '24 Hours Trial', 'paper',
  '["1 Active Product", "3D Viewer & AR", "QR Code Sharing", "Public Share Link", "Basic Analytics", "Auto delete after 24 hours if not upgraded"]',
  0, 0, 0, 0, 0, 1, 0
), (
  'basic', 'BASIC', 'Upgrade your info-commerce', 'For small sellers who need clean 3D viewer, QR and AR.',
  0.50, 5.00, 5, 249, 2499, NULL, 0, NULL, 'plane',
  '["5 Active Products", "All Free features", "Download QR", "Viewer Link", "Basic Analytics", "Email support"]',
  0, 0, 0, 0, 0, 1, 1
), (
  'professional', 'PROFESSIONAL', 'Boost your e-commerce', 'Best for Amazon, Flipkart, furniture, tile and product brands.',
  5.00, 50.00, 50, 999, 9999, NULL, 1, 'Most Popular', 'rocket',
  '["50 Active Products", "All Basic features", "Advanced Analytics", "Custom Branding", "Embed Viewer", "Priority Processing"]',
  1, 1, 1, 1, 0, 1, 2
), (
  'enterprise', 'ENTERPRISE', 'If it\'s digital, it\'s your job', 'For high-volume businesses and custom AR workflows.',
  25.00, 250.00, 250, NULL, NULL, NULL, 0, NULL, 'planet',
  '["250 Active Products", "All Professional features", "Custom Solution", "Priority Support", "High Usage", "Dedicated Setup"]',
  1, 1, 1, 1, 1, 1, 3
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
  sort_order = VALUES(sort_order);

-- Seed legacy plan table for compatibility
INSERT INTO plans (
  id, name, description, monthly_price, yearly_price, products, storage, bandwidth, views, team_members, analytics, api_access, custom_branding, white_label, support, status, popular, sort_order
) VALUES (
  'trial', 'TRIAL', 'Free plan for testing your first 3D/AR product.', 0, 0, '1', '0.10 GB', '1.00 GB', '50,000/month', '1', 'Basic', 0, 0, 0, 'Email', 'Active', 0, 0
), (
  'basic', 'BASIC', 'For small sellers who need clean 3D viewer, QR and AR.', 249, 2499, '5', '0.50 GB', '5.00 GB', '50,000/month', '1', 'Basic', 0, 0, 0, 'Email', 'Active', 0, 1
), (
  'professional', 'PROFESSIONAL', 'Best for Amazon, Flipkart, furniture, tile and product brands.', 999, 9999, '50', '5.00 GB', '50.00 GB', '50,000/month', '1', 'Advanced', 0, 1, 0, 'Email', 'Active', 1, 2
), (
  'enterprise', 'ENTERPRISE', 'For high-volume businesses and custom AR workflows.', 0, 0, '250', '25.00 GB', '250.00 GB', 'Custom', 'Custom', 'Advanced', 1, 1, 1, 'Priority', 'Active', 0, 3
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
