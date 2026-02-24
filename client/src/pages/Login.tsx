import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation, useSearch } from "wouter";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";

export default function Login() {
  const { t, lang, dir } = useI18n();
  const [, navigate] = useLocation();
  const search = useSearch();
  const returnTo = new URLSearchParams(search).get("returnTo") || "/";

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(lang === "ar" ? (data.errorAr || data.error) : data.error);
        return;
      }

      toast.success(lang === "ar" ? "تم تسجيل الدخول بنجاح" : "Logged in successfully");
      window.location.href = returnTo;
    } catch (err) {
      setError(t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 flex items-center justify-center p-4" dir={dir}>
      <SEOHead title="Login" titleAr="تسجيل الدخول" path="/login" noindex={true} />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/lDFKiBXvXbLyTkzm.png" 
              alt="Monthly Key - المفتاح الشهري" 
              className="h-32 sm:h-36 w-auto object-contain mx-auto drop-shadow-lg" 
            />
          </Link>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C5A55A] to-transparent mx-auto mt-4" />
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-[#0B1E2D]">
              {t("auth.welcomeBack")}
            </CardTitle>
            <CardDescription className="text-base">
              {t("auth.loginSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="userId" className="text-sm font-medium">
                  {t("auth.userId")}
                </Label>
                <Input
                  id="userId"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={lang === "ar" ? "أدخل معرف المستخدم" : "Enter your user ID"}
                  required
                  className="h-11"
                  autoComplete="username"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t("auth.password")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={lang === "ar" ? "أدخل كلمة المرور" : "Enter your password"}
                    required
                    className="h-11 pe-10"
                    autoComplete="current-password"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D] text-white text-base font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("auth.loginBtn")
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-500">{t("auth.noAccount")}</span>{" "}
              <Link href="/register" className="text-[#3ECFC0] hover:text-[#0B1E2D] font-semibold">
                {t("auth.createAccount")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
