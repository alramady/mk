/**
 * OAuth Removal Verification Tests
 * 
 * These tests verify that external OAuth has been completely removed
 * and that Local Auth (userId + password) is the only authentication method.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const SERVER_DIR = path.resolve(__dirname);
const ROOT_DIR = path.resolve(__dirname, "..");

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function getAllTsFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (entry.isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("OAuth Removal Verification", () => {
  // ─── 1. Deleted Files ─────────────────────────────────────────────
  it("oauth.ts file should NOT exist", () => {
    const oauthPath = path.join(SERVER_DIR, "_core", "oauth.ts");
    expect(fs.existsSync(oauthPath)).toBe(false);
  });

  it("externalTypes.ts file should NOT exist", () => {
    const typesPath = path.join(SERVER_DIR, "_core", "types", "externalTypes.ts");
    expect(fs.existsSync(typesPath)).toBe(false);
  });

  // ─── 2. New Auth File Exists ──────────────────────────────────────
  it("auth.ts (local auth routes) should exist", () => {
    const authPath = path.join(SERVER_DIR, "_core", "auth.ts");
    expect(fs.existsSync(authPath)).toBe(true);
  });

  // ─── 3. No OAuth Class in SDK ─────────────────────────────────────
  it("sdk.ts should NOT contain OAuthService class", () => {
    const sdkContent = readFileIfExists(path.join(SERVER_DIR, "_core", "sdk.ts"));
    expect(sdkContent).not.toBeNull();
    expect(sdkContent).not.toContain("class OAuthService");
    expect(sdkContent).not.toContain("ExchangeToken");
    expect(sdkContent).not.toContain("getUserInfoByToken");
    expect(sdkContent).not.toContain("getUserInfoWithJwt");
    expect(sdkContent).not.toContain("getTokenByCode");
  });

  // ─── 4. No OAuth Env Vars in env.ts ───────────────────────────────
  it("env.ts should NOT reference oAuthServerUrl or ownerOpenId", () => {
    const envContent = readFileIfExists(path.join(SERVER_DIR, "_core", "env.ts"));
    expect(envContent).not.toBeNull();
    expect(envContent).not.toContain("oAuthServerUrl");
    expect(envContent).not.toContain("ownerOpenId");
    expect(envContent).not.toContain("isLocalMode");
    expect(envContent).not.toContain("OAUTH_SERVER_URL");
    expect(envContent).not.toContain("OWNER_OPEN_ID");
  });

  // ─── 5. Index.ts Uses registerAuthRoutes ──────────────────────────
  it("index.ts should import registerAuthRoutes, NOT registerOAuthRoutes", () => {
    const indexContent = readFileIfExists(path.join(SERVER_DIR, "_core", "index.ts"));
    expect(indexContent).not.toBeNull();
    expect(indexContent).toContain("registerAuthRoutes");
    expect(indexContent).not.toContain("registerOAuthRoutes");
  });

  // ─── 6. Permissions Do Not Use OWNER_OPEN_ID ──────────────────────
  it("permissions.ts should NOT check OWNER_OPEN_ID env var", () => {
    const permContent = readFileIfExists(path.join(SERVER_DIR, "permissions.ts"));
    expect(permContent).not.toBeNull();
    expect(permContent).not.toContain("process.env.OWNER_OPEN_ID");
    expect(permContent).not.toContain("userOpenId");
  });

  // ─── 7. trpc.ts Does Not Pass openId to hasPermission ─────────────
  it("trpc.ts should NOT pass openId to hasPermission", () => {
    const trpcContent = readFileIfExists(path.join(SERVER_DIR, "_core", "trpc.ts"));
    expect(trpcContent).not.toBeNull();
    // Should call hasPermission(userId, permission) without openId
    expect(trpcContent).not.toContain("ctx.user!.openId");
  });

  // ─── 8. Auth Routes Have Rate Limiting ─────────────────────────────
  it("auth.ts should apply rate limiting to login and register", () => {
    const authContent = readFileIfExists(path.join(SERVER_DIR, "_core", "auth.ts"));
    expect(authContent).not.toBeNull();
    expect(authContent).toContain("rateLimiter.check");
    expect(authContent).toContain("auth:login:");
    expect(authContent).toContain("auth:register:");
  });

  // ─── 9. Auth Routes Have Event Logging ─────────────────────────────
  it("auth.ts should log authentication events", () => {
    const authContent = readFileIfExists(path.join(SERVER_DIR, "_core", "auth.ts"));
    expect(authContent).not.toBeNull();
    expect(authContent).toContain("logAuthEvent");
    expect(authContent).toContain("LOGIN_SUCCESS");
    expect(authContent).toContain("LOGIN_FAILED");
    expect(authContent).toContain("REGISTER_SUCCESS");
    expect(authContent).toContain("PASSWORD_CHANGE_SUCCESS");
  });

  // ─── 10. Cookie Settings Are Secure ────────────────────────────────
  it("cookies.ts should use sameSite lax (not none)", () => {
    const cookieContent = readFileIfExists(path.join(SERVER_DIR, "_core", "cookies.ts"));
    expect(cookieContent).not.toBeNull();
    expect(cookieContent).toContain("sameSite: \"lax\"");
    expect(cookieContent).toContain("httpOnly: true");
    expect(cookieContent).not.toMatch(/sameSite:\s*["']none["']/);
  });

  // ─── 11. Password Hashing Uses bcrypt ──────────────────────────────
  it("auth.ts should use bcrypt with salt factor 12", () => {
    const authContent = readFileIfExists(path.join(SERVER_DIR, "_core", "auth.ts"));
    expect(authContent).not.toBeNull();
    expect(authContent).toContain("bcrypt.genSalt(12)");
    expect(authContent).toContain("bcrypt.hash(");
    expect(authContent).toContain("bcrypt.compare(");
  });

  // ─── 12. .env.example Has No OAuth Vars ────────────────────────────
  it(".env.example should NOT contain OAUTH_SERVER_URL or OWNER_OPEN_ID", () => {
    const envExample = readFileIfExists(path.join(ROOT_DIR, ".env.example"));
    expect(envExample).not.toBeNull();
    expect(envExample).not.toContain("OAUTH_SERVER_URL");
    expect(envExample).not.toContain("OWNER_OPEN_ID");
  });

  // ─── 13. No OAuth Callback Route ──────────────────────────────────
  it("auth.ts should NOT have /api/oauth/callback route", () => {
    const authContent = readFileIfExists(path.join(SERVER_DIR, "_core", "auth.ts"));
    expect(authContent).not.toBeNull();
    expect(authContent).not.toContain('"/api/oauth/callback"');
    expect(authContent).not.toContain("app.get(\"/api/oauth");
  });

  // ─── 14. No Axios Import in SDK (was used for OAuth HTTP calls) ────
  it("sdk.ts should NOT import axios (no external HTTP calls needed)", () => {
    const sdkContent = readFileIfExists(path.join(SERVER_DIR, "_core", "sdk.ts"));
    expect(sdkContent).not.toBeNull();
    expect(sdkContent).not.toContain("import axios");
    expect(sdkContent).not.toContain("from \"axios\"");
  });

  // ─── 15. Frontend Has No OAuth References ──────────────────────────
  it("useAuth.ts should NOT store runtime-user-info", () => {
    const useAuthPath = path.join(ROOT_DIR, "client", "src", "_core", "hooks", "useAuth.ts");
    const content = readFileIfExists(useAuthPath);
    expect(content).not.toBeNull();
    expect(content).not.toContain("runtime-user-info");
  });
});
