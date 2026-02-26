# Deployment Guide — Monthly Key App

> **Last updated:** 2026-02-26
> **Production URL:** `https://mk-production-7730.up.railway.app/`
> **Future domain:** `https://monthlykey.com` (DNS pending)

---

## Infrastructure Overview

Monthly Key runs on **Railway** as a single service with the following configuration:

| Component | Value |
|-----------|-------|
| **Platform** | Railway (US West — California) |
| **Builder** | Dockerfile (Railpack) |
| **Runtime** | Node.js 22 |
| **Database** | MySQL (PlanetScale-compatible) |
| **Persistent Volume** | `/app/uploads` (file uploads) |
| **Port** | 8081 |
| **Healthcheck** | `/` (300s timeout) |
| **Restart Policy** | On failure (max 10 retries) |

---

## Method 1: GitHub Auto-Deploy (Recommended)

This is the **default and preferred** deployment method. Railway is connected to the GitHub repository and will automatically deploy whenever code is pushed to `main`.

**How it works:**

1. Push your changes to the `main` branch:
   ```bash
   git add -A
   git commit -m "feat: description of changes"
   git push origin main
   ```
2. Railway detects the push and starts building automatically.
3. The build takes approximately 3–5 minutes.
4. Once the build succeeds, the new version replaces the old one with zero downtime.

**Configuration (Railway Settings → Source):**

| Setting | Value |
|---------|-------|
| Source Repo | `raneemndmo-collab/mk` |
| Branch | `main` |
| Wait for CI | OFF (deploy immediately on push) |

**To verify auto-deploy is active:** Go to Railway Dashboard → Monthly Key App → Settings → Source. You should see `raneemndmo-collab/mk` connected with branch `main`.

---

## Method 2: Manual Deploy from Railway Dashboard

Use this when you want to trigger a deploy without pushing new code (e.g., after changing environment variables).

1. Open [Railway Dashboard](https://railway.com/project/e707c8f3-88e3-4f19-95b8-6c5e11cb424d).
2. Click on **Monthly Key App** service.
3. Go to the **Deployments** tab.
4. Click **"Redeploy"** on the latest deployment, or if there are staged changes, click **"Deploy"** in the top banner.

---

## Method 3: Railway CLI (Backup)

Use this for deploying from a local machine without going through GitHub.

**Prerequisites:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

**Deploy:**
```bash
# Navigate to the project root
cd /path/to/mk

# Link to the Railway project (first time only)
railway link

# Deploy current directory
railway up
```

**Note:** CLI deployments bypass the GitHub auto-deploy pipeline. The deployed code may differ from what is on `main` if you have uncommitted changes. Always prefer Method 1 for production deployments.

---

## Environment Variables

All environment variables are managed in Railway Dashboard → Monthly Key App → **Variables**.

**Critical variables that must be set:**

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWT tokens. **Min 32 chars — server exits on startup if missing or too short.** Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` | Yes (fail-fast) |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes |
| `BEDS24_REFRESH_TOKEN` | Beds24 API refresh token | Yes (if Beds24 enabled) |
| `ENABLE_BEDS24` | Enable Beds24 integration (`true`/`false`) | No (default: `false`) |
| `BEDS24_WEBHOOK_SECRET` | Webhook verification secret | No (if webhooks disabled) |
| `ENABLE_BEDS24_WEBHOOKS` | Enable Beds24 webhooks | No (default: `false`) |
| `NODE_ENV` | Environment (`production`) | Yes |
| `PORT` | Server port (`8081`) | Yes |
| `OTP_SECRET_PEPPER` | HMAC pepper for OTP hashing. Min 32 chars. Server logs warning if missing but does not exit. | Recommended |
| `ADMIN_INITIAL_PASSWORD` | Initial admin password for seed script. Falls back to `MK_Admin_2026!` if not set. | Recommended |
| `REDIS_URL` | Redis connection for distributed cache/rate-limiting. Falls back to in-memory if not set. | Optional |
| `SESSION_TTL_MS` | Session lifetime in ms. Default: 1800000 (30 min) in production, 86400000 (24 hr) in dev. | Optional |

**Changing variables:** After updating variables in Railway, the service will automatically redeploy with the new values.

---

## Verifying a Deployment

### Check the deployed commit hash

**From the Railway Dashboard:**
1. Go to **Deployments** tab.
2. Each deployment shows the commit hash and message.
3. Compare with your latest commit: `git log --oneline -1`

**From the terminal:**
```bash
# Check what's on GitHub main
git log origin/main --oneline -1

# Check the production site is responding
curl -sI https://mk-production-7730.up.railway.app/ | head -5
```

### Check service health

```bash
# Basic health check (should return HTML or 200)
curl -sL -o /dev/null -w "%{http_code}" https://mk-production-7730.up.railway.app/

# Check the API is responding
curl -sL -o /dev/null -w "%{http_code}" https://mk-production-7730.up.railway.app/api/trpc
```

### Check Railway logs

1. Go to Railway Dashboard → Monthly Key App → **Observability** or **Logs**.
2. Look for `[Start] Starting server...` to confirm the server started.
3. Check for any error messages in the build or runtime logs.

---

## Rollback

If a deployment causes issues:

1. Go to Railway Dashboard → Monthly Key App → **Deployments**.
2. Find the last known good deployment.
3. Click the **three-dot menu** (⋯) on that deployment.
4. Select **"Redeploy"** to roll back to that version.

Alternatively, revert the code on GitHub and push:
```bash
git revert HEAD
git push origin main
```

---

## Build Configuration

The build process is defined in the `Dockerfile` at the project root:

1. **deps stage** — Installs all npm dependencies
2. **build stage** — Compiles TypeScript, builds the client (Vite), and bundles the server
3. **runtime stage** — Copies only the built artifacts and runs the server

The `start.sh` script runs database migrations before starting the server:
```
1. Run drizzle-kit migrate (applies pending schema changes)
2. Start node dist/index.js
```

---

## Persistent Volume

Uploaded files (maintenance photos, property images, etc.) are stored on a Railway persistent volume:

| Setting | Value |
|---------|-------|
| Mount path | `/app/uploads` |
| Volume name | `uploads-volume` |

This volume survives redeployments. Files are **not** lost when the service restarts or redeploys.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Build fails | Dependency issue or TypeScript error | Check build logs in Railway Deployments tab |
| App crashes on start | Missing env variable or DB connection issue | Check runtime logs, verify `DATABASE_URL` |
| Uploads return 404 | Volume not mounted | Verify `railway.toml` has the volume config |
| Auto-deploy not triggering | GitHub repo disconnected | Check Settings → Source → verify `raneemndmo-collab/mk` is connected |
| Old code still running | Deployment queued or failed | Check Deployments tab for status |
