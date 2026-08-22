# Production Launch Checklist

## Security — Critical

- [ ] `.env` and `.env.local` **not** in git
- [ ] `storage/` **not** in git
- [ ] `AUTH_SECRET` — 32+ chars, unique, not default
- [ ] `WORKER_SECRET` — 32+ chars, unique
- [ ] `BILLING_SETTINGS_ENCRYPTION_KEY` — unique random string
- [ ] `AUTH_COOKIE_SECURE=true` on HTTPS
- [ ] `SKIP_RUNTIME_DDL=true`
- [ ] `ASSET_PROXY_ENFORCE=true`
- [ ] `SMOKE_TEST_SECRET` **unset** in production
- [ ] Razorpay **live** keys configured (if going live)
- [ ] Webhook URL registered in Razorpay dashboard
- [ ] Database admin UI (phpMyAdmin/Adminer) IP-restricted or disabled

## Infrastructure

- [ ] MySQL 8+ running with dedicated user (not root)
- [ ] Redis running (if using distributed rate limits / job queue)
- [ ] Nginx reverse proxy + TLS (Let's Encrypt)
- [ ] Firewall: only 22, 80, 443 open
- [ ] PM2 startup configured (`pm2 startup` + `pm2 save`)
- [ ] Health checks: `/api/health`, `/api/ready`

## Application

- [ ] `npm run deploy` completed successfully
- [ ] `npm run db:migrate` applied on production DB
- [ ] `npm run db:status` shows all migrations applied
- [ ] SMTP or Resend configured and test email sent
- [ ] Master Admin account created (not default seed password)
- [ ] `npm run audit:master-admin-security` passed

## Workers

- [ ] Razorpay webhook worker running (Docker or PM2)
- [ ] Lifecycle email worker running (optional but recommended)
- [ ] Object Capture worker running (if feature enabled)
- [ ] OC cleanup worker running

## Backups

- [ ] Nightly MySQL backup cron configured
- [ ] Storage backup configured (local cron or S3 versioning)
- [ ] Restore procedure tested on staging
- [ ] `.env` stored in secrets manager

## Monitoring

- [ ] Sentry DSN configured (optional)
- [ ] PM2 log rotation or centralized logging
- [ ] Disk space alerts for `storage/`
- [ ] Razorpay webhook backlog monitored (Master Admin → System Health)

## Legal / Product

- [ ] Privacy policy and Terms pages reviewed
- [ ] Pricing page matches active plans in database
- [ ] GST details correct on invoices

## Post-launch smoke test

```bash
# From staging or with production URL
npm run smoke:api
npm run smoke:e2e
```

Manual:
- [ ] Signup → onboarding → upload GLB → publish → public viewer
- [ ] Razorpay test payment → subscription active
- [ ] QR code scan → viewer loads
- [ ] Master Admin login → customer list loads
