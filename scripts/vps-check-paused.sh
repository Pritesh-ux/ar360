#!/bin/bash
set -euo pipefail
ENV_FILE=/var/www/ar360/deploy/.env

get_env() {
  local key="$1"
  awk -F= -v k="$key" '
    $1 == k {
      v=substr($0, index($0,"=")+1)
      gsub(/\r$/, "", v)
      if (v ~ /^".*"$/) { sub(/^"/,"",v); sub(/"$/,"",v) }
      if (v ~ /^'\''.*'\''$/) { sub(/^'\''/,"",v); sub(/'\''$/,"",v) }
      print v
      exit
    }
  ' "$ENV_FILE"
}

DB_HOST="$(get_env MYSQL_HOST)"
DB_PORT="$(get_env MYSQL_PORT)"
DB_USER="$(get_env MYSQL_USER)"
DB_PASSWORD="$(get_env MYSQL_PASSWORD)"
DB_NAME="$(get_env MYSQL_DATABASE)"

echo "host=$DB_HOST db=$DB_NAME user=$DB_USER"

mysql -h"$DB_HOST" -P"${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" --batch --raw -e \
  "SELECT customer_uid, plan_id, status, current_period_end, updated_at FROM customer_subscriptions WHERE status='paused' ORDER BY updated_at DESC LIMIT 20;"
