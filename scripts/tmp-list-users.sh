#!/bin/bash
set -euo pipefail
cd /var/www/ar360/deploy
U=$(grep -E '^MYSQL_USER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
P=$(grep -E '^MYSQL_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
D=$(grep -E '^MYSQL_DATABASE=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

echo "=== all users ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, email, status, updated_at, last_login_at FROM users ORDER BY id;"

echo "=== customers linked ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, user_id, customer_uid, email, status, plan_id FROM customers ORDER BY id;"

echo "=== password reset tokens ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, email, used_at, expires_at, created_at FROM password_reset_tokens ORDER BY id DESC LIMIT 15;" 2>/dev/null || echo none
