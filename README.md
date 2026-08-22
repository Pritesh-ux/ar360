# AR360 Studio

Production SaaS platform for **3D & AR product visualization** — upload GLB models, customize in the studio editor, publish via QR/embed/public viewer, manage subscriptions with Razorpay, and optionally reconstruct models with Object Capture.

## Features

- Customer dashboard (products, analytics, QR, share links, billing)
- Interactive 3D/AR viewer (`@google/model-viewer`, Three.js)
- Razorpay subscriptions, GST invoices, webhooks
- Enterprise: custom domains, branding, custom plans
- Master Admin panel with RBAC
- Object Capture pipeline (COLMAP / OpenMVS / Blender workers)
- Local or S3 storage, Redis rate limiting (optional)

## Requirements

| Component | Version |
|-----------|---------|
| Node.js | 20+ (see `.nvmrc`) |
| MySQL | 8+ |
| Redis | 7+ (optional) |
| OS | Ubuntu 24 LTS (production) or Windows + XAMPP (local dev) |

## Quick start (development)

```bash
git clone <repo-url> ar360
cd ar360
cp .env.example .env.local
# Edit .env.local — set MYSQL_* and AUTH_SECRET (32+ chars)

npm ci
npm run db:migrate
npm run auth:seed          # optional demo accounts (dev only)
npm run dev                # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production Next.js build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (errors only) |
| `npm run test` | Unit tests (no MySQL required) |
| `npm run test:integration` | DB integration tests |
| `npm run deploy` | Full production pipeline → `deploy.zip` |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run backup:mysql` | MySQL backup to `backups/mysql/` |

## Production deploy

```bash
npm run deploy
# Creates deploy/ folder and deploy.zip
```

Upload `deploy.zip` to your VPS. See [docs/SERVER_SETUP.md](docs/SERVER_SETUP.md).

**Docker alternative:** see [docs/DEPLOY.md](docs/DEPLOY.md).

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | All environment variables |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Docker & production deploy |
| [docs/SERVER_SETUP.md](docs/SERVER_SETUP.md) | Ubuntu VPS + PM2 + Nginx |
| [docs/BACKUP.md](docs/BACKUP.md) | Backup procedures |
| [docs/RESTORE.md](docs/RESTORE.md) | Restore procedures |
| [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) | Pre-launch checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | Secret rotation & security practices |
| [reports/PRODUCTION_AUDIT.md](reports/PRODUCTION_AUDIT.md) | Architecture audit |

## Project structure

```
src/app/          Next.js App Router (pages + API)
src/components/   UI components
src/lib/          Domain logic (auth, billing, storage, …)
src/server/       Heavy services (Razorpay, subscriptions)
database/         SQL migrations
scripts/          Workers, smoke tests, deploy
storage/          Customer uploads (git-ignored)
deploy/           Generated production package (git-ignored)
```

## Security

- Never commit `.env` or `storage/`
- Set `AUTH_COOKIE_SECURE=true` on HTTPS
- Set `SKIP_RUNTIME_DDL=true` in production
- Remove `SMOKE_TEST_SECRET` in production
- Run `npm run audit:master-admin-security` before release

## License

Private — commercial SaaS.
