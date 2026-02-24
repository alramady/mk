# Manus OAuth Removal — Complete Report

**Date:** 2026-02-24  
**Status:** ✅ Complete  
**Tests:** 16/16 passed + 1 existing auth test updated and passing

---

## 1. Removed Files

| File | Description |
|------|-------------|
| `server/_core/oauth.ts` | OAuth callback route, Manus token exchange, login/register with OAuth |
| `server/_core/types/manusTypes.ts` | Manus OAuth type definitions (ExchangeTokenResponse, UserInfo) |
| `hardening-kb/` | Standalone KB project (contained OAuth references in const.ts) |

## 2. Rewritten Files

| File | What Changed |
|------|-------------|
| `server/_core/sdk.ts` | Removed `OAuthService` class, `ExchangeToken`, `getUserInfoByToken`, `getUserInfoWithJwt`, `getTokenByCode`. Now contains only `SessionManager` (pure JWT). No axios import. |
| `server/_core/auth.ts` | **New file** replacing `oauth.ts`. Local-only login/register/logout/change-password. Added rate limiting per endpoint, auth event logging (LOGIN_SUCCESS, LOGIN_FAILED, REGISTER_SUCCESS, etc.), bcrypt cost factor 12. |
| `server/_core/env.ts` | Removed `oAuthServerUrl`, `ownerOpenId`, `isLocalMode`. Only `jwtSecret`, `databaseUrl`, `port`, `nodeEnv` remain. |
| `server/_core/index.ts` | Changed import from `registerOAuthRoutes` → `registerAuthRoutes`. |
| `server/_core/cookies.ts` | Changed `sameSite: "none"` → `sameSite: "lax"` for CSRF protection. |
| `server/_core/trpc.ts` | Removed `ctx.user!.openId` parameter from `hasPermission()` call. |
| `server/permissions.ts` | Removed `OWNER_OPEN_ID` env var bypass. Root admin is determined solely by `isRootAdmin` flag in the database. |
| `server/db.ts` | Removed auto-admin assignment via `ENV.ownerOpenId`. Role is now set explicitly during registration or by admin. |

## 3. Updated Documentation

| File | What Changed |
|------|-------------|
| `.env.example` | Removed `OAUTH_SERVER_URL` and `OWNER_OPEN_ID` entries |
| `RAILWAY-DEPLOY.md` | Removed OAuth env var rows from the deployment table |
| `DOCUMENTATION.md` | Removed OAuth env var rows |
| `DEVELOPER_GUIDE.md` | Changed "OWNER_OPEN_ID → ALLOW" to "isRootAdmin=true in DB → ALLOW"; removed OAuth env var entries |

## 4. Frontend Changes

| File | What Changed |
|------|-------------|
| `client/src/_core/hooks/useAuth.ts` | Removed `localStorage.setItem("manus-runtime-user-info", ...)` |
| `client/src/pages/AdminHardeningKB.tsx` | Removed `user.openId === (window as any).__OWNER_OPEN_ID__` check from isRootAdmin |

## 5. Removed Config Keys / Env Vars

| Variable | Location | Status |
|----------|----------|--------|
| `OAUTH_SERVER_URL` | `.env.example`, `env.ts`, docs | ❌ Removed |
| `OWNER_OPEN_ID` | `.env.example`, `env.ts`, `permissions.ts`, docs | ❌ Removed |
| `VITE_OAUTH_PORTAL_URL` | Was only in hardening-kb (deleted) | ❌ Removed |

## 6. Security Hardening Summary

| Feature | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with salt factor 12 |
| **Rate Limiting** | 10 attempts per 5 minutes on login/register |
| **Cookie Security** | HttpOnly=true, SameSite=lax, Secure=auto (HTTPS) |
| **JWT Expiry** | ONE_YEAR_MS (configurable via shared/const.ts) |
| **Auth Event Logging** | All login success/failure, register, password change events logged with userId, IP, timestamp |
| **CSRF Protection** | SameSite=lax cookies prevent cross-site request forgery |

## 7. Test Results

```
 ✓ server/oauth-removal.test.ts (16 tests) — ALL PASSED
   ✓ oauth.ts file should NOT exist
   ✓ manusTypes.ts file should NOT exist
   ✓ auth.ts (local auth routes) should exist
   ✓ sdk.ts should NOT contain OAuthService class
   ✓ env.ts should NOT reference oAuthServerUrl or ownerOpenId
   ✓ index.ts should import registerAuthRoutes, NOT registerOAuthRoutes
   ✓ permissions.ts should NOT check OWNER_OPEN_ID env var
   ✓ trpc.ts should NOT pass openId to hasPermission
   ✓ auth.ts should apply rate limiting to login and register
   ✓ auth.ts should log authentication events
   ✓ cookies.ts should use sameSite lax (not none)
   ✓ auth.ts should use bcrypt with salt factor 12
   ✓ .env.example should NOT contain OAUTH_SERVER_URL or OWNER_OPEN_ID
   ✓ auth.ts should NOT have /api/oauth/callback route
   ✓ sdk.ts should NOT import axios
   ✓ useAuth.ts should NOT store manus-runtime-user-info

 ✓ server/auth.logout.test.ts (1 test) — PASSED
   ✓ clears the session cookie and reports success
```

## 8. Verification Checklist

- [x] `server/_core/oauth.ts` deleted
- [x] `server/_core/types/manusTypes.ts` deleted
- [x] `server/_core/auth.ts` created with local-only routes
- [x] `server/_core/sdk.ts` rewritten — no OAuthService, no axios
- [x] `server/_core/env.ts` cleaned — no OAuth env vars
- [x] `server/_core/index.ts` uses `registerAuthRoutes`
- [x] `server/permissions.ts` — no OWNER_OPEN_ID bypass
- [x] `server/db.ts` — no auto-admin via ownerOpenId
- [x] `server/_core/trpc.ts` — no openId in hasPermission
- [x] `server/_core/cookies.ts` — sameSite=lax
- [x] `.env.example` — no OAuth vars
- [x] All documentation updated
- [x] Frontend `useAuth.ts` — no manus-runtime localStorage
- [x] Frontend `AdminHardeningKB.tsx` — no OWNER_OPEN_ID check
- [x] Rate limiting on login/register endpoints
- [x] Auth event logging implemented
- [x] bcrypt with salt factor 12
- [x] 16 automated tests passing
- [x] Zero reachable OAuth endpoints (no `/api/oauth/*` routes)

## 9. Post-Deployment Notes

After deploying to Railway:

1. **Remove env vars from Railway dashboard:** Delete `OAUTH_SERVER_URL` and `OWNER_OPEN_ID` if they exist in the Railway environment settings.
2. **Verify login works:** Test login with userId + password at `/login`.
3. **Verify OAuth routes are gone:** `GET /api/oauth/callback` should return 404.
4. **Check admin access:** Root admin permissions are now controlled solely by `isRootAdmin` flag in the `adminPermissions` database table.
