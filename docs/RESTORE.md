# Restore Guide

## MySQL restore

**Warning:** This overwrites the target database. Stop the app first.

```bash
pm2 stop ar360-web

mysql -u ar360 -p arstudio < backups/mysql/arstudio-YYYY-MM-DDTHH-MM-SS.sql

pm2 start ar360-web
curl http://127.0.0.1:3000/api/ready
```

### Full database reset + restore (staging only)

```bash
npm run db:reset    # destructive — dev/staging only
npm run db:migrate
mysql -u ar360 -p arstudio < backups/mysql/your-backup.sql
```

## Customer storage restore (local)

```bash
pm2 stop ar360-web

rsync -a backups/storage/customers-TIMESTAMP/ storage/Customers/
# or on Windows: xcopy /E /I backups\storage\customers-TIMESTAMP storage\Customers

chown -R ar360:ar360 storage/Customers   # Linux
pm2 start ar360-web
```

## S3 restore

Use AWS Console, `aws s3 sync`, or point-in-time recovery if versioning is enabled:

```bash
aws s3 sync s3://your-bucket/Customers/ ./storage/Customers/
```

## Object Capture private data

```bash
tar xzf oc-backup.tar.gz -C /
# Ensure OBJECT_CAPTURE_STORAGE_ROOT matches restored path
npm run readiness:oc
```

## Post-restore verification

1. `GET /api/ready` — all checks green
2. Log in as test customer
3. Open a published product viewer
4. Master Admin → System Health
5. Verify subscription/billing state in admin panel

## Disaster recovery order

1. Provision new VPS (see [SERVER_SETUP.md](SERVER_SETUP.md))
2. Restore MySQL
3. Deploy latest `deploy.zip` or known-good release
4. Restore `storage/Customers/`
5. Restore `.env` from secrets vault
6. Run migrations: `npm run db:migrate` (idempotent)
7. Start PM2 / Docker workers
8. Verify health + smoke tests

## Rollback deployment

Keep previous `deploy.zip` releases:

```bash
pm2 stop ar360-web
mv deploy deploy.failed
unzip deploy-previous.zip -d deploy
pm2 start ecosystem.config.js
```

Database rollbacks require a MySQL backup from before the failed migration.
