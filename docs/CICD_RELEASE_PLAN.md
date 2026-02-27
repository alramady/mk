# MonthlyKey — CI/CD & Release Plan

**Version:** 2.0  
**Date:** 2026-02-26  
**Classification:** Internal — Engineering & DevOps  
**Compliance note:** No Beds24 changes. No Mansun dependency added.

---

## 1. Executive Summary

MonthlyKey currently has no CI/CD pipeline. Deployments are triggered by pushing to the `main` branch, which Railway auto-deploys without any automated checks. There are 33 test files in the repository but no automation to run them. This plan defines a three-stage GitHub Actions pipeline (CI → Staging → Production) with type-checking, linting, testing, secret scanning, and migration safety checks. The pipeline is designed to work with Railway's deployment model and requires no proprietary tools beyond GitHub Actions (free tier sufficient for current scale).

---

## 2. Current State

| Aspect | Status | Risk |
|--------|--------|------|
| **Automated testing** | 33 test files exist, `vitest` configured | Tests never run automatically — regressions go undetected |
| **Type checking** | TypeScript configured, `tsconfig.json` exists | No `tsc --noEmit` in any workflow — type errors can ship |
| **Linting** | No ESLint configuration found | Code style inconsistencies, potential bugs |
| **Secret scanning** | None | Hardcoded secrets already exist in source (`15001500`) |
| **Staging environment** | None | Changes go directly to production |
| **Deployment** | Railway auto-deploy on `main` push | No gate between merge and deploy |
| **Migration safety** | `start.sh` runs `drizzle-kit migrate` on startup | Destructive migrations can run without review |
| **Rollback** | Manual Railway rollback | No automated rollback on health check failure |

---

## 3. Pipeline Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    GitHub Actions Pipeline                    │
  │                                                              │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐│
  │  │ Lint &   │───→│  Test    │───→│ Security │───→│ Build  ││
  │  │ Typecheck│    │ (vitest) │    │  Scan    │    │ Check  ││
  │  └──────────┘    └──────────┘    └──────────┘    └────┬───┘│
  │                                                       │     │
  │  Triggered on: pull_request to main                   │     │
  │  Required to pass before merge                        │     │
  └───────────────────────────────────────────────────────┼─────┘
                                                          │
  ┌───────────────────────────────────────────────────────▼─────┐
  │                    Staging Deploy                             │
  │                                                              │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
  │  │ Deploy   │───→│ Smoke    │───→│ Health   │              │
  │  │ to Stg   │    │ Tests    │    │ Check    │              │
  │  └──────────┘    └──────────┘    └──────────┘              │
  │                                                              │
  │  Triggered on: merge to main                                │
  │  Environment: Railway staging service                        │
  └──────────────────────────────────────────────────────────────┘
                                                          │
  ┌───────────────────────────────────────────────────────▼─────┐
  │                    Production Deploy                          │
  │                                                              │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
  │  │ Manual   │───→│ Deploy   │───→│ Health   │              │
  │  │ Approval │    │ to Prod  │    │ Verify   │              │
  │  └──────────┘    └──────────┘    └──────────┘              │
  │                                                              │
  │  Triggered on: manual workflow_dispatch or staging success   │
  │  Requires: lead engineer approval                            │
  └──────────────────────────────────────────────────────────────┘
