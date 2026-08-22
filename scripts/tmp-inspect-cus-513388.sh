#!/bin/bash
set -euo pipefail
APP=/var/www/ar360/deploy
get_env() { grep -E "^${1}=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//"; }
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE)
DB_NAME=${DB_NAME:-arstudio}

mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT custom_plan_uid, name, is_active FROM enterprise_custom_plans WHERE custom_plan_uid='ecp_19b050357a66785263cf25d4';
SELECT customer_uid, plan_id, status FROM customers WHERE customer_uid='CUS-513388';
SELECT customer_uid, plan_id, status, provider, billing_period, current_period_end, trial_ends_at
  FROM customer_subscriptions WHERE customer_uid='CUS-513388';
SELECT id, status, starts_on, expires_on, custom_plan_id FROM enterprise_contracts WHERE customer_id=(SELECT id FROM customers WHERE customer_uid='CUS-513388');
SELECT id, email, name, role FROM users WHERE id=(SELECT user_id FROM customers WHERE customer_uid='CUS-513388') OR email LIKE '%513388%';
"
