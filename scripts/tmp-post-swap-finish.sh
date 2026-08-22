#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/ar360/deploy
cd "$APP"

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

echo "=== DB target ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} ==="
MYSQL=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME")

echo "=== Seed free-trial popup text keys ==="
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

echo "=== Ensure ecosystem.vps.config.js ==="
if [ ! -f "$APP/ecosystem.vps.config.js" ]; then
  for old in /var/www/ar360/deploy-old-*/ecosystem.vps.config.js; do
    if [ -f "$old" ]; then
      cp -a "$old" "$APP/ecosystem.vps.config.js"
      echo "copied $old"
      break
    fi
  done
fi
ls -la "$APP"/ecosystem*.js

ECO=
if [ -f "$APP/ecosystem.vps.config.js" ]; then ECO="$APP/ecosystem.vps.config.js"
elif [ -f "$APP/ecosystem.config.js" ]; then ECO="$APP/ecosystem.config.js"
fi
echo "Using $ECO"
test -n "$ECO"

echo "=== PM2 restart ==="
pm2 delete ar360-web ar360-webhook-worker ar360-reconciliation-worker ar360-lifecycle-email >/dev/null 2>&1 || true
pm2 start "$ECO" --only ar360-web
pm2 start "$ECO" --only ar360-webhook-worker || true
pm2 start "$ECO" --only ar360-reconciliation-worker || true
pm2 start "$ECO" --only ar360-lifecycle-email || true
pm2 save || true
pm2 status

echo "=== Lifecycle drain ==="
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
  echo "No secret — skip"
fi
set -e

sleep 2
echo "=== Curl checks ==="
for u in / /login /home/free-trial-ar-phone.png; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://ar360studio.com${u}" || echo fail)
  echo "$code $u"
done

echo "=== Cleanup old deploys keep newest ==="
cd /var/www/ar360
ls -1d deploy-old-* 2>/dev/null | sort | head -n -1 | while read -r d; do
  echo "removing $d"; rm -rf "$d"
done
ls -1d deploy-old-* 2>/dev/null || true
df -h /
echo "BUILD=$(cat $APP/.next/BUILD_ID)"
echo "=== DONE ==="