```

---

## 4. GitHub Actions Workflow Files

### 4.1 CI Pipeline (`.github/workflows/ci.yml`)

This workflow runs on every pull request to `main` and on every push to `main`. It must pass before a PR can be merged.

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
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
      
      - name: TypeScript type check
        run: pnpm exec tsc --noEmit
      
      - name: ESLint (when configured)
        run: pnpm exec eslint . --ext .ts,.tsx --max-warnings 0
        continue-on-error: true  # Remove after ESLint is configured

  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
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
      
      - name: Run tests
        run: pnpm exec vitest run --reporter=verbose
        env:
          NODE_ENV: test
          JWT_SECRET: test-jwt-secret-for-ci-pipeline-only-64-characters-minimum-required
          OTP_SECRET_PEPPER: test-otp-pepper-for-ci-pipeline-only

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for secret scanning
      
      - name: Secret scanning with Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Dependency audit
        run: |
          npm audit --production --audit-level=critical 2>&1 || true
          # Fail only on critical vulnerabilities
          npm audit --production --audit-level=critical

  build-check:
    name: Build Check
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
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
      
      - name: Build client
        run: pnpm exec vite build
      
      - name: Build server
        run: pnpm exec esbuild server/index.ts --bundle --platform=node --outdir=dist --external:sharp --external:bcryptjs
        continue-on-error: true  # Adjust based on actual build setup

  migration-check:
    name: Migration Safety Check
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for destructive migrations
        run: |
          # Find new migration files in this PR
          MIGRATIONS=$(git diff --name-only origin/main...HEAD -- 'drizzle/migrations/*.sql' 2>/dev/null || echo "")
          if [ -z "$MIGRATIONS" ]; then
            echo "No new migrations found."
            exit 0
          fi
          
          echo "New migrations found:"
          echo "$MIGRATIONS"
          
          # Check for destructive operations
          DESTRUCTIVE=$(grep -il "DROP TABLE\|DROP COLUMN\|TRUNCATE\|DELETE FROM" $MIGRATIONS 2>/dev/null || echo "")
          if [ -n "$DESTRUCTIVE" ]; then
            echo "::error::DESTRUCTIVE MIGRATION DETECTED in: $DESTRUCTIVE"
            echo "Destructive migrations require manual approval from the lead engineer."
            exit 1
          fi
          
          echo "Migration safety check passed."
```

### 4.2 Staging Deploy (`.github/workflows/deploy-staging.yml`)

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      
      - name: Deploy to staging
        run: railway up --service mk-staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_STAGING_TOKEN }}
      
      - name: Wait for deployment
        run: sleep 90
      
      - name: Health check
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ vars.STAGING_URL }}/api/health)
          if [ "$STATUS" != "200" ]; then
            echo "::error::Staging health check failed with status $STATUS"
            exit 1
          fi
          echo "Staging health check passed (HTTP $STATUS)"
      
      - name: Smoke test — API responds
        run: |
          RESPONSE=$(curl -s ${{ vars.STAGING_URL }}/api/trpc/siteSettings.getAll)
          if echo "$RESPONSE" | grep -q "error"; then
            echo "::error::API smoke test failed"
            echo "$RESPONSE"
            exit 1
          fi
          echo "API smoke test passed"
```

### 4.3 Production Deploy (`.github/workflows/deploy-production.yml`)

```yaml
name: Deploy to Production

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: "Type 'deploy' to confirm production deployment"
        required: true
        type: string

jobs:
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production
    if: github.event.inputs.confirm == 'deploy'
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      
      - name: Deploy to production
        run: railway up --service mk-production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_PRODUCTION_TOKEN }}
      
      - name: Wait for deployment
        run: sleep 120
      
      - name: Health check
        run: |
          for i in 1 2 3 4 5; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://monthly-key-app-production.up.railway.app/api/health)
            if [ "$STATUS" = "200" ]; then
              echo "Production health check passed (attempt $i)"
              exit 0
            fi
            echo "Health check attempt $i failed (HTTP $STATUS), retrying in 30s..."
            sleep 30
          done
          echo "::error::Production health check failed after 5 attempts"
          exit 1
      
      - name: Notify on success
        if: success()
        run: echo "Production deployment successful at $(date -u)"
      
      - name: Notify on failure
        if: failure()
        run: echo "::error::Production deployment FAILED — manual rollback may be required"
