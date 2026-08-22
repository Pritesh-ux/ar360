#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/ar360/deploy
KEEP="'asodariyasdesign@gmail.com','lapo3500@gmail.com'"
get_env(){ grep -E "^$1=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//;"; }
export MYSQL_PWD="$(get_env MYSQL_PASSWORD)"
DB=$(get_env MYSQL_DATABASE); DB=${DB:-arstudio}
U=$(get_env MYSQL_USER)
H=$(get_env MYSQL_HOST); H=${H:-127.0.0.1}
MQ(){ mysql -h"$H" -u"$U" "$DB" "$@"; }

echo "=== customers ==="
MQ -e "SELECT customer_uid, email FROM customers;"

echo "=== orphan customer_uid rows (sample) ==="
for t in products billing_invoices customer_subscriptions support_tickets object_capture_jobs workspaces share_links; do
  n=$(MQ -N -B -e "SELECT COUNT(*) FROM \`$t\` t LEFT JOIN customers c ON c.customer_uid=t.customer_uid WHERE c.customer_uid IS NULL;" 2>/dev/null || echo err)
  echo "$t orphans=$n"
done

echo "=== users not linked to keep customers / not admin ==="
MQ -e "SELECT u.id, u.email, u.role FROM users u
  LEFT JOIN customers c ON c.user_id=u.id
  WHERE c.customer_uid IS NULL AND LOWER(COALESCE(u.role,'')) NOT IN ('admin','master_admin','super_admin');" 2>/dev/null || true

echo "=== enterprise_requests emails ==="
MQ -e "SELECT DISTINCT business_email FROM enterprise_requests;"
