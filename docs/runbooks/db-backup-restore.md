# Database Backup & Restore Runbook

**Platform:** Monthly Key (المفتاح الشهري)
**Database:** MySQL (Railway-managed)
**Last Updated:** 2026-02-28

---

## 1. Environment Overview

Monthly Key uses a centralized database URL resolution system defined in `server/_core/env.ts`. The system supports three separate environments, each with its own database URL.

| Environment | Variable | Fallback | Purpose |
|---|---|---|---|
| Production | `PROD_DATABASE_URL` | `DATABASE_URL` | Live user data |
| Staging | `STAGING_DATABASE_URL` | `DATABASE_URL` | Testing & preview deploys |
| Development | `DEV_DATABASE_URL` | `DATABASE_URL` → localhost | Local development |

Preview deployments on Railway are **forced** to use `STAGING_DATABASE_URL` and can never access the production database.

---

## 2. Railway MySQL Backup Options

### 2.1 Automatic Backups (Railway Built-in)

Railway provides automatic daily backups for MySQL databases on paid plans. These backups are managed through the Railway dashboard.

To verify backups exist:

1. Open [Railway Dashboard](https://railway.app/dashboard)
2. Navigate to the MySQL service
3. Click **Settings** → **Backups**
4. Confirm that automatic backups are enabled and recent backups are listed

### 2.2 Manual Backup via `mysqldump`

For on-demand backups, use `mysqldump` from any machine with access to the database.

```bash
# Set your production database URL
export DB_URL="mysql://user:password@host:port/database"

# Parse connection details
DB_HOST=$(echo $DB_URL | sed -E 's|mysql://[^:]+:[^@]+@([^:]+):[0-9]+/.*|\1|')
DB_PORT=$(echo $DB_URL | sed -E 's|mysql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|')
DB_USER=$(echo $DB_URL | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo $DB_URL | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_NAME=$(echo $DB_URL | sed -E 's|mysql://[^:]+:[^@]+@[^:]+:[0-9]+/(.*)|\1|')

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  --ssl-mode=REQUIRED \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" > "backup_${DB_NAME}_${TIMESTAMP}.sql"

echo "Backup saved: backup_${DB_NAME}_${TIMESTAMP}.sql"
echo "Size: $(du -h backup_${DB_NAME}_${TIMESTAMP}.sql | cut -f1)"
```

### 2.3 Scheduled Backup Script

Save this as `scripts/backup-db.sh` and schedule via cron or CI:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Requires DATABASE_URL in environment
DB_HOST=$(echo $DATABASE_URL | sed -E 's|mysql://[^:]+:[^@]+@([^:]+):[0-9]+/.*|\1|')
DB_PORT=$(echo $DATABASE_URL | sed -E 's|mysql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|')
DB_USER=$(echo $DATABASE_URL | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo $DATABASE_URL | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_NAME=$(echo $DATABASE_URL | sed -E 's|mysql://[^:]+:[^@]+@[^:]+:[0-9]+/(.*)|\1|')

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[Backup] Starting backup of $DB_NAME at $(date -u)"
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  --ssl-mode=REQUIRED \
  --single-transaction \
  --routines --triggers \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[Backup] Saved: $BACKUP_FILE ($(du -h $BACKUP_FILE | cut -f1))"

# Clean old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[Backup] Cleaned backups older than $RETENTION_DAYS days"
```

---

## 3. Restore Procedures

### 3.1 Restore from SQL Dump

```bash
# For .sql files
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  --ssl-mode=REQUIRED \
  "$DB_NAME" < backup_file.sql

# For .sql.gz compressed files
gunzip -c backup_file.sql.gz | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  --ssl-mode=REQUIRED \
  "$DB_NAME"
```

### 3.2 Restore from Railway Dashboard

1. Open Railway Dashboard → MySQL service → Settings → Backups
2. Select the backup point to restore
3. Click **Restore** and confirm
4. Wait for the restore to complete (check service logs)
5. Verify by checking the admin DB Status page at `/admin/db-status`

### 3.3 Post-Restore Verification

After any restore, run these checks:

```bash
# 1. Verify table count
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -e \
  "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = '$DB_NAME';"

# 2. Verify migration state
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -e \
  "SELECT COUNT(*) as migrations FROM __drizzle_migrations;" "$DB_NAME"

# 3. Verify key data
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -e \
  "SELECT COUNT(*) as users FROM users; SELECT COUNT(*) as properties FROM properties; SELECT COUNT(*) as bookings FROM bookings;" "$DB_NAME"

# 4. Re-run migrations to ensure schema is current
DATABASE_URL="$DATABASE_URL" npx drizzle-kit migrate
```

---

## 4. Disaster Recovery Scenarios

### Scenario A: Database Connection Lost

**Symptoms:** Application returns 500 errors, health check at `/api/health` shows `dbStatus: "error"`.

**Steps:**
1. Check Railway dashboard for MySQL service status
2. Check the admin DB Status page at `/admin/db-status` (if accessible)
3. Verify `DATABASE_URL` / `PROD_DATABASE_URL` is correctly set in Railway variables
4. Check Railway deploy logs for boot-time DB identity box
5. If the MySQL service is down, wait for Railway auto-recovery or restart the service

### Scenario B: Wrong Database Connected

**Symptoms:** Data appears empty or belongs to a different environment.

**Steps:**
1. Check the boot logs for the DB identity box — it prints host, port, and database name
2. Visit `/admin/db-status` to verify the active database name and environment
3. Compare the database name against expected values
4. If wrong, update the appropriate environment variable (`PROD_DATABASE_URL`, `STAGING_DATABASE_URL`) in Railway
5. Trigger a redeploy

### Scenario C: Migration Failure on Deploy

**Symptoms:** Deploy logs show `[Migrate] Migration exited with code X`.

**Steps:**
1. Check the specific migration error in Railway deploy logs
2. If it is a "table already exists" or "column already exists" error, the migration was likely already applied — this is safe
3. If it is a genuine schema conflict, connect to the database and inspect the `__drizzle_migrations` table
4. Manually resolve the conflict, then redeploy

### Scenario D: Preview Deploy Accidentally Uses Production DB

**Symptoms:** Test data appears in production, or production data is modified during testing.

**Steps:**
1. This should be prevented by the preview deploy safeguard in `env.ts`
2. If it happens, immediately disable the preview deployment
3. Restore production from the most recent backup
4. Set `STAGING_DATABASE_URL` in Railway to ensure future preview deploys use staging

---

## 5. Environment Variable Checklist

Before deploying, verify these variables are set in Railway:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Primary database URL (auto-set by Railway MySQL addon) |
| `PROD_DATABASE_URL` | Recommended | Explicit production DB URL (takes priority over DATABASE_URL) |
| `STAGING_DATABASE_URL` | Recommended | Staging DB URL (used by preview deploys) |
| `RAILWAY_ENVIRONMENT_NAME` | Auto | Set by Railway (e.g., "production") |
| `RAILWAY_IS_PREVIEW_DEPLOY` | Auto | Set to "true" for PR-based preview deploys |

---

## 6. Monitoring & Alerts

The application provides several monitoring endpoints:

| Endpoint | Access | Purpose |
|---|---|---|
| `/api/health` | Public | Basic health check with DB connection status |
| `/admin/db-status` | Admin (RBAC) | Full DB identity, migration state, table count |
| Boot logs | Railway logs | DB identity box printed on every startup |

Set up Railway alerts for:
- Deploy failures (migration errors)
- Service restarts (potential DB connection issues)
- MySQL service health degradation

---

## 7. Contact & Escalation

For database emergencies:
1. Check Railway status page: https://status.railway.app
2. Contact Railway support through the dashboard
3. Escalate to the development team with the DB identity information from boot logs or `/admin/db-status`
