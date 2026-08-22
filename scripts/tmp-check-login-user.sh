#!/bin/bash
set -euo pipefail
cd /var/www/ar360/deploy
U=$(grep -E '^MYSQL_USER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
P=$(grep -E '^MYSQL_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
D=$(grep -E '^MYSQL_DATABASE=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
EMAIL='dhaval.aksharwebtech@gmail.com'

echo "=== user row ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, user_uid, email, status, LEFT(password_hash,40) AS hash_prefix, CHAR_LENGTH(password_hash) AS hash_len, email_verified, two_factor_enabled, created_at, updated_at FROM users WHERE LOWER(email)=LOWER('${EMAIL}') LIMIT 5;"

echo "=== similar emails ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, email, status FROM users WHERE email LIKE '%dhaval%' OR email LIKE '%akshar%' LIMIT 20;"

echo "=== customer ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT u.id, u.email, u.status AS user_status, c.customer_uid, c.status AS customer_status FROM users u LEFT JOIN customers c ON c.owner_user_id = u.id WHERE LOWER(u.email)=LOWER('${EMAIL}') LIMIT 5;"

echo "=== login logs ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, email, status, reason, created_at FROM login_logs WHERE LOWER(email)=LOWER('${EMAIL}') ORDER BY id DESC LIMIT 15;" 2>/dev/null || echo "no login_logs"

echo "=== hash format samples ==="
mysql -u "$U" "-p${P}" "$D" -N -e "SELECT CONCAT(email,' | ',LEFT(password_hash,50),' | len=',CHAR_LENGTH(password_hash)) FROM users ORDER BY id DESC LIMIT 8;"

echo "=== failed login last 24h ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT status, reason, COUNT(*) c FROM login_logs WHERE created_at >= NOW() - INTERVAL 1 DAY GROUP BY status, reason ORDER BY c DESC;" 2>/dev/null || true

echo "=== theme tokens ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, is_active, LEFT(CAST(tokens AS CHAR),300) FROM website_themes ORDER BY id DESC LIMIT 3;" 2>/dev/null || true
