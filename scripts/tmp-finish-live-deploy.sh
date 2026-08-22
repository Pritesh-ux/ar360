#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
BASE=/var/www/ar360
ZIP=$BASE/deploy.zip
TMP=$BASE/deploy-unpack-$STAMP
APP=$BASE/deploy
OLD=$BASE/deploy-old-$STAMP

echo "=== STAMP $STAMP ==="
test -f "$ZIP"
test -d "$APP"
test -f "$APP/.env"

EXISTING=$(ls -1d "$BASE"/deploy-unpack-* 2>/dev/null | sort | tail -1 || true)
if [ -n "${EXISTING:-}" ] && [ -f "$EXISTING/server.js" ] && [ -f "$EXISTING/package.json" ]; then
  echo "=== Reusing existing unpack: $EXISTING ==="
  TMP="$EXISTING"
  NEW="$TMP"
else
  rm -rf "$TMP"
  mkdir -p "$TMP"
  echo "=== Unzipping ==="
  set +e
  unzip -q "$ZIP" -d "$TMP"
  UNZIP_RC=$?
  set -e
  if [ "$UNZIP_RC" -gt 1 ]; then
    echo "unzip failed with code $UNZIP_RC"
    exit "$UNZIP_RC"
  fi

  if [ -f "$TMP/server.js" ] && [ -f "$TMP/package.json" ]; then
    NEW="$TMP"
  elif [ -f "$TMP/deploy/server.js" ]; then
    NEW="$TMP/deploy"
  else
    echo "Unexpected zip layout:"
    find "$TMP" -maxdepth 2 -type f | head -40
    exit 1
  fi
fi
echo "NEW root: $NEW"

echo "=== Preserving .env, storage, uploads ==="
cp -a "$APP/.env" "$NEW/.env"
if [ -d "$APP/storage" ]; then
  rm -rf "$NEW/storage"
  cp -a "$APP/storage" "$NEW/storage"
fi
mkdir -p "$NEW/public"
if [ -d "$APP/public/uploads" ]; then
  rm -rf "$NEW/public/uploads"
  cp -a "$APP/public/uploads" "$NEW/public/uploads"
fi
if [ -d "$APP/public/home" ]; then
  mkdir -p "$NEW/public/home"
  cp -an "$APP/public/home/." "$NEW/public/home/" 2>/dev/null || true
fi

echo "=== Swap ==="
mv "$APP" "$OLD"
mv "$NEW" "$APP"

get_env() {
  local key="$1"
  grep -E "^${key}=" "$APP/.env" | head -1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//'
}

DB_HOST=$(get_env MYSQL_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env MYSQL_PORT); DB_PORT=${DB_PORT:-3306}
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE); DB_NAME=${DB_NAME:-arstudio}

if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
  echo "Missing MYSQL_USER/MYSQL_PASSWORD in .env"
  exit 1
fi

echo "=== Seed free-trial popup text keys (${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}) ==="
MYSQL=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME")
"${MYSQL[@]}" <<'SQL'
INSERT INTO website_settings (setting_key, setting_value) VALUES
  ('free_trial_popup_badge', 'Limited time offer'),
  ('free_trial_popup_title', CONCAT('Try *AR360* Studio', CHAR(10), '*FREE* for 7 Days!')),
  ('free_trial_popup_description', 'Create immersive 3D and browser AR product experiences in minutes. *No credit card required.*'),
  ('free_trial_popup_primary_label', 'Start free trial'),
  ('free_trial_popup_secondary_label', 'See how it works'),
  ('free_trial_popup_scan_title', 'Scan to experience'),
  ('free_trial_popup_scan_note', 'Browser AR · No app')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

DELETE FROM website_settings
 WHERE setting_key IN ('free_trial_popup_desktop_image', 'free_trial_popup_mobile_image');

SELECT setting_key,
       REPLACE(REPLACE(setting_value, CHAR(10), '\\n'), CHAR(13), '') AS setting_value
  FROM website_settings
 WHERE setting_key LIKE 'free_trial_popup_%'
 ORDER BY setting_key;
SQL

echo "=== PM2 restart web + start lifecycle-email ==="
cd "$APP"
pm2 delete ar360-web >/dev/null 2>&1 || true
pm2 start "$APP/ecosystem.config.js" --only ar360-web

pm2 delete ar360-lifecycle-email >/dev/null 2>&1 || true
if [ -f "$APP/scripts/lifecycle-notification-loop.mjs" ]; then
  pm2 start node --name ar360-lifecycle-email --cwd "$APP" -- scripts/lifecycle-notification-loop.mjs
fi

# Keep existing workers on build-mobile; just bounce them so they reconnect cleanly.
pm2 restart ar360-webhook-worker ar360-reconciliation-worker || true
pm2 save || true
pm2 status

echo "=== Lifecycle drain (best effort) ==="
set +e
APP_URL=$(get_env APP_URL); APP_URL=${APP_URL:-https://ar360studio.com}
APP_URL=${APP_URL%/}
SECRET=$(get_env INTERNAL_JOB_SECRET)
if [ -z "$SECRET" ]; then SECRET=$(get_env CRON_SECRET); fi
if [ -n "$SECRET" ]; then
  curl -sS -X POST "${APP_URL}/api/internal/lifecycle-notifications/run" \
    -H "Content-Type: application/json" \
    -H "x-ar360-internal-secret: ${SECRET}" \
    -H "Authorization: Bearer ${SECRET}" \
    -d '{}' | head -c 800
  echo
else
  echo "No INTERNAL_JOB_SECRET/CRON_SECRET — skip drain"
fi
set -e

sleep 3
echo "=== Curl checks ==="
for u in / /login /home/free-trial-ar-phone.png; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://ar360studio.com${u}" || echo fail)
  echo "$code $u"
done

echo "=== Cleanup old deploys (keep newest) ==="
cd "$BASE"
ls -1d deploy-old-* 2>/dev/null | sort | head -n -1 | while read -r d; do
  echo "removing $d"
  rm -rf "$d"
done
ls -1d deploy-unpack-* 2>/dev/null | while read -r d; do
  if [ "$d" = "$BASE/deploy" ] || [ "$d" = "deploy" ]; then continue; fi
  echo "removing leftover $d"
  rm -rf "$d"
done || true

ls -1d deploy-old-* 2>/dev/null || true
df -h /
echo "BUILD=$(cat "$APP/.next/BUILD_ID")"
echo "=== DONE ==="
