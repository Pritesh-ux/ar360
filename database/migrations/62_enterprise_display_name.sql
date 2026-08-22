-- Migration 62: Display name ORGANISATION → ENTERPRISE (plan id stays `enterprise`)
-- Aligns public/master labels with Enterprise Requests (one sales-assisted tier).

UPDATE billing_plans
   SET name = 'ENTERPRISE',
       tagline = 'Fully custom contracts for your enterprise',
       description = 'Sales-assisted plans with negotiated limits, pricing, and support.',
       updated_at = CURRENT_TIMESTAMP
 WHERE id = 'enterprise';

UPDATE plans
   SET name = 'ENTERPRISE',
       description = 'Sales-assisted plans with negotiated limits, pricing, and support.'
 WHERE id = 'enterprise';
