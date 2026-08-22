#!/usr/bin/env bash
set -euo pipefail
echo "=== health ==="
curl -s -o /dev/null -w "health=%{http_code}\n" https://ar360studio.com/api/health
curl -s -o /dev/null -w "home=%{http_code}\n" https://ar360studio.com/
echo "=== build ==="
cat /var/www/ar360/deploy/.next/BUILD_ID
echo
echo "=== markers ==="
rg -l "subscriptionBypassEnabled|requireActiveSubscriptionApi|SUBSCRIPTION_LOCKED_ALLOWED|dropIfMissingInEngine" /var/www/ar360/deploy/.next -g "*.js" 2>/dev/null | head -8 || true
echo "=== pm2 ==="
pm2 show ar360-web | grep -E "status|uptime|script path|exec cwd" || true
echo "=== invoice_counters ==="
cd /var/www/ar360/deploy
set -a
# shellcheck disable=SC1091
. ./.env
set +a
mysql -h "${MYSQL_HOST:-127.0.0.1}" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" <<'SQL'
SHOW TABLE STATUS LIKE 'invoice_counters';
SET @engine := (
  SELECT ENGINE FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice_counters'
);
SET @drop := IF(@engine IS NULL,
  'DROP TABLE IF EXISTS invoice_counters',
  'SELECT 1');
PREPARE stmt FROM @drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS invoice_counters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  financial_year VARCHAR(16) NOT NULL UNIQUE,
  last_number INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CHECK TABLE invoice_counters;
SQL
echo DONE
