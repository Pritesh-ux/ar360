# Database Migrations and Seeding System

This directory contains the database schema definition, migrations, and seeders for the AR360 Studio project.

## Folder Structure

```
/database
  /migrations        - Structured numbered SQL files to define schema changes sequentially.
  /seeders           - SQL files containing default seed data (e.g. plans, pricing, limits).
  schema.sql         - Consolidated database schema containing all 31 tables.
  seed.sql           - Consolidated seed data.
  README.md          - This documentation file.
```

## Available NPM Scripts

You can run the database management scripts from the project root using the following commands:

### 1. Check Connection
Check connection to the configured database and create the database if it does not exist:
```bash
npm run db:check
```

### 2. Run Migrations
Run all pending migrations in order (checks `migrations` table to skip already-run migrations):
```bash
npm run db:migrate
```

### 3. Run Seeders
Seed default billing plans, system admin, and a demo customer with active subscription:
```bash
npm run db:seed
```

### 4. Recreate Database (Reset)
Drop database, recreate it, run all migrations, and run all seeders.
> **Note**: This command is disabled in production environments by default unless `RESET_DATABASE_ALLOWED=true` is set.
```bash
npm run db:reset
```

## Database Configuration

The system loads database parameters from the standard environment configuration. The following variables are supported (defined in `.env` or `.env.local`):

- `MYSQL_HOST` (default: `localhost`)
- `MYSQL_PORT` (default: `3306`)
- `MYSQL_USER` (default: `root`)
- `MYSQL_PASSWORD` (default: `""`)
- `MYSQL_DATABASE` (default: `arstudio`)
- `MYSQL_URL` / `DATABASE_URL` (optional, connection URI bypasses individual parameters)

---
Developed as part of the AR360 Studio hardening stage.
