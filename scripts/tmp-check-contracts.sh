#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/ar360/deploy
get_env(){ grep -E "^$1=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//;"; }
export MYSQL_PWD="$(get_env MYSQL_PASSWORD)"
DB=$(get_env MYSQL_DATABASE); DB=${DB:-arstudio}
U=$(get_env MYSQL_USER)
H=$(get_env MYSQL_HOST); H=${H:-127.0.0.1}
mysql -h"$H" -u"$U" "$DB" -e "
SELECT id, customer_uid, email FROM customers;
SELECT ec.contract_uid, ec.customer_id, ec.status, c.email AS customer_email
  FROM enterprise_contracts ec
  LEFT JOIN customers c ON c.id = ec.customer_id;
SELECT COUNT(*) AS orphan_contracts FROM enterprise_contracts ec
  LEFT JOIN customers c ON c.id = ec.customer_id WHERE c.id IS NULL;
"
