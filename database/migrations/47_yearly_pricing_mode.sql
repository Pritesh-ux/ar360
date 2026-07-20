-- Yearly pricing: manual absolute INR, or percent-off from monthly × 12.
-- Resolved price_yearly_inr is always stored for Razorpay / invoices.

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS yearly_pricing_mode ENUM('manual', 'percent_off') NOT NULL DEFAULT 'manual' AFTER price_yearly_inr,
  ADD COLUMN IF NOT EXISTS yearly_discount_percent DECIMAL(5,2) NULL AFTER yearly_pricing_mode;