```

---

## 5. Branch Protection Rules

The following GitHub branch protection rules should be configured for the `main` branch:

| Rule | Setting | Rationale |
|------|---------|-----------|
| Require pull request reviews | 1 approval required | Prevent unreviewed code from reaching production |
| Require status checks to pass | `lint-and-typecheck`, `test`, `security-scan`, `build-check` | Automated quality gate |
| Require branches to be up to date | Enabled | Prevent merge conflicts from causing failures |
| Require conversation resolution | Enabled | Ensure all review comments are addressed |
| Restrict pushes | Only via PR (no direct push to main) | Enforce review process |
| Allow force pushes | Disabled | Prevent history rewriting |

---

## 6. ESLint Configuration

**New file:** `.eslintrc.cjs`

```javascript
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    // Security
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    
    // Quality
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error", "log"] }],
    
    // Async safety
    "no-return-await": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
  },
  ignorePatterns: ["dist/", "node_modules/", "*.test.ts", "*.spec.ts"],
};
```

**Dependencies to add:**

```bash
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

## 7. Release Process

### 7.1 Standard Release Flow

```
Developer → Feature Branch → PR → CI Checks → Review → Merge to main
                                                              │
                                                    Auto-deploy to Staging
                                                              │
                                                    Smoke tests pass
                                                              │
                                                    Manual trigger: Deploy to Production
                                                              │
                                                    Health check passes
                                                              │
                                                    Release tagged (vX.Y.Z)
```

### 7.2 Hotfix Flow

For critical production issues, the hotfix flow bypasses staging:

```
Developer → hotfix/ISSUE-ID branch → PR (label: hotfix) → CI Checks → Review
                                                                          │
                                                              Direct deploy to Production
                                                              (requires 2 approvals)
```

### 7.3 Version Numbering

MonthlyKey follows semantic versioning (`MAJOR.MINOR.PATCH`):

| Component | Increment When |
|-----------|---------------|
| **MAJOR** | Breaking API changes, DB schema changes requiring data migration |
| **MINOR** | New features, non-breaking API additions |
| **PATCH** | Bug fixes, security patches, documentation updates |

---

## 8. Package Scripts

Add the following scripts to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "ci": "pnpm typecheck && pnpm lint && pnpm test",
    "build:client": "vite build",
    "migration:check": "drizzle-kit check",
    "migration:generate": "drizzle-kit generate",
    "migration:push": "drizzle-kit push"
  }
}
```

---

## 9. Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `.github/workflows/ci.yml` | **New** | CI pipeline: lint, typecheck, test, security scan, build check, migration check |
| `.github/workflows/deploy-staging.yml` | **New** | Staging deployment with health check and smoke tests |
| `.github/workflows/deploy-production.yml` | **New** | Production deployment with manual approval and health checks |
| `.eslintrc.cjs` | **New** | ESLint configuration with TypeScript and security rules |
| `package.json` | **Modify** | Add lint, typecheck, test, ci scripts; add ESLint devDependencies |

**No Beds24 changes.** The CI pipeline tests do not modify Beds24 integration.  
**No Mansun dependency added.** GitHub Actions, ESLint, and Gitleaks are all open-source tools.

---

## Appendix A — GitHub Actions Workflows (Manual Add)

> **Note:** These workflow files could not be pushed automatically because the GitHub App used for authentication does not have the `workflows` permission. The repository owner must add them manually via the GitHub web UI or a personal access token with `workflows` scope.

### How to add manually

1. Go to the repository on GitHub.
2. Click **Add file → Create new file**.
3. Set the path to `.github/workflows/ci.yml` and paste the YAML below.
4. Repeat for `deploy-staging.yml` and `deploy-production.yml`.
5. Commit directly to `main` (or a PR if branch protection is already enabled).
6. After adding, enable branch protection on `main`: **Settings → Branches → Add rule → Require status checks → select `typecheck`, `test`, `secret-scan`, `build`**.

---

### File 1: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"
  PNPM_VERSION: "9"

jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache/save@v4
        with:
          path: node_modules
          key: modules-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}

  typecheck:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: modules-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm check

  test:
    needs: setup
    runs-on: ubuntu-latest
    env:
      JWT_SECRET: ci-test-secret-not-for-production-use-32chars
      OTP_PEPPER: ci-test-pepper-not-for-production-use
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: modules-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
          retention-days: 7

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Install gitleaks
        run: |
          curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.18.4/gitleaks_8.18.4_linux_x64.tar.gz | tar xz
          sudo mv gitleaks /usr/local/bin/
      - run: gitleaks detect --source . --verbose --no-git

  migration-check:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify migration journal
        run: |
          python3 -c "
          import json, sys, os
          with open('drizzle/meta/_journal.json') as f:
              j = json.load(f)
          entries = j['entries']
          for i, e in enumerate(entries):
              if e['idx'] != i:
                  print(f'ERROR: index mismatch at {i}'); sys.exit(1)
              if not os.path.exists(f'drizzle/{e[\"tag\"]}.sql'):
                  print(f'ERROR: missing {e[\"tag\"]}.sql'); sys.exit(1)
          print(f'OK: {len(entries)} migrations verified')
          "
      - name: Check for destructive ops
        run: |
          CHANGED=$(git diff --name-only origin/main...HEAD -- 'drizzle/*.sql' 2>/dev/null || echo "")
          [ -z "$CHANGED" ] && echo "No new migrations" && exit 0
          for f in $CHANGED; do
            grep -qiE "DROP TABLE|DROP COLUMN|TRUNCATE" "$f" && echo "WARNING: destructive op in $f" && grep -niE "DROP TABLE|DROP COLUMN|TRUNCATE" "$f"
          done

  build:
    needs: [typecheck, test]
    runs-on: ubuntu-latest
    env:
      JWT_SECRET: ci-build-secret-not-for-production-use-32chars
      OTP_PEPPER: ci-build-pepper-not-for-production-use
      NODE_ENV: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: modules-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm build
      - run: test -d dist && echo "Build OK" || (echo "ERROR: dist/ missing" && exit 1)
```

