import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { Loader2, ArrowRight, ArrowLeft, Mail, KeyRound, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";

type Step = "email" | "code" | "newPassword" | "done";

export default function ForgotPassword() {
  const { t, lang, dir } = useI18n();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  // Step 1: Request OTP
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError(lang === "ar" ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          destination: email.trim(),
          purpose: "password_reset",
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(lang === "ar" ? (data.errorAr || data.error) : data.error);
        return;
      }
      // Always show success (no user enumeration)
      toast.success(lang === "ar" ? "تم إرسال رمز التحقق" : "Verification code sent");
      setStep("code");
    } catch {
      setError(lang === "ar" ? "حدث خطأ، حاول مرة أخرى" : "An error occurred, please try again");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError(lang === "ar" ? "يرجى إدخال رمز التحقق" : "Please enter the verification code");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          destination: email.trim(),
          code: code.trim(),
          purpose: "password_reset",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(lang === "ar" ? (data.errorAr || data.error) : data.error);
        return;
      }
      setStep("newPassword");
    } catch {
      setError(lang === "ar" ? "حدث خطأ، حاول مرة أخرى" : "An error occurred, please try again");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(lang === "ar" ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    if (newPassword.length < 12) {
      setError(lang === "ar" ? "كلمة المرور يجب أن تكون 12 حرفاً على الأقل" : "Password must be at least 12 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(lang === "ar" ? (data.errorAr || data.error) : data.error);
        return;
      }
      setStep("done");
      toast.success(lang === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully");
    } catch {
      setError(lang === "ar" ? "حدث خطأ، حاول مرة أخرى" : "An error occurred, please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 dark:from-[#0B1E2D] dark:to-[#0f2a3d] flex items-center justify-center p-4" dir={dir}>
      <SEOHead title="Forgot Password" titleAr="استعادة كلمة المرور" path="/forgot-password" noindex={true} />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <img
              src="/logo-mark.png"
              alt="Monthly Key - المفتاح الشهري"
              className="h-28 sm:h-32 w-auto object-contain mx-auto drop-shadow-lg dark:hidden"
            />
            <img
              src="/logo-mark-light.png"
              alt="Monthly Key - المفتاح الشهري"
              className="h-28 sm:h-32 w-auto object-contain mx-auto drop-shadow-lg hidden dark:block"
            />
          </Link>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C5A55A] to-transparent mx-auto mt-4" />
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-[#0B1E2D] dark:text-foreground">
              {step === "done"
                ? (lang === "ar" ? "تم بنجاح" : "Success")
                : (lang === "ar" ? "استعادة كلمة المرور" : "Reset Password")}
            </CardTitle>
            <CardDescription className="text-base">
              {step === "email" && (lang === "ar" ? "أدخل بريدك الإلكتروني لاستلام رمز التحقق" : "Enter your email to receive a verification code")}
              {step === "code" && (lang === "ar" ? "أدخل رمز التحقق المرسل إلى بريدك" : "Enter the code sent to your email")}
              {step === "newPassword" && (lang === "ar" ? "أدخل كلمة المرور الجديدة" : "Enter your new password")}
              {step === "done" && (lang === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Your password has been reset")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {/* Step 1: Email */}
            {step === "email" && (
              <form onSubmit={handleRequestOTP} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={lang === "ar" ? "أدخل بريدك الإلكتروني" : "Enter your email"}
                      required
                      className="h-11 ps-10 text-end"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === "ar" ? "إرسال رمز التحقق" : "Send Code")}
                </Button>
              </form>
            )}

            {/* Step 2: OTP Code */}
            {step === "code" && (
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-medium">
                    {lang === "ar" ? "رمز التحقق" : "Verification Code"}
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={lang === "ar" ? "أدخل الرمز المكون من 6 أرقام" : "Enter 6-digit code"}
                    required
                    className="h-11 text-center tracking-widest text-lg"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === "ar" ? "تحقق" : "Verify")}
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); setError(""); }}
                  className="w-full text-sm text-gray-500 hover:text-[#3ECFC0] transition-colors"
                >
                  {lang === "ar" ? "إعادة إرسال الرمز" : "Resend code"}
                </button>
              </form>
            )}

            {/* Step 3: New Password */}
            {step === "newPassword" && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium">
                    {lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={lang === "ar" ? "12 حرفاً على الأقل" : "At least 12 characters"}
                    required
                    className="h-11 text-end"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    {lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={lang === "ar" ? "أعد إدخال كلمة المرور" : "Re-enter password"}
                    required
                    className="h-11 text-end"
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === "ar" ? "تغيير كلمة المرور" : "Reset Password")}
                </Button>
              </form>
            )}

            {/* Step 4: Done */}
            {step === "done" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#3ECFC0]/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-[#3ECFC0]" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة" : "You can now log in with your new password"}
                </p>
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-base font-semibold"
                >
                  {lang === "ar" ? "تسجيل الدخول" : "Go to Login"}
                </Button>
              </div>
            )}

            {step !== "done" && (
              <div className="mt-6 text-center text-sm">
                <Link href="/login" className="text-[#3ECFC0] hover:text-[#0B1E2D] font-semibold inline-flex items-center gap-1">
                  <BackArrow className="h-3.5 w-3.5" />
                  {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Login"}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
