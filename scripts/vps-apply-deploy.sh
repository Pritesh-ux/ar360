#!/bin/bash
set -euo pipefail

APP=/var/www/ar360/deploy
TAR=/tmp/ar360-deploy.tar
NEW=/tmp/ar360-new
ENV_BAK=/tmp/ar360-env.bak
STORAGE_BAK=/tmp/ar360-storage.bak
UPLOADS_BAK=/tmp/ar360-uploads.bak

if [ ! -f "$TAR" ]; then
  echo "Missing $TAR"
  exit 1
fi

rm -rf "$NEW"
mkdir -p "$NEW"
tar -xf "$TAR" -C "$NEW"

if [ -f "$APP/.env" ]; then
  cp "$APP/.env" "$ENV_BAK"
fi
if [ -d "$APP/storage" ]; then
  rm -rf "$STORAGE_BAK"
  mv "$APP/storage" "$STORAGE_BAK"
fi
if [ -d "$APP/public/uploads" ]; then
  rm -rf "$UPLOADS_BAK"
  mv "$APP/public/uploads" "$UPLOADS_BAK"
fi

rm -rf "$APP"
mkdir -p "$APP"
cp -a "$NEW"/. "$APP"/

if [ -f "$ENV_BAK" ]; then
  cp "$ENV_BAK" "$APP/.env"
fi
if [ -d "$STORAGE_BAK" ]; then
  rm -rf "$APP/storage"
  mv "$STORAGE_BAK" "$APP/storage"
fi
if [ -d "$UPLOADS_BAK" ]; then
  mkdir -p "$APP/public"
  rm -rf "$APP/public/uploads"
  mv "$UPLOADS_BAK" "$APP/public/uploads"
fi

cd "$APP"

# Native image tooling (sharp) is platform-specific and is kept outside the
# Windows-built standalone trace, so install the Linux build on the VPS.
npm install --no-save --omit=dev --no-audit --no-fund \
  sharp@0.35.3 \
  @gltf-transform/core@4.4.2 \
  @gltf-transform/extensions@4.4.2 \
  @gltf-transform/functions@4.4.2

if [ -f "$APP/scripts/db-migrate.ts" ]; then
  echo "=== Running database migrations ==="
  npx --yes tsx scripts/db-migrate.ts
fi

pm2 restart ar360-web --update-env
pm2 status ar360-web

rm -f "$TAR"
rm -rf "$NEW" "$ENV_BAK"
echo DEPLOY_OK
