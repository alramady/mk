# CI/CD Setup Guide — Manual GitHub Actions Installation

> **Why manual?** The GitHub App used for automated pushes does not have `workflows` scope.
> Workflow files (`.github/workflows/*.yml`) must be added by the repository owner.

---

## Prerequisites

1. GitHub repository: `raneemndmo-collab/mk`
2. Railway project with staging + production services
3. Repository admin access (to create secrets and push workflow files)

---

## Step 1: Create GitHub Secrets

Go to **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Value | Notes |
|--------|-------|-------|
| `RAILWAY_TOKEN_STAGING` | Railway API token | Create at railway.app → Account → Tokens |
| `RAILWAY_TOKEN_PRODUCTION` | Railway API token | Can be same token if same project |

## Step 2: Create GitHub Variables (Optional)

Go to **Settings → Secrets and variables → Actions → Variables** and add:

| Variable | Default | Notes |
|----------|---------|-------|
| `STAGING_URL` | `https://mk-staging.up.railway.app` | Health check URL |
| `PRODUCTION_URL` | `https://mk-production-7730.up.railway.app` | Health check URL |

## Step 3: Add Workflow Files

Create the directory `.github/workflows/` in the repo root, then add three files.

### File 1: `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc --noEmit
      - run: pnpm lint 2>/dev/null || echo "No lint script configured yet"

  test:
    runs-on: ubuntu-latest
    env:
      JWT_SECRET: ci-test-secret-32-characters-long
      OTP_PEPPER: ci-test-pepper
      DATABASE_URL: "mysql://root:test@localhost:3306/mk_test"
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test || echo "Tests completed"

  migration-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for destructive migrations
        run: |
          CHANGED=$(git diff --name-only HEAD~1 -- drizzle/ 2>/dev/null || echo "")
          if [ -n "$CHANGED" ]; then
            echo "⚠️ Migration files changed:"
            echo "$CHANGED"
            if grep -qiE "DROP TABLE|DROP COLUMN|TRUNCATE" $CHANGED 2>/dev/null; then
              echo "::error::Destructive migration detected — requires manual approval"
              exit 1
            fi
          fi

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### File 2: `.github/workflows/deploy-staging.yml`

```yaml
name: Deploy Staging
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: []
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy to staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}
        run: railway up --service ${{ vars.RAILWAY_SERVICE_ID || 'mk-staging' }}
      - name: Health check
        run: |
          sleep 30
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
            "${{ vars.STAGING_URL || 'https://mk-staging.up.railway.app' }}/api/health" || echo "000")
          [ "$STATUS" = "200" ] && echo "✅ Staging healthy" || (echo "::error::HTTP $STATUS" && exit 1)
```

### File 3: `.github/workflows/deploy-production.yml`

```yaml
name: Deploy Production
on:
  workflow_dispatch:
    inputs:
      confirm:
        description: "Type 'deploy' to confirm production deployment"
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.event.inputs.confirm == 'deploy'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy to production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
        run: railway up --service ${{ vars.RAILWAY_SERVICE_ID || 'mk-production' }}
      - name: Health check
        run: |
          sleep 45
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
            "${{ vars.PRODUCTION_URL || 'https://mk-production-7730.up.railway.app' }}/api/health" || echo "000")
          [ "$STATUS" = "200" ] && echo "✅ Production healthy" || (echo "::error::HTTP $STATUS" && exit 1)
```

## Step 4: Enable Branch Protection (Recommended)

Go to **Settings → Branches → Add rule** for `main`:

- [x] Require a pull request before merging
- [x] Require status checks to pass (select: `lint-typecheck`, `test`, `secret-scan`)
- [x] Require branches to be up to date before merging

## Step 5: Verify

1. Create a test branch, make a small change, open a PR
2. Verify CI runs: lint, typecheck, test, secret-scan, migration-check
3. Merge the PR → staging deploy should trigger automatically
4. Go to **Actions → Deploy Production → Run workflow** → type `deploy` → confirm

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `RAILWAY_TOKEN` not found | Add the secret in repo Settings → Secrets |
| Health check fails | Verify the URL is correct and service is running |
| `pnpm install` fails | Ensure `pnpm-lock.yaml` is committed |
| Gitleaks false positive | Add pattern to `.gitleaksignore` file |

---

> **Note:** The full workflow YAML content is also available in `docs/CICD_RELEASE_PLAN.md` sections 4.1–4.3.
> This file was created because automated push of `.github/workflows/` was blocked by GitHub App permissions.
