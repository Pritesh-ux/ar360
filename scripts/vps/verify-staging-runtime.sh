#!/bin/bash
# Post-swap staging runtime verification — staging VPS only.
# Aborts when deploy target, security bundle, or health checks fail.
set -euo pipefail

ROOT="/var/www/ar360-staging"
DEPLOY="$ROOT/deploy"
PM2_NAME="ar360-staging-web"
PORT="3001"
FORBIDDEN_ROOT="/var/www/ar360"

die() {
  echo "STAGING RUNTIME VERIFY FAILED: $*" >&2
  exit 1
}

case "$(realpath -m "$ROOT")" in
  "$FORBIDDEN_ROOT"|"$FORBIDDEN_ROOT"/*) die "ROOT under production path" ;;
esac

cd "$DEPLOY" || die "Missing deploy dir"
test -f server.js || die "Missing server.js"
test -f .env || die "Missing .env"
test -f ecosystem.staging.config.js || die "Missing ecosystem.staging.config.js"

grep -Eq '^[[:space:]]*AR360_DEPLOY_TARGET[[:space:]]*=[[:space:]]*staging[[:space:]]*$' .env \
  || die ".env must set AR360_DEPLOY_TARGET=staging"

SIGNUP_SERVER="$DEPLOY/.next/server"
test -d "$SIGNUP_SERVER" || die "Missing compiled .next/server"

grep -rq "staging_signup_blocked" "$SIGNUP_SERVER" \
  || die "Signup server bundle missing staging_signup_blocked guard (old build deployed?)"

grep -rq "STAGING_SIGNUP_DISABLED" "$SIGNUP_SERVER" \
  || die "Signup server bundle missing STAGING_SIGNUP_DISABLED handling"

# Ensure PM2 uses staging ecosystem (sets AR360_DEPLOY_TARGET=staging in process env).
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.staging.config.js --update-env
else
  pm2 start ecosystem.staging.config.js
fi
pm2 save >/dev/null 2>&1 || true

sleep 4

HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://127.0.0.1:${PORT}/api/health" || echo "000")
[ "$HEALTH_CODE" = "200" ] || die "/api/health returned $HEALTH_CODE"

READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://127.0.0.1:${PORT}/api/ready" || echo "000")
[ "$READY_CODE" = "200" ] || die "/api/ready returned $READY_CODE"

PM2_TARGET=$(pm2 jlist | node -e "
const apps = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const app = apps.find((a) => a.name === '$PM2_NAME');
if (!app) process.exit(2);
const env = { ...(app.pm2_env?.env || {}), ...(app.pm2_env || {}) };
process.stdout.write(String(env.AR360_DEPLOY_TARGET || ''));
")
[ "$PM2_TARGET" = "staging" ] || die "PM2 AR360_DEPLOY_TARGET='$PM2_TARGET' (expected staging)"

echo "STAGING_RUNTIME_OK deploy_target=staging health=$HEALTH_CODE ready=$READY_CODE pm2_target=$PM2_TARGET"
