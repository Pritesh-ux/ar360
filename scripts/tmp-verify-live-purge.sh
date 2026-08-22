#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/ar360/deploy
KEEP_EMAILS="'asodariyasdesign@gmail.com','lapo3500@gmail.com'"
get_env(){ grep -E "^$1=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//;"; }
DB_HOST=$(get_env MYSQL_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env MYSQL_PORT); DB_PORT=${DB_PORT:-3306}
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE); DB_NAME=${DB_NAME:-arstudio}
export MYSQL_PWD="$DB_PASS"
MQ(){ mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME" "$@"; }

echo "=== users (non-admin) ==="
MQ -e "SELECT id, email, role, status FROM users ORDER BY id;"

echo "=== support_tickets ==="
MQ -e "SELECT id, ticket_uid, customer_uid, subject, status FROM support_tickets;" 2>/dev/null || MQ -e "DESCRIBE support_tickets; SELECT * FROM support_tickets LIMIT 5;"

echo "=== subscriptions ==="
MQ -e "SELECT customer_uid, plan_id, status FROM customer_subscriptions;"

echo "=== billing invoices count ==="
MQ -e "SELECT customer_uid, COUNT(*) n FROM billing_invoices GROUP BY customer_uid;"

echo "=== orphan products? ==="
MQ -e "SELECT p.customer_uid, p.id FROM products p LEFT JOIN customers c ON c.customer_uid=p.customer_uid WHERE c.customer_uid IS NULL;"

echo "=== enterprise contracts ==="
MQ -e "SELECT contract_uid, customer_id, status FROM enterprise_contracts;"
