#!/bin/bash
set -euo pipefail
cd /var/www/ar360/deploy
U=$(grep -E '^MYSQL_USER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
P=$(grep -E '^MYSQL_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
D=$(grep -E '^MYSQL_DATABASE=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
EMAIL='dhaval.aksharwebtech@gmail.com'
TEMP_PASS='Ar360Temp#8261'

export TEMP_PASS
HASH=$(node <<'NODE'
const { randomBytes, scryptSync } = require('crypto');
const password = process.env.TEMP_PASS;
const salt = randomBytes(16).toString('base64url');
const hash = scryptSync(password, salt, 64).toString('base64url');
process.stdout.write(`scrypt:${salt}:${hash}`);
NODE
)

mysql -u "$U" "-p${P}" "$D" -e \
  "UPDATE users
      SET password_hash='${HASH}',
          session_version = session_version + 1,
          updated_at = NOW()
    WHERE LOWER(email)=LOWER('${EMAIL}')
    LIMIT 1;"

echo "=== verify new hash ==="
export CHECK_HASH
CHECK_HASH=$(mysql -u "$U" "-p${P}" "$D" -N -e "SELECT password_hash FROM users WHERE LOWER(email)=LOWER('${EMAIL}') LIMIT 1;")
export CHECK_PASS="$TEMP_PASS"
node <<'NODE'
const { scryptSync, timingSafeEqual } = require('crypto');
const parts = String(process.env.CHECK_HASH||'').split(':');
const actual = scryptSync(String(process.env.CHECK_PASS||''), parts[1], 64);
const expected = Buffer.from(parts[2], 'base64url');
console.log('verify_ok', actual.length === expected.length && timingSafeEqual(actual, expected));
NODE

mysql -u "$U" "-p${P}" "$D" -e \
  "UPDATE website_themes
      SET tokens = JSON_SET(
            CAST(tokens AS JSON),
            '$.primary', '#a9e20b',
            '$.accent', '#a9e20b'
          )
    WHERE is_active = 1;"

echo "=== active theme ==="
mysql -u "$U" "-p${P}" "$D" -N -e "SELECT JSON_EXTRACT(tokens,'$.primary'), JSON_EXTRACT(tokens,'$.accent') FROM website_themes WHERE is_active=1 LIMIT 1;"
echo "RESET_OK email=$EMAIL pass=$TEMP_PASS"
