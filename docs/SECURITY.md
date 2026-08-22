# Security — Secret Rotation Guide

If `.env` or `.env.local` were ever committed to git (fixed in production refactor), **rotate all secrets immediately**.

> **Critical C4 (manual):** Treat any historical commit of `.env` as compromised until rotation is confirmed on every environment (local + VPS).

## Secrets to rotate

| Secret | Where to update |
|--------|-----------------|
| `AUTH_SECRET` | `.env` on all servers — forces all signed sessions to re-auth |
| `WORKER_SECRET` | `.env` + worker configs / PM2 |
| `BILLING_SETTINGS_ENCRYPTION_KEY` | `.env` — re-save Razorpay keys in Master Admin after |
| `MYSQL_PASSWORD` | MySQL + `.env` |
| `RAZORPAY_KEY_SECRET` | Razorpay dashboard + `.env` + Master Admin settings |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook config + `.env` |
| `SMTP_PASSWORD` / `RESEND_API_KEY` | Provider dashboard + Master Admin settings |
| `ALLOW_SMOKE_LOGIN` / smoke secrets | Disable in production; rotate if ever enabled |

## Rotation checklist (C4)

1. [ ] Generate new values offline (do not paste into chat/tickets)
2. [ ] Update VPS `/var/www/ar360/deploy/.env` (and staging/local mirrors)
3. [ ] Re-enter encrypted billing secrets in Master Admin if encryption key changed
4. [ ] `pm2 restart ar360-web ar360-lifecycle-email` (and any other workers)
5. [ ] Confirm `GET /api/ready` and a fresh customer + admin login
6. [ ] Confirm Razorpay webhook signature still accepts test events
7. [ ] Optional: purge `.env` from git history if the repo was ever public, then force-push only with team approval

## After rotation

1. Restart app: `pm2 restart ar360-web`
2. Restart workers (webhook, lifecycle email)
3. Verify: `curl https://yourdomain.com/api/ready`
4. Test login (customer + master admin)
5. Test Razorpay webhook with a test payment

## Admin session rollout note (H11)

New master-admin sessions include signed `iat`/`exp`. Legacy cookies without `exp` are accepted while `ALLOW_LEGACY_ADMIN_SESSIONS` is not `false`. After one week post-deploy, set `ALLOW_LEGACY_ADMIN_SESSIONS=false` so old tokens cannot linger forever.

## Git history cleanup (optional)

If the repository was public with secrets:

```bash
# Use git-filter-repo or BFG Repo-Cleaner to purge .env from history
# Then force-push (coordinate with team) and rotate ALL secrets regardless
```

Never force-push to `main` without team approval.

## Ongoing practices

- Never commit `.env`, `.env.local`, or `storage/`
- Use a secrets manager for production (1Password, Vault, AWS SSM)
- Run `npm run audit:master-admin-security` before each release
- Restrict database admin UIs to VPN/internal IP only; SQL console requires `database.query` (super_admin)
- Apply `database/migrations/61_security_hardening_high.sql` on deploy
