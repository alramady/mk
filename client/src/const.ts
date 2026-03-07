// App constants — no external dependencies
export const APP_NAME = "المفتاح الشهري";
export const APP_NAME_EN = "Monthly Key";

// Login URL helper — we use Supabase Auth, not Manus OAuth
// This stub satisfies template imports that reference getLoginUrl
export function getLoginUrl(returnPath?: string): string {
  return returnPath ? `/?return=${encodeURIComponent(returnPath)}` : "/";
}
