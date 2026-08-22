#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/ar360/deploy
get_env(){ grep -E "^$1=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//;"; }
DB_HOST=$(get_env MYSQL_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env MYSQL_PORT); DB_PORT=${DB_PORT:-3306}
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE); DB_NAME=${DB_NAME:-arstudio}
export MYSQL_PWD="$DB_PASS"
echo "=== customers ==="
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME" -e \
  "SELECT customer_uid, contact_name, email, company_name, plan_id, status FROM customers ORDER BY created_at;"
echo "=== count products per customer ==="
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME" -e \
  "SELECT c.email, c.customer_uid, COUNT(p.id) AS products FROM customers c LEFT JOIN products p ON p.customer_uid=c.customer_uid GROUP BY c.customer_uid, c.email;"
