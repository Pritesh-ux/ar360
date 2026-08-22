# Changelog — Production Refactor (2026-07-24)

## Security

- Expanded `.gitignore` — exclude `.env*`, `storage/`, `deploy/`, `backups/`, build artifacts
- Stop copying `.env` into production deploy package
- Document secret rotation requirement for previously tracked env files
- Add `storage/.gitkeep` for directory structure without customer data

## Build & Deploy

- **Rewrote `npm run deploy`** — full pipeline: install, typecheck, lint, unit tests, security audit, build, pack, `deploy.zip`
- Added `npm run deploy:pack` for packaging only
- Deploy package includes: standalone server, migrations, scripts, storage skeleton, docs
- Added `.nvmrc` and `engines.node >= 20`

## Testing

- Split `test:unit` (default, no MySQL) and `test:integration` (requires MySQL)
- Added `test:all` for full suite
- CI updated with typecheck, security audit, unit + integration tests

## Lint & Code Quality

- Scoped ESLint to `src/` with `--quiet` (errors only in CI/deploy)
- Fixed 9 ESLint errors: `<Link>` instead of `<a>`, conditional hooks in `UseCases.tsx`
- ESLint ignores: `deploy/`, `storage/`, `backups/`, `reports/`

## Package

- Moved `@types/pdfkit`, `@types/qrcode` to devDependencies

## DevOps

- Updated `ecosystem.config.js` for deploy package
- Added `ecosystem.vps.config.js` for full repo with workers
- Added `scripts/vps/setup-ubuntu.sh` and `scripts/vps/nginx-ar360.conf`
- Enhanced GitHub Actions CI workflow

## Documentation

- Added `README.md`
- Added `docs/ENVIRONMENT.md`
- Added `docs/SERVER_SETUP.md` (Ubuntu 24, PM2, Nginx, phpMyAdmin/Adminer)
- Added `docs/BACKUP.md`
- Added `docs/RESTORE.md`
- Added `docs/PRODUCTION_CHECKLIST.md`
- Added `reports/PRODUCTION_AUDIT.md`

## Unchanged (by design)

- All product features and APIs
- Database schema and migration files
- UI design language
- Runtime DDL in `db.ts` (disabled in production via `SKIP_RUNTIME_DDL`)
