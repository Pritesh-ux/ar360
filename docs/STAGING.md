# AR360 Studio — Staging Environment

> Isolated preview environment. **Never** deploy staging artifacts to `/var/www/ar360` or restart `ar360-web`.

Related: [DEPLOY.md](DEPLOY.md) · [SERVER_SETUP.md](SERVER_SETUP.md) · [ENVIRONMENT.md](ENVIRONMENT.md)

## Goals

```
feature/* → staging → Staging VPS → verify → approve → master → Production VPS
```

| | Production | Staging |
|---|------------|---------|
| Root | `/var/www/ar360` | `/var/www/ar360-staging` |
| App | `/var/www/ar360/deploy` | `/var/www/ar360-staging/deploy` |
| PM2 | `ar360-web` | `ar360-staging-web` |
| Port | `3000` | `3001` |
| Swap script | `scripts/vps/swap-deploy.sh` | `scripts/vps/swap-deploy-staging.sh` |
| Nginx | `nginx-ar360.conf` | `nginx-ar360-staging.conf` |
| Env template | `.env.example` | `.env.staging.example` |
| Database | `arstudio` (prod) | `arstudio_staging` (or other non-prod name) |

## Safety guards

Staging swap/deploy **abort** if:

- Target directory is `/var/www/ar360` (or under it)
- PM2 name is `ar360-web`
- Staging `.env` lacks `AR360_DEPLOY_TARGET=staging`
- `.env` has `MYSQL_DATABASE=arstudio` (production default name)
- `.env` has `RAZORPAY_MODE=live`
- `.env` has `PORT=3000`

## One-time staging VPS setup (do not run from this doc automatically)

Commands are listed for operators. Execute only on the intended staging host.

### 1. Directories

```bash
sudo mkdir -p /var/www/ar360-staging/shared/public/uploads
sudo mkdir -p /var/www/ar360-staging/deploy
sudo chown -R "$USER:$USER" /var/www/ar360-staging
```

### 2. MySQL (separate database)

```bash
sudo mysql -e "CREATE DATABASE arstudio_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'ar360_staging'@'localhost' IDENTIFIED BY 'strong-staging-password-here';"
sudo mysql -e "GRANT ALL PRIVILEGES ON arstudio_staging.* TO 'ar360_staging'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

### 3. Bootstrap first app tree

On a build machine (from Git branch `staging`):

```bash
git checkout staging
npm ci
npm run deploy -- --skip-migrate
tar -cf deploy-new.tar -C deploy .
scp deploy-new.tar USER@STAGING_HOST:/var/www/ar360-staging/deploy-new.tar
```

On the staging VPS (first extract only):

```bash
cd /var/www/ar360-staging
mkdir -p /tmp/ar360-staging-bootstrap
tar -xf deploy-new.tar -C /tmp/ar360-staging-bootstrap
rm -rf deploy
mv /tmp/ar360-staging-bootstrap deploy
cp deploy/.env.staging.example deploy/.env   # if packed; else copy from repo
# OR: upload .env.staging.example and copy to deploy/.env
nano deploy/.env   # set secrets, AR360_DEPLOY_TARGET=staging, DB=arstudio_staging, PORT=3001, Razorpay TEST
```

Ensure `ecosystem.staging.config.js` is present in `deploy/` (included by the deploy pack).

### 4. Migrations (staging DB only)

```bash
cd /var/www/ar360-staging/deploy
# Use a Node environment that can run migrations against staging MySQL.
# Prefer running migrations from a full repo checkout with staging .env loaded,
# or install tsx and run: npm run db:migrate with MYSQL_* pointing at arstudio_staging.
```

Do **not** point migration commands at the production database.

### 5. PM2 (staging process only)

```bash
cd /var/www/ar360-staging/deploy
pm2 start ecosystem.staging.config.js
pm2 save
```

Confirm `pm2 list` shows `ar360-staging-web` and does **not** alter `ar360-web`.

### 6. Nginx + TLS

```bash
sudo cp /path/to/repo/scripts/vps/nginx-ar360-staging.conf /etc/nginx/sites-available/ar360-staging
sudo nano /etc/nginx/sites-available/ar360-staging   # set staging.yourdomain.com
sudo ln -sf /etc/nginx/sites-available/ar360-staging /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging.yourdomain.com
```

### 7. Health checks

```bash
curl -sS http://127.0.0.1:3001/api/health
curl -sS http://127.0.0.1:3001/api/ready
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/login
```

## Subsequent staging deploys

### Option A — helper script (from laptop)

In `.env.local` (local only, never commit):

```bash
AR360_DEPLOY_TARGET=staging
VPS_STAGING_HOST=your-staging-host
VPS_STAGING_USER=your-user
VPS_STAGING_DIR=/var/www/ar360-staging
VPS_STAGING_PM2_NAME=ar360-staging-web
# VPS_STAGING_SSH_KEY_PATH=...
```

Then:

```bash
git checkout staging
npm run deploy:vps:staging
```

The helper **refuses** `/var/www/ar360` and `ar360-web`.

### Option B — manual

```bash
git checkout staging
npm run deploy -- --skip-migrate
tar -cf deploy-new.tar -C deploy .
scp deploy-new.tar USER@HOST:/var/www/ar360-staging/deploy-new.tar
ssh USER@HOST 'bash /var/www/ar360-staging/deploy/scripts/vps/swap-deploy-staging.sh'
```

## Rollback (staging only)

```bash
pm2 stop ar360-staging-web
# pick a deploy-old-* under /var/www/ar360-staging
mv /var/www/ar360-staging/deploy /var/www/ar360-staging/deploy.failed
mv /var/www/ar360-staging/deploy-old-YYYYMMDD-HHMMSS /var/www/ar360-staging/deploy
pm2 start ar360-staging-web --update-env
```

## Production must stay untouched

- Do not run `scripts/vps/swap-deploy.sh` for staging work.
- Do not set `VPS_DIR=/var/www/ar360` when using staging helpers.
- Do not restart `ar360-web` as part of staging deploys.
- Promote to production only via `master` + the existing production deploy path.
