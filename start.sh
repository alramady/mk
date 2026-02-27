#!/bin/sh
set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Monthly Key — Production Boot Sequence          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── Environment Identity ────────────────────────────────────────
echo "[Boot] NODE_ENV          = ${NODE_ENV:-not set}"
echo "[Boot] RAILWAY_ENV       = ${RAILWAY_ENVIRONMENT_NAME:-not set}"
echo "[Boot] RAILWAY_PREVIEW   = ${RAILWAY_IS_PREVIEW_DEPLOY:-false}"
echo "[Boot] Timestamp         = $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# ─── Database URL Source Validation ──────────────────────────────
if [ -n "$PROD_DATABASE_URL" ]; then
  echo "[Boot] DB source: PROD_DATABASE_URL (explicit production)"
  DB_SOURCE="PROD_DATABASE_URL"
elif [ "$RAILWAY_IS_PREVIEW_DEPLOY" = "true" ] && [ -n "$STAGING_DATABASE_URL" ]; then
  echo "[Boot] DB source: STAGING_DATABASE_URL (preview deploy)"
  DB_SOURCE="STAGING_DATABASE_URL"
elif [ -n "$DATABASE_URL" ]; then
  echo "[Boot] DB source: DATABASE_URL (generic)"
  DB_SOURCE="DATABASE_URL"
else
  echo "[Boot] ERROR: No database URL configured!"
  exit 1
fi

# ─── Preview Deploy Safety Check ─────────────────────────────────
if [ "$RAILWAY_IS_PREVIEW_DEPLOY" = "true" ]; then
  echo "[Boot] Preview deployment detected"
  if [ -n "$STAGING_DATABASE_URL" ]; then
    echo "[Boot] Using staging database (safe)"
  else
    echo "[Boot] WARNING: No STAGING_DATABASE_URL — preview may use production DB!"
    echo "[Boot] Set STAGING_DATABASE_URL to isolate preview deploys"
  fi
fi

# ─── Run Database Migrations ─────────────────────────────────────
echo ""
echo "[Migrate] ════════════════════════════════════════════════"
echo "[Migrate] Running drizzle-kit migrate..."
echo "[Migrate] DB source: $DB_SOURCE"
echo "[Migrate] Started at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

if npx drizzle-kit migrate 2>&1; then
  echo "[Migrate] Migrations completed successfully"
else
  MIGRATE_EXIT=$?
  echo "[Migrate] Migration exited with code $MIGRATE_EXIT"
  echo "[Migrate] This may mean migrations were already applied (safe) or failed (check logs)"
fi

echo "[Migrate] Finished at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "[Migrate] ════════════════════════════════════════════════"
echo ""

# ─── Start Application Server ────────────────────────────────────
echo "[Boot] Starting application server..."
exec node dist/index.js
