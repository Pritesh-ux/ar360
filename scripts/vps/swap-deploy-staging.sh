#!/bin/bash
# Safe live swap for STAGING ONLY: /var/www/ar360-staging
# Preserves: .env, storage/, public/uploads/ under the staging root.
# NEVER targets /var/www/ar360 or PM2 process ar360-web.
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
ROOT="/var/www/ar360-staging"
SHARED="$ROOT/shared"
TAR="$ROOT/deploy-new.tar"
PM2_NAME="ar360-staging-web"
HEALTH_PORT="3001"
FORBIDDEN_ROOT="/var/www/ar360"
FORBIDDEN_PM2="ar360-web"

die() {
  echo "STAGING SWAP ABORTED: $*" >&2
  exit 1
}

# --- Hard safety: refuse production targets ---
RESOLVED_ROOT="$(realpath -m "$ROOT")"
if [ "$RESOLVED_ROOT" = "$FORBIDDEN_ROOT" ]; then
  die "ROOT resolves to production path $FORBIDDEN_ROOT"
fi
case "$RESOLVED_ROOT" in
  "$FORBIDDEN_ROOT"|"$FORBIDDEN_ROOT"/*)
    die "ROOT '$RESOLVED_ROOT' is under production path $FORBIDDEN_ROOT"
    ;;
esac
if [ "$ROOT" = "$FORBIDDEN_ROOT" ] || [ "$ROOT" = "${FORBIDDEN_ROOT}/" ]; then
  die "ROOT must not be $FORBIDDEN_ROOT"
fi
if [ "$PM2_NAME" = "$FORBIDDEN_PM2" ]; then
  die "PM2 name must not be $FORBIDDEN_PM2"
fi
if [ "$HEALTH_PORT" = "3000" ]; then
  die "Staging health port must not be production port 3000"
fi

# Optional overrides still cannot point at production
if [ -n "${VPS_DIR:-}" ]; then
  VPS_RESOLVED="$(realpath -m "$VPS_DIR")"
  if [ "$VPS_RESOLVED" = "$FORBIDDEN_ROOT" ] || [[ "$VPS_RESOLVED" == "$FORBIDDEN_ROOT"/* ]]; then
    die "VPS_DIR='$VPS_DIR' targets production"
  fi
  if [ "$VPS_RESOLVED" != "$RESOLVED_ROOT" ]; then
    die "VPS_DIR='$VPS_DIR' does not match staging ROOT $ROOT"
  fi
fi
if [ -n "${VPS_PM2_NAME:-}" ] && [ "$VPS_PM2_NAME" = "$FORBIDDEN_PM2" ]; then
  die "VPS_PM2_NAME=$FORBIDDEN_PM2 is forbidden for staging"
fi
if [ -n "${VPS_PM2_NAME:-}" ] && [ "$VPS_PM2_NAME" != "$PM2_NAME" ]; then
  die "VPS_PM2_NAME='$VPS_PM2_NAME' must be $PM2_NAME"
fi

cd "$ROOT" || die "Cannot cd to $ROOT"
test -f "$TAR" || die "Missing $TAR"

mkdir -p "$SHARED/public/uploads"

if [ ! -d "$SHARED/public/uploads" ] || [ -z "$(ls -A "$SHARED/public/uploads" 2>/dev/null || true)" ]; then
  if [ -d "$ROOT/deploy/public/uploads" ]; then
    mkdir -p "$SHARED/public"
    rsync -a "$ROOT/deploy/public/uploads/" "$SHARED/public/uploads/"
  fi
fi

if [ -d "$ROOT/deploy/public/uploads" ]; then
  rsync -a "$ROOT/deploy/public/uploads/" "$SHARED/public/uploads/"
fi

# Staging-only unpack dir (do not use /tmp/ar360-unpack-* used by production)
rm -rf /tmp/ar360-staging-unpack-*
mkdir -p "/tmp/ar360-staging-unpack-$STAMP"
tar -xf "$TAR" -C "/tmp/ar360-staging-unpack-$STAMP"
NEW="/tmp/ar360-staging-unpack-$STAMP"

test -f "$ROOT/deploy/.env" || die "Missing $ROOT/deploy/.env — bootstrap staging .env before swap"
cp -a "$ROOT/deploy/.env" "$NEW/.env"
cp -a "$ROOT/deploy/.env" "$ROOT/deploy.env.backup-$STAMP"

# Refuse production-like env on staging
ENV_FILE="$NEW/.env"
grep -Eq '^[[:space:]]*AR360_DEPLOY_TARGET[[:space:]]*=[[:space:]]*staging[[:space:]]*$' "$ENV_FILE" \
  || die ".env must set AR360_DEPLOY_TARGET=staging"
if grep -Eq '^[[:space:]]*AR360_DEPLOY_TARGET[[:space:]]*=[[:space:]]*production[[:space:]]*$' "$ENV_FILE"; then
  die ".env sets AR360_DEPLOY_TARGET=production"
fi
if grep -Eq '^[[:space:]]*MYSQL_DATABASE[[:space:]]*=[[:space:]]*arstudio[[:space:]]*$' "$ENV_FILE"; then
  die "MYSQL_DATABASE=arstudio looks like production — use arstudio_staging (or another non-prod DB)"
fi
if grep -Eq '^[[:space:]]*RAZORPAY_MODE[[:space:]]*=[[:space:]]*live[[:space:]]*$' "$ENV_FILE"; then
  die "RAZORPAY_MODE=live is forbidden on staging"
fi
if grep -Eq '^[[:space:]]*PORT[[:space:]]*=[[:space:]]*3000[[:space:]]*$' "$ENV_FILE"; then
  die "PORT=3000 in staging .env is forbidden (use 3001)"
fi

if [ -d "$ROOT/deploy/storage" ]; then
  rm -rf "$NEW/storage"
  cp -a "$ROOT/deploy/storage" "$NEW/storage"
fi

mkdir -p "$NEW/public/uploads"
if [ -d "$SHARED/public/uploads" ]; then
  rsync -a "$SHARED/public/uploads/" "$NEW/public/uploads/"
fi
if [ -d "$ROOT/deploy/public/uploads" ]; then
  rsync -a "$ROOT/deploy/public/uploads/" "$NEW/public/uploads/"
fi

# Final path check before swap
case "$(realpath -m "$NEW")" in
  "$FORBIDDEN_ROOT"|"$FORBIDDEN_ROOT"/*)
    die "Unpack path unexpectedly under production root"
    ;;
esac

mv "$ROOT/deploy" "$ROOT/deploy-old-$STAMP"
mv "$NEW" "$ROOT/deploy"

mkdir -p "$SHARED/public/uploads"
rsync -a "$ROOT/deploy/public/uploads/" "$SHARED/public/uploads/"

cd "$ROOT/deploy"
test -f server.js || die "Missing server.js after swap"
test -f .env || die "Missing .env after swap"

# Never restart production PM2 name
if [ "$PM2_NAME" = "$FORBIDDEN_PM2" ]; then
  die "Refusing to restart $FORBIDDEN_PM2"
fi

pm2 restart "$PM2_NAME" --update-env
sleep 4
curl -s -o /dev/null -w "login=%{http_code}\n" --max-time 20 "http://127.0.0.1:${HEALTH_PORT}/login"
echo "Staging swap done $STAMP (root=$ROOT pm2=$PM2_NAME port=$HEALTH_PORT)"
