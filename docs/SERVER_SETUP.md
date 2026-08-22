# Server Setup — Ubuntu 24 VPS

Guide for deploying AR360 Studio with **Node.js, PM2, Nginx, MySQL, and optional Redis**.

## 1. Server requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

Object Capture workers need a separate machine or Docker profile with COLMAP/OpenMVS installed.

## 2. Bootstrap

```bash
sudo bash scripts/vps/setup-ubuntu.sh
```

Or manually:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx mysql-server redis-server
sudo npm install -g pm2
```

## 3. MySQL

```bash
sudo mysql_secure_installation

sudo mysql -e "CREATE DATABASE arstudio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'ar360'@'localhost' IDENTIFIED BY 'strong-password-here';"
sudo mysql -e "GRANT ALL PRIVILEGES ON arstudio.* TO 'ar360'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

### Database management UI

**Option A — Adminer (recommended, lightweight)**

```bash
sudo apt install -y adminer
# Enable in Apache or serve via Nginx location block
# Restrict access to your IP or VPN only
```

**Option B — phpMyAdmin**

```bash
sudo apt install -y phpmyadmin
# Select apache2 or configure Nginx + php-fpm
# IMPORTANT: restrict /phpmyadmin to internal IP or VPN
```

**Option C — CLI only**

```bash
mysql -u ar360 -p arstudio
npm run db:status    # from app directory
```

Never expose database admin UIs to the public internet without IP restriction.

## 4. Deploy application

On your **build machine**:

```bash
npm run deploy
# Produces deploy.zip (+ prefer: tar -cf deploy.tar -C deploy .)
```

On the **VPS** (safe swap — preserves `.env`, `storage/`, and `public/uploads/`):

```bash
# upload deploy-new.tar into /var/www/ar360 first
bash /var/www/ar360/deploy/scripts/vps/swap-deploy.sh
```

> **Never** unzip/tar over `deploy/` blindly. CMS landing images live in
> `public/uploads` and are wiped every bare extract. `swap-deploy.sh` also
> mirrors uploads to `/var/www/ar360/shared/public/uploads`.

Legacy first-time install:

```bash
sudo mkdir -p /opt/ar360
sudo chown $USER:$USER /opt/ar360
cd /opt/ar360
unzip deploy.zip

cp .env.example .env
nano .env   # configure all required variables

npm ci --omit=dev
npm run db:migrate

pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow printed command
```

## 5. Nginx + SSL

```bash
sudo cp scripts/vps/nginx-ar360.conf /etc/nginx/sites-available/ar360
sudo nano /etc/nginx/sites-available/ar360   # set server_name
sudo ln -sf /etc/nginx/sites-available/ar360 /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Set in `.env`:

```
NEXT_PUBLIC_APP_URL=https://yourdomain.com
AUTH_COOKIE_SECURE=true
```

## 6. Background workers (from source repo)

The `deploy.zip` contains the web app only. For billing webhooks and lifecycle emails, either:

**Docker Compose** (recommended): see [DEPLOY.md](DEPLOY.md)

**PM2 from full repo checkout:**

```bash
pm2 start ecosystem.vps.config.js
```

## 7. Redis (optional)

```bash
sudo apt install -y redis-server
# .env
REDIS_URL=redis://127.0.0.1:6379
JOB_QUEUE_BACKEND=redis
```

## 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

MySQL and Redis should **not** be exposed publicly.

## 9. Health checks

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/ready
```

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 Bad Gateway | Check `pm2 status`, app logs: `pm2 logs ar360-web` |
| DB connection refused | Verify `MYSQL_*` in `.env`, MySQL running |
| Cookies not persisting | Set `AUTH_COOKIE_SECURE=true` only on HTTPS |
| Assets 403 | Check subscription status, `ASSET_PROXY_ENFORCE` |
| Webhooks not processing | Start `ar360-webhook-worker`, verify `RAZORPAY_WEBHOOK_SECRET` |

See [BACKUP.md](BACKUP.md) and [RESTORE.md](RESTORE.md) for data operations.
