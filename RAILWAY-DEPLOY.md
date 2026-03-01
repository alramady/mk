# Railway Deployment Guide - Ijar Monthly Rental Platform

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository with the code pushed
3. MySQL database (Railway MySQL or PlanetScale)

---

## Step 1: Create Railway Project

1. Go to https://railway.app/new
2. Click **Deploy from GitHub repo**
3. Select the repository `alramady/re`
4. Railway will auto-detect the Dockerfile

---

## Step 2: Add MySQL Database

1. In your Railway project, click **+ New** → **Database** → **MySQL**
2. Railway will auto-inject `DATABASE_URL` into your service

---

## Step 3: Set Environment Variables

In your Railway service settings → **Variables**, add:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string (auto-injected if using Railway MySQL) | Yes |
| `JWT_SECRET` | Random secret for session cookies (generate with `openssl rand -hex 32`) | Yes |
| `PORT` | Server port (Railway sets this automatically) | Auto |
| `NODE_ENV` | Set to `production` | Yes |
| `VITE_APP_ID` | Application ID (any unique string) | Yes |
| `OWNER_NAME` | Owner display name | No |
| `BUILT_IN_FORGE_API_URL` | LLM/Storage API URL (leave empty if not using AI features) | No |
| `BUILT_IN_FORGE_API_KEY` | LLM/Storage API key | No |
| `VITE_APP_TITLE` | Site title displayed in browser tab | No |
| `VITE_APP_LOGO` | Logo URL | No |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API URL for AI chat | No |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key | No |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal URL | No |
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint URL | No |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID | No |

### Minimum Required Variables:

```
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=your-random-secret-here
NODE_ENV=production
VITE_APP_ID=ijar-monthly-rental
```

---

## Step 4: Run Database Migrations

After the first deployment, open Railway's shell or run locally:

```bash
pnpm db:push
```

Or connect to your Railway MySQL and run the migrations manually.

---

## Step 5: Custom Domain (Optional)

1. In Railway service settings → **Settings** → **Networking**
2. Click **Generate Domain** for a free `*.up.railway.app` domain
3. Or add your custom domain and configure DNS

---

## Notes

- The server binds to `0.0.0.0` and reads `PORT` from environment (Railway compatible)
- Static files are served from the built `dist/` directory
- Database migrations need to be run after first deployment
- AI Assistant and S3 Storage features require OpenAI API API credentials
- Without Forge API credentials, the platform works fully except AI chat and file uploads to S3

---

## Build Command

Railway uses the Dockerfile automatically. The build process:
1. Installs dependencies with `pnpm install`
2. Runs `pnpm build` (Vite frontend + esbuild server)
3. Starts with `node dist/index.js`
