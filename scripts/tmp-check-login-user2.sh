#!/bin/bash
set -euo pipefail
cd /var/www/ar360/deploy
U=$(grep -E '^MYSQL_USER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
P=$(grep -E '^MYSQL_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
D=$(grep -E '^MYSQL_DATABASE=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
EMAIL='dhaval.aksharwebtech@gmail.com'

echo "=== customer tables cols ==="
mysql -u "$U" "-p${P}" "$D" -N -e "SHOW COLUMNS FROM customers;" | awk '{print $1}' | head -40

echo "=== user customer uid ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, email, status, customer_uid FROM users WHERE id=4\G" 2>/dev/null \
  || mysql -u "$U" "-p${P}" "$D" -e "SHOW COLUMNS FROM users;" | head -40

echo "=== login logs ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, email, status, reason, created_at FROM login_logs WHERE LOWER(email)=LOWER('${EMAIL}') ORDER BY id DESC LIMIT 20;" 2>/dev/null || echo "no login_logs"

echo "=== failed login last 24h ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT status, reason, COUNT(*) c FROM login_logs WHERE created_at >= NOW() - INTERVAL 1 DAY GROUP BY status, reason ORDER BY c DESC;" 2>/dev/null || true

echo "=== hash formats overall ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT CASE WHEN password_hash LIKE 'scrypt:%' THEN 'scrypt' WHEN password_hash LIKE '\$2%' THEN 'bcrypt' ELSE 'other' END AS kind, COUNT(*) c FROM users GROUP BY kind;"

echo "=== verify password against stored hash ==="
HASH=$(mysql -u "$U" "-p${P}" "$D" -N -e "SELECT password_hash FROM users WHERE id=4 LIMIT 1;")
export CHECK_HASH="$HASH"
export CHECK_PASS='TkJv23HFYSyfs9h'
node <<'NODE'
const { scryptSync, timingSafeEqual } = require('crypto');
const stored = process.env.CHECK_HASH || '';
const password = process.env.CHECK_PASS || '';
const parts = stored.split(':');
console.log('parts', parts.length, 'algo', parts[0], 'saltLen', (parts[1]||'').length, 'hashLen', (parts[2]||'').length);
try {
  const salt = parts[1];
  const hash = parts[2];
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'base64url');
  const ok = actual.length === expected.length && timingSafeEqual(actual, expected);
  console.log('verify_ok', ok, 'actualLen', actual.length, 'expectedLen', expected.length);
} catch (e) {
  console.log('verify_error', e.message);
}
NODE

echo "=== theme tokens ==="
mysql -u "$U" "-p${P}" "$D" -e "SELECT id, is_active, LEFT(CAST(tokens AS CHAR),400) AS tokens FROM website_themes ORDER BY id DESC LIMIT 3;" 2>/dev/null || true
