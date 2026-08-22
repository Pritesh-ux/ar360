# Backup Guide

## What to backup

| Asset | Method | Location |
|-------|--------|----------|
| MySQL database | `npm run backup:mysql` | `backups/mysql/arstudio-<timestamp>.sql` |
| Customer files (local) | `npm run backup:storage` | `backups/storage/customers-<timestamp>/` |
| Customer files (S3) | AWS versioning + lifecycle | S3 bucket |
| Environment | Secure secret store | **Not in git** — copy `.env` to vault |
| Object Capture private data | Copy volume/directory | `storage/private/object-capture/` |

## MySQL — automated nightly

```bash
# crontab -e (as app user)
0 2 * * * cd /opt/ar360 && npm run backup:mysql >> /var/log/ar360-backup.log 2>&1
```

Manual:

```bash
npm run backup:mysql
```

## Customer storage — daily

```bash
# crontab
30 2 * * * cd /opt/ar360 && npm run backup:storage >> /var/log/ar360-backup.log 2>&1
```

When using S3, enable:
- Bucket versioning
- Cross-region replication (optional)
- Lifecycle rules for old versions

## Docker volumes

```bash
docker compose exec mysql mysqldump -u root -p arstudio > backup.sql
docker run --rm -v ar360_object_capture_storage:/data -v $(pwd):/backup alpine tar czf /backup/oc-backup.tar.gz /data
```

## Retention policy (recommended)

| Backup | Retention |
|--------|-----------|
| Daily MySQL | 30 days |
| Weekly MySQL | 12 weeks |
| Daily storage | 14 days |
| Off-site copy | 90 days |

## Verify backups

Periodically restore to a staging server and run:

```bash
npm run smoke:api
curl http://localhost:3000/api/ready
```

## Pre-backup checklist

- [ ] MySQL credentials in `.env` are correct
- [ ] `backups/` directory is writable
- [ ] Backups stored off-server (S3, another VPS, NAS)
- [ ] `.env` backed up in a secrets manager (1Password, Vault, etc.)
