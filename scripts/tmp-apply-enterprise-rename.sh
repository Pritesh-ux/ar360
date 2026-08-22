#!/bin/bash
set -euo pipefail
APP=/var/www/ar360/deploy
get_env() { grep -E "^${1}=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//"; }
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE)
DB_NAME=${DB_NAME:-arstudio}
echo "=== Apply migration 62 ==="
mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /tmp/62_enterprise_display_name.sql
mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT id, name, tagline FROM billing_plans WHERE id='enterprise'; SELECT id, name FROM plans WHERE id='enterprise';"
echo DONE_RENAME
