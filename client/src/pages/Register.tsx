import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { t, lang, dir } = useI18n();

  const [form, setForm] = useState({
    userId: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    name: "",
    nameAr: "",
    email: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId,
          password: form.password,
          displayName: form.displayName,
          name: form.name || form.displayName,
          nameAr: form.nameAr,
          email: form.email,
          phone: form.phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(lang === "ar" ? (data.errorAr || data.error) : data.error);
        return;
      }

      toast.success(lang === "ar" ? "تم إنشاء الحساب بنجاح" : "Account created successfully");
      window.location.href = "/";
    } catch (err) {
      setError(lang === "ar" ? "فشل التسجيل" : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 flex items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-[#0B1E2D] rounded-xl flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-[#0B1E2D] font-heading">
              Monthly Key
            </span>
          </Link>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-[#0B1E2D]">
              {t("auth.joinUs")}
            </CardTitle>
            <CardDescription className="text-base">
              {t("auth.registerSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="userId">{t("auth.userId")}</Label>
                <Input
                  id="userId"
                  type="text"
                  value={form.userId}
                  onChange={(e) => update("userId", e.target.value)}
                  placeholder={lang === "ar" ? "اختر معرف المستخدم" : "Choose a user ID"}
                  required
                  className="h-11"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">{t("auth.displayName")}</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={form.displayName}
                  onChange={(e) => update("displayName", e.target.value)}
                  placeholder={lang === "ar" ? "الاسم الظاهر" : "Display name"}
                  required
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("auth.fullName")} (EN)</Label>
                  <Input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Full name"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameAr">{t("auth.fullName")} (AR)</Label>
                  <Input
                    id="nameAr"
                    type="text"
                    value={form.nameAr}
                    onChange={(e) => update("nameAr", e.target.value)}
                    placeholder="الاسم بالعربي"
                    className="h-11"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="email@example.com"
                  className="h-11"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+966504466528"
                  className="h-11"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder={lang === "ar" ? "6 أحرف على الأقل" : "At least 6 characters"}
                    required
                    className="h-11 pe-10"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  placeholder={lang === "ar" ? "أعد إدخال كلمة المرور" : "Re-enter password"}
                  required
                  className="h-11"
                  dir="ltr"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D] text-white text-base font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("auth.registerBtn")
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-500">{t("auth.hasAccount")}</span>{" "}
              <Link href="/login" className="text-[#3ECFC0] hover:text-[#0B1E2D] font-semibold">
                {t("auth.loginHere")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
