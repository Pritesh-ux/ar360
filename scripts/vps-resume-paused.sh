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

mysql -h"$DB_HOST" -P"${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" --batch --raw <<'SQL'
UPDATE customer_subscriptions
   SET status = 'active',
       cancel_at_period_end = 0,
       cancelled_at = NULL,
       updated_at = NOW()
 WHERE status = 'paused'
   AND customer_uid IN ('CUS-800248', 'CUS-837156');

UPDATE customers c
   JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
   SET c.plan_id = s.plan_id,
       c.updated_at = NOW()
 WHERE s.customer_uid IN ('CUS-800248', 'CUS-837156');

SELECT customer_uid, plan_id, status, current_period_end, updated_at
FROM customer_subscriptions
WHERE customer_uid IN ('CUS-800248', 'CUS-837156');
SQL

echo RESUME_OK
