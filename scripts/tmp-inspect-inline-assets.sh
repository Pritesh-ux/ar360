#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/ar360/deploy

get_env() {
  grep -E "^${1}=" "$APP/.env" | head -1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//'
}

DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE); DB_NAME=${DB_NAME:-arstudio}
DB_HOST=$(get_env MYSQL_HOST); DB_HOST=${DB_HOST:-127.0.0.1}

mysql -h "$DB_HOST" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME" <<'SQL' 2>/dev/null
SELECT COUNT(*) AS total,
       SUM(poster LIKE 'data:%') AS inline_poster,
       SUM(thumbnail_url LIKE 'data:%') AS inline_thumb,
       SUM(CAST(variants AS CHAR) LIKE '%data:image%') AS inline_variants,
       MAX(LENGTH(poster)) AS max_poster_len,
       MAX(LENGTH(CAST(variants AS CHAR))) AS max_variants_len
  FROM products
 WHERE deleted_at IS NULL;

SELECT id, customer_uid, LENGTH(poster) AS poster_len,
       LENGTH(CAST(variants AS CHAR)) AS variants_len, updated_at
  FROM products
 WHERE deleted_at IS NULL
 ORDER BY poster_len DESC
 LIMIT 10;
SQL
