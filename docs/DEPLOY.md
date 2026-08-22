# AR360 Studio — Production Deploy Guide

> See also: [README.md](../README.md) · [ENVIRONMENT.md](ENVIRONMENT.md) · [SERVER_SETUP.md](SERVER_SETUP.md) · [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)

## One-command deploy (VPS / build machine)

```bash
npm run deploy
```

Pipeline: `npm ci` → typecheck → lint → unit tests → security audit → build → pack → **deploy.zip**

Pack only (after build):

```bash
npm run deploy:pack
```

Upload `deploy.zip` to your server — see [SERVER_SETUP.md](SERVER_SETUP.md).

---

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Set required secrets in `.env`:
   - `AUTH_SECRET` (32+ random characters)
   - `WORKER_SECRET` (32+ random characters)
   - `NEXT_PUBLIC_APP_URL` (your public HTTPS URL)
   - `AUTH_COOKIE_SECURE=true` on HTTPS
3. Build and start:
   ```bash
   docker compose --profile setup run --rm migrate
   docker compose up -d --build
   ```
4. Seed demo accounts (optional, local/staging only):
   ```bash
   docker compose exec app npm run auth:seed
   ```

Services:
- **app** — Next.js on port 3000
- **mysql** — MySQL 8.4
- **redis** — Redis 7 (rate limits + optional job queue)
- **oc-worker** — native COLMAP/OpenMVS/Blender reconstruction worker
- **oc-cleanup** — retention cleanup loop for private capture workspaces
- **migrate** — one-shot migrations (`--profile setup`)
- **minio** — local S3-compatible storage (`--profile s3`)

### Object Capture deployment

Object Capture reconstruction is isolated in `Dockerfile.oc-worker`. Its pinned
COLMAP, OpenMVS, and Blender toolchain is not installed in the web image. The
`app`, `oc-worker`, and `oc-cleanup` services share the durable
`object_capture_storage` named volume at
`/app/storage/private/object-capture`. Keep `APP_UID` and `APP_GID` aligned
(defaults: `1001:1001`) so both containers can access it.

Apply migrations before starting the worker, then verify readiness:

```bash
docker compose --profile setup run --rm migrate
docker compose run --rm oc-worker npm run readiness:oc
docker compose up -d --build
```

The worker readiness check verifies every reconstruction executable, workspace
read/write access, and migration state. It prints variable names and corrective
commands, but never prints database passwords, processor secrets, or connection
URLs. Configure lease and timeout behavior with `OC_LEASE_SECONDS`,
`OC_HEARTBEAT_MS`, `OC_STAGE_TIMEOUT_MS`, and `OC_GLOBAL_TIMEOUT_MS`.
Cleanup cadence and retention use `OC_CLEANUP_INTERVAL_MS` and the
`OC_*_RETENTION_*` variables documented in `.env.example`.

On a standalone Windows installation, set a persistent private directory and
run readiness before launching workers:

```powershell
$env:OBJECT_CAPTURE_STORAGE_ROOT = "C:\ar360-data\object-capture"
npm run readiness:oc:windows
npm run worker:oc
```

Set the `*_PATH` variables in `.env.local` when binaries are not on `PATH`.
The standalone launcher defaults Object Capture storage to
`storage/private/object-capture` at the project root; it never uses
`.next/standalone` or `public/` as a fallback. Do not grant IIS/Apache static
access to this directory.

---

## Docker with Redis job queue

```bash
# .env
JOB_QUEUE_BACKEND=redis
REDIS_URL=redis://redis:6379

docker compose up -d --build
```

Workers claim jobs from Redis lists; MySQL remains the source of truth for job status.

---

## Docker with S3 storage (MinIO local)

```bash
# .env
STORAGE_BACKEND=s3
AWS_S3_BUCKET=ar360
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minio
AWS_SECRET_ACCESS_KEY=minio123456
AWS_ENDPOINT_URL=http://minio:9000
AWS_S3_FORCE_PATH_STYLE=true

docker compose --profile s3 up -d --build
```

