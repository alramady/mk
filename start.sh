#!/bin/sh
echo "[Start] Running database migrations..."
npx drizzle-kit migrate 2>&1 || echo "[Start] Migration failed or already applied"
echo "[Start] Starting server..."
exec node dist/index.js
