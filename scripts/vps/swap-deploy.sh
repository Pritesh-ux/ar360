#!/bin/bash
# Safe live swap for /var/www/ar360
# Preserves: .env, storage/, public/uploads/ (CMS + client logos)
# Uploads are MERGED (never replaced) so newly uploaded client logos survive deploys.
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
ROOT=/var/www/ar360
SHARED="$ROOT/shared"
TAR="$ROOT/deploy-new.tar"

cd "$ROOT"
test -f "$TAR"

mkdir -p "$SHARED/public/uploads"

# Seed shared uploads once from current live if missing content
if [ ! -d "$SHARED/public/uploads" ] || [ -z "$(ls -A "$SHARED/public/uploads" 2>/dev/null || true)" ]; then
  if [ -d "$ROOT/deploy/public/uploads" ]; then
    mkdir -p "$SHARED/public"
    rsync -a "$ROOT/deploy/public/uploads/" "$SHARED/public/uploads/"
  fi
fi

# Always pull any live-only uploads into shared before swap (logos uploaded after last deploy)
if [ -d "$ROOT/deploy/public/uploads" ]; then
  rsync -a "$ROOT/deploy/public/uploads/" "$SHARED/public/uploads/"
fi

rm -rf /tmp/ar360-unpack-*
mkdir -p "/tmp/ar360-unpack-$STAMP"
tar -xf "$TAR" -C "/tmp/ar360-unpack-$STAMP"
NEW="/tmp/ar360-unpack-$STAMP"

cp -a "$ROOT/deploy/.env" "$NEW/.env"
cp -a "$ROOT/deploy/.env" "$ROOT/deploy.env.backup-$STAMP"

# Preserve durable customer files
if [ -d "$ROOT/deploy/storage" ]; then
  rm -rf "$NEW/storage"
  cp -a "$ROOT/deploy/storage" "$NEW/storage"
fi

# Merge durable uploads into the new tree (do not wipe package uploads either)
mkdir -p "$NEW/public/uploads"
if [ -d "$SHARED/public/uploads" ]; then
  rsync -a "$SHARED/public/uploads/" "$NEW/public/uploads/"
fi
if [ -d "$ROOT/deploy/public/uploads" ]; then
  rsync -a "$ROOT/deploy/public/uploads/" "$NEW/public/uploads/"
fi

mv "$ROOT/deploy" "$ROOT/deploy-old-$STAMP"
mv "$NEW" "$ROOT/deploy"

# Keep shared mirror in sync with the live tree
mkdir -p "$SHARED/public/uploads"
rsync -a "$ROOT/deploy/public/uploads/" "$SHARED/public/uploads/"

cd "$ROOT/deploy"
test -f server.js
test -f .env
pm2 restart ar360-web --update-env
sleep 4
curl -s -o /dev/null -w "login=%{http_code}\n" --max-time 20 http://127.0.0.1:3000/login
echo "Done $STAMP"