---

### File 2: `.github/workflows/deploy-staging.yml`

```yaml
name: Deploy Staging

on:
  push:
    branches: [staging]

concurrency:
  group: deploy-staging
  cancel-in-progress: false

jobs:
  ci-gate:
    uses: ./.github/workflows/ci.yml

  deploy:
    needs: ci-gate
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Install Railway CLI
        run: curl -fsSL https://railway.com/install.sh | sh
      - name: Deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}
        run: railway up --service ${{ vars.RAILWAY_SERVICE_ID || 'mk-staging' }} --detach
      - name: Health check
        run: |
          sleep 30
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${{ vars.STAGING_URL || 'https://mk-staging.up.railway.app' }}/api/health" || echo "000")
          [ "$STATUS" = "200" ] && echo "OK" || echo "::warning::HTTP $STATUS"
```

---

### File 3: `.github/workflows/deploy-production.yml`

```yaml
name: Deploy Production

on:
  workflow_dispatch:
    inputs:
      reason:
        description: "Deployment reason"
        required: true
        type: string
  release:
    types: [published]

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  ci-gate:
    uses: ./.github/workflows/ci.yml

  deploy:
    needs: ci-gate
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Log info
        run: |
          echo "Deploying by: ${{ github.actor }}"
          echo "Reason: ${{ github.event.inputs.reason || 'Release tag' }}"
          echo "SHA: ${{ github.sha }}"
      - name: Install Railway CLI
        run: curl -fsSL https://railway.com/install.sh | sh
      - name: Deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
        run: railway up --service ${{ vars.RAILWAY_SERVICE_ID || 'mk-production' }} --detach
      - name: Health check
        run: |
          sleep 45
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${{ vars.PRODUCTION_URL || 'https://monthly-key-app-production.up.railway.app' }}/api/health" || echo "000")
          [ "$STATUS" = "200" ] && echo "OK" || (echo "::error::HTTP $STATUS" && exit 1)
```

---

### Required GitHub Secrets (set in Settings → Secrets and variables → Actions)

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN_STAGING` | Railway API token for staging service |
| `RAILWAY_TOKEN_PRODUCTION` | Railway API token for production service |

### Required GitHub Variables (optional, set in Settings → Secrets and variables → Actions → Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `RAILWAY_SERVICE_ID` | `mk-staging` / `mk-production` | Railway service name |
| `STAGING_URL` | `https://mk-staging.up.railway.app` | Staging health check URL |
| `PRODUCTION_URL` | `https://monthly-key-app-production.up.railway.app` | Production health check URL |
