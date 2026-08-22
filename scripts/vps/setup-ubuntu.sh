#!/usr/bin/env bash
# AR360 Studio — Ubuntu 24 VPS bootstrap (run as root or with sudo)
set -euo pipefail

APP_USER="${APP_USER:-ar360}"
APP_DIR="${APP_DIR:-/opt/ar360}"
NODE_MAJOR="${NODE_MAJOR:-20}"

echo "=== AR360 VPS Setup ==="

apt-get update
apt-get install -y curl git nginx mysql-client redis-tools unzip

# Node.js ${NODE_MAJOR}.x via NodeSource
if ! command -v node &>/dev/null; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

# PM2
npm install -g pm2

# App user
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR/storage/Customers" "$APP_DIR/storage/private/object-capture" "$APP_DIR/backups"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo ""
echo "Next steps:"
echo "  1. Upload deploy.zip to $APP_DIR and extract"
echo "  2. Copy .env.example to .env and configure secrets"
echo "  3. npm ci --omit=dev"
echo "  4. npm run db:migrate"
echo "  5. pm2 start ecosystem.config.js"
echo "  6. pm2 save && pm2 startup"
echo "  7. Configure Nginx: scripts/vps/nginx-ar360.conf"
echo "  8. certbot --nginx -d yourdomain.com"
echo ""
echo "See docs/SERVER_SETUP.md for full guide."