MinIO console: http://localhost:9001

Production: use real AWS S3 or Cloudflare R2 — set `AWS_S3_BUCKET`, `AWS_REGION`, and IAM credentials (omit `AWS_ENDPOINT_URL`).

---

## VPS checklist (without Docker)

| Step | Command / note |
|------|----------------|
| Node.js 20+ | Required |
| MySQL 8+ | Create database `arstudio` |
| Redis 7+ | Optional — rate limits + job queue |
| Migrations | `npm run db:migrate` |
| Build | `npm run build` |
| Start | `npm run start` (use PM2/systemd) |
| Storage | `storage/Customers/` writable by app user |
| HTTPS | Nginx/Caddy reverse proxy + TLS |
| Cookies | `AUTH_COOKIE_SECURE=true` |
| DDL | `SKIP_RUNTIME_DDL=true` after migrations |
| Worker | `npm run worker:oc` as cron or systemd unit |

---

## Required environment variables

| Variable | Production |
|----------|------------|
| `AUTH_SECRET` | Required (32+ chars) |
| `WORKER_SECRET` | Required |
| `MYSQL_*` | Required |
| `NEXT_PUBLIC_APP_URL` | Required (HTTPS URL) |
| `AUTH_COOKIE_SECURE` | `true` on HTTPS |
| `SKIP_RUNTIME_DDL` | `true` |
| `ASSET_PROXY_ENFORCE` | `true` |
| `SMTP_*` | Required for password reset emails |

Optional:
- `STORAGE_BACKEND=s3` + `AWS_S3_BUCKET` for cloud storage
- `AWS_ENDPOINT_URL` + `AWS_S3_FORCE_PATH_STYLE=true` for MinIO
- `ASSET_CDN_BASE` for CloudFront/CDN
- `REDIS_URL` — distributed rate limiting
- `JOB_QUEUE_BACKEND=redis` — Redis-backed OC worker queue
- `SMOKE_TEST_SECRET` — **staging/CI only**, disable in production

---

## Health checks

- Liveness: `GET /api/health`
- Readiness: `GET /api/ready` (DB + storage + Redis + job queue + auth secret)

---

## Smoke tests

```bash
# App must be running
npm run smoke:e2e
npm run smoke:api

# Full CI-style (migrate + start + test)
npm run smoke:ci

# Authenticated flow (requires SMOKE_TEST_SECRET + seeded user)
npm run smoke:auth

# Upload → publish → public viewer (requires SMOKE_TEST_SECRET)
npm run smoke:product

# Razorpay webhook signature + subscription activation
npm run smoke:webhook

# Storage adapter write/delete (requires WORKER_SECRET)
npm run smoke:storage
```

---

## Backup & restore

### MySQL

```bash
npm run backup:mysql
# writes backups/mysql/arstudio-<timestamp>.sql
```

Restore:
```bash
mysql -u root -p arstudio < backups/mysql/arstudio-YYYY-MM-DD.sql
```

Schedule nightly via cron or Task Scheduler:
```bash
0 2 * * * cd /opt/ar360 && npm run backup:mysql >> /var/log/ar360-backup.log 2>&1
```

### Customer files (local storage)

```bash
npm run backup:storage
# copies storage/Customers to backups/storage/customers-<timestamp>/
```

When using S3, enable bucket versioning and lifecycle rules instead of local copy.

### Combined checklist

| Asset | Method | Frequency |
|-------|--------|-----------|
| MySQL | `npm run backup:mysql` | Nightly |
| Local files | `npm run backup:storage` | Daily |
| S3 bucket | AWS versioning + cross-region replication | Continuous |

---

## Security notes

- Never commit `.env` or real Razorpay keys
- Remove `SMOKE_TEST_SECRET` in production
- Run `npm run auth:seed` only on staging/dev
- Set strong `AUTH_SECRET` and rotate if leaked
- Restrict MinIO console to internal network in production
