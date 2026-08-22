#!/usr/bin/env bash
set -euo pipefail
cd /var/www/ar360/deploy

# Load DB creds from .env without sourcing the whole file (may have spaces/quotes).
get_env() {
  local key="$1"
  grep -E "^${key}=" .env | head -1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//'
}
DB_HOST=$(get_env DB_HOST)
DB_PORT=$(get_env DB_PORT)
DB_USER=$(get_env DB_USER)
DB_PASS=$(get_env DB_PASSWORD)
DB_NAME=$(get_env DB_NAME)
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}
DB_NAME=${DB_NAME:-arstudio}

MYSQL=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME")

echo "=== Seed popup text keys ==="
"${MYSQL[@]}" <<'SQL'
INSERT INTO website_settings (setting_key, setting_value) VALUES
  ('free_trial_popup_badge', 'Limited time offer'),
  ('free_trial_popup_title', 'Try *AR360* Studio\n*FREE* for 7 Days!'),
  ('free_trial_popup_description', 'Create immersive 3D and browser AR product experiences in minutes. *No credit card required.*'),
  ('free_trial_popup_primary_label', 'Start free trial'),
  ('free_trial_popup_secondary_label', 'See how it works'),
  ('free_trial_popup_scan_title', 'Scan to experience'),
  ('free_trial_popup_scan_note', 'Browser AR · No app')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

DELETE FROM website_settings
 WHERE setting_key IN ('free_trial_popup_desktop_image', 'free_trial_popup_mobile_image');

SELECT setting_key, REPLACE(REPLACE(setting_value, '\n', '\\n'), CHAR(10), '\\n') AS setting_value
  FROM website_settings
 WHERE setting_key LIKE 'free_trial_popup_%'
 ORDER BY setting_key;
SQL

# Fix title newline if MySQL stored literal \n instead of real newline
TITLE=$("${MYSQL[@]}" -N -e "SELECT setting_value FROM website_settings WHERE setting_key='free_trial_popup_title' LIMIT 1")
if printf '%s' "$TITLE" | grep -q '\\n'; then
  echo "=== Normalizing title newline ==="
  "${MYSQL[@]}" -e "UPDATE website_settings SET setting_value = 'Try *AR360* Studio\n*FREE* for 7 Days!' WHERE setting_key='free_trial_popup_title'"
fi

echo "=== Lifecycle drain ==="
# Mirror scripts/lifecycle-notification-loop.mjs
set -a
# shellcheck disable=SC1091
source /var/www/ar360/deploy/.env
set +a
BASE_URL="${APP_URL:-https://ar360studio.com}"
BASE_URL="${BASE_URL%/}"
SECRET="${INTERNAL_JOB_SECRET:-${CRON_SECRET:-}}"
HDR=(-H "Content-Type: application/json")
if [ -n "$SECRET" ]; then
  HDR+=(-H "x-ar360-internal-secret: $SECRET" -H "Authorization: Bearer $SECRET")
fi
curl -sS -X POST "${BASE_URL}/api/internal/lifecycle-notifications/run" "${HDR[@]}" -d '{}' | head -c 800
echo

echo "=== Curl checks ==="
for u in / /login /home/free-trial-ar-phone.png; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://ar360studio.com${u}")
  echo "$code $u"
done

echo "=== Cleanup old deploys (keep newest) ==="
cd /var/www/ar360
ls -1d deploy-old-* 2>/dev/null | sort | head -n -1 | while read -r d; do
  echo "removing $d"
  rm -rf "$d"
done
ls -1d deploy-old-* 2>/dev/null || true
df -h /
pm2 status
