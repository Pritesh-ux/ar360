#!/bin/bash
set -euo pipefail
APP=/var/www/ar360/deploy
get_env() { grep -E "^${1}=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//"; }
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE)
DB_NAME=${DB_NAME:-arstudio}
mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT c.customer_uid, c.plan_id AS customer_plan, c.status AS customer_status,
       s.plan_id AS sub_plan, s.status AS sub_status, s.provider,
       ec.status AS contract_status, ec.starts_on, ec.expires_on,
       cp.custom_plan_uid, cp.name AS custom_plan_name
  FROM customers c
  LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
  LEFT JOIN enterprise_contracts ec ON ec.customer_id = c.id AND ec.status = 'active'
  LEFT JOIN enterprise_custom_plans cp ON cp.id = ec.custom_plan_id
 WHERE (s.plan_id IN ('trial','free') OR s.plan_id IS NULL OR c.plan_id IN ('trial','free'))
   AND (
     ec.id IS NOT NULL
     OR c.plan_id LIKE 'ecp_%'
     OR c.plan_id IN ('enterprise','organisation','organization')
     OR s.provider = 'manual_enterprise'
   )
 ORDER BY c.id DESC
 LIMIT 30;
"
