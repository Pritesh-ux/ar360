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
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME" -N -B -e \
  "SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('customer_uid','customer_id') GROUP BY TABLE_NAME ORDER BY TABLE_NAME;"
