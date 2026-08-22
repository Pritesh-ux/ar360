# Environment Variables

Copy `.env.example` to `.env.local` (development) or `.env` (production).

## Required (production)

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Session signing key — **32+ random characters** |
| `WORKER_SECRET` | Internal worker/API auth — **32+ random characters** |
| `MYSQL_HOST` | MySQL host |
| `MYSQL_USER` | MySQL user |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DATABASE` | Database name (default: `arstudio`) |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS URL (e.g. `https://app.example.com`) |
| `AUTH_COOKIE_SECURE` | `true` on HTTPS |
| `SKIP_RUNTIME_DDL` | `true` — use migrations only |
| `ASSET_PROXY_ENFORCE` | `true` — serve customer assets via entitlement proxy |
| `BILLING_SETTINGS_ENCRYPTION_KEY` | Encrypts secrets stored in Master Admin settings |

## Razorpay

| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | Server-side key ID |
| `RAZORPAY_KEY_SECRET` | Server-side secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client-side checkout key |
| `RAZORPAY_MODE` | `test` or `live` |

## Email (at least one provider)

Configure via Master Admin → Settings, or set env vars:

| Variable | Description |
|----------|-------------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Resend fallback |

## Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_BACKEND` | `local` | `local` or `s3` |
| `STORAGE_ROOT` | `storage/Customers` | Local customer files path |
| `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | — | S3 credentials |
| `AWS_ENDPOINT_URL`, `AWS_S3_FORCE_PATH_STYLE` | — | MinIO / compatible S3 |

## Optional

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Distributed rate limiting + job queue |
| `JOB_QUEUE_BACKEND` | `db` (default) or `redis` |
| `SENTRY_DSN` | Error monitoring |
| `SMOKE_TEST_SECRET` | **Staging/CI only** — never in production |
| `AR360_INTERNAL_KEY` | Custom domain resolution internal API |
| `OBJECT_CAPTURE_STORAGE_ROOT` | OC worker private storage |

## Development seeds (never in production)

```
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=...
SEED_CUSTOMER_EMAIL=customer@example.com
SEED_CUSTOMER_PASSWORD=...
```

## Generate secrets

```bash
# Linux/macOS
openssl rand -base64 32

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

See also `.env.example` for Object Capture worker variables.

