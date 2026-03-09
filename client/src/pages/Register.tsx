import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { Loader2, Eye, EyeOff, Check, Phone, Mail, ChevronLeft, ChevronRight, FileText, Shield } from "lucide-react";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import DOMPurify from "dompurify";

// ─── Country codes for phone input ──────────────────────────────────
const COUNTRY_CODES = [
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia", nameAr: "السعودية" },
  { code: "+971", flag: "🇦🇪", name: "UAE", nameAr: "الإمارات" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain", nameAr: "البحرين" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait", nameAr: "الكويت" },
  { code: "+968", flag: "🇴🇲", name: "Oman", nameAr: "عمان" },
  { code: "+974", flag: "🇶🇦", name: "Qatar", nameAr: "قطر" },
  { code: "+20", flag: "🇪🇬", name: "Egypt", nameAr: "مصر" },
  { code: "+962", flag: "🇯🇴", name: "Jordan", nameAr: "الأردن" },
  { code: "+961", flag: "🇱🇧", name: "Lebanon", nameAr: "لبنان" },
  { code: "+964", flag: "🇮🇶", name: "Iraq", nameAr: "العراق" },
  { code: "+212", flag: "🇲🇦", name: "Morocco", nameAr: "المغرب" },
  { code: "+216", flag: "🇹🇳", name: "Tunisia", nameAr: "تونس" },
  { code: "+213", flag: "🇩🇿", name: "Algeria", nameAr: "الجزائر" },
  { code: "+249", flag: "🇸🇩", name: "Sudan", nameAr: "السودان" },
  { code: "+218", flag: "🇱🇾", name: "Libya", nameAr: "ليبيا" },
  { code: "+967", flag: "🇾🇪", name: "Yemen", nameAr: "اليمن" },
  { code: "+1", flag: "🇺🇸", name: "USA", nameAr: "أمريكا" },
  { code: "+44", flag: "🇬🇧", name: "UK", nameAr: "بريطانيا" },
  { code: "+91", flag: "🇮🇳", name: "India", nameAr: "الهند" },
  { code: "+92", flag: "🇵🇰", name: "Pakistan", nameAr: "باكستان" },
  { code: "+63", flag: "🇵🇭", name: "Philippines", nameAr: "الفلبين" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh", nameAr: "بنغلاديش" },
];

// ─── OTP Input Component ────────────────────────────────────────────
function OtpInput({ length = 6, value, onChange }: { length?: number; value: string; onChange: (v: string) => void }) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const arr = value.split("");
    arr[idx] = char;
    const newVal = arr.join("").slice(0, length);
    onChange(newVal);
    if (char && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    const nextIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[nextIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" dir="ltr">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-11 h-13 text-center text-xl font-bold border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-foreground focus:border-[#3ECFC0] focus:ring-2 focus:ring-[#3ECFC0]/20 outline-none transition-all"
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────────
function StepIndicator({ currentStep, steps, lang }: { currentStep: number; steps: string[]; lang: string }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        return (
          <div key={i} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isDone
                    ? "bg-[#3ECFC0] text-white"
                    : isActive
                    ? "bg-[#0B1E2D] text-white dark:bg-[#3ECFC0]"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-[10px] mt-1 whitespace-nowrap ${isActive || isDone ? "text-foreground font-medium" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 ${isDone ? "bg-[#3ECFC0]" : "bg-gray-200 dark:bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Register Component ────────────────────────────────────────
export default function Register() {
  const { t, lang, dir } = useI18n();
  const { get } = useSiteSettings();

  const [step, setStep] = useState(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [activeDialogTab, setActiveDialogTab] = useState<"terms" | "privacy">("terms");
  const [form, setForm] = useState({
    userId: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    name: "",
    nameAr: "",
    email: "",
    phone: "",
    countryCode: "+966",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // OTP state
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneResendTimer, setPhoneResendTimer] = useState(0);
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  // Countdown timers
  useEffect(() => {
    if (phoneResendTimer <= 0) return;
    const id = setInterval(() => setPhoneResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [phoneResendTimer]);

  useEffect(() => {
    if (emailResendTimer <= 0) return;
    const id = setInterval(() => setEmailResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [emailResendTimer]);

  const fullPhone = `${form.countryCode}${form.phone.replace(/^0+/, "")}`;

  // ─── Terms & Privacy content from CMS ─────────────────────────
  const termsContent = lang === "ar"
    ? get("terms.contentAr", "<p>الشروط والأحكام - يرجى تعديل هذا المحتوى من لوحة التحكم.</p>")
    : get("terms.contentEn", "<p>Terms & Conditions - Please edit this content from the admin panel.</p>");
  const privacyContent = lang === "ar"
    ? get("privacy.contentAr", "<p>سياسة الخصوصية - يرجى تعديل هذا المحتوى من لوحة التحكم.</p>")
    : get("privacy.contentEn", "<p>Privacy Policy - Please edit this content from the admin panel.</p>");

  // ─── Step 1: Create Account ─────────────────────────────────────
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreedToTerms) {
      setError(lang === "ar" ? "يجب الموافقة على الشروط والأحكام وسياسة الخصوصية للمتابعة" : "You must agree to the Terms & Conditions and Privacy Policy to continue");
      return;
    }

    if (form.password.length < 12) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (!form.phone || form.phone.length < 5) {
      setError(lang === "ar" ? "رقم الجوال مطلوب" : "Phone number is required");
      return;
    }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(lang === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId,
          password: form.password,
          displayName: form.displayName,
          name: form.name || form.displayName,
          nameAr: form.nameAr,
          email: form.email,
          phone: fullPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(lang === "ar" ? (data.errorAr || data.error) : data.error);
        return;
      }

      setCreatedUserId(data.userId);
      toast.success(t("auth.accountCreated"));

      // Auto-send phone OTP
      await sendOtp("phone", fullPhone);
      setStep(2);
    } catch (err) {
      setError(lang === "ar" ? "فشل التسجيل" : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // ─── Send OTP ───────────────────────────────────────────────────
  const sendOtp = useCallback(async (channel: "phone" | "email", destination: string) => {
    setOtpSending(true);
    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          destination,
          purpose: "registration",
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = lang === "ar" ? (data.errorAr || data.error) : data.error;
        toast.error(msg);
        return false;
      }
      // Dev mode: show code in toast
      if (data.devCode) {
        toast.info(`[Dev] OTP: ${data.devCode}`, { duration: 15000 });
      }
      if (channel === "phone") setPhoneResendTimer(60);
      else setEmailResendTimer(60);
      return true;
    } catch {
      toast.error(lang === "ar" ? "فشل إرسال الرمز" : "Failed to send code");
      return false;
    } finally {
      setOtpSending(false);
    }
  }, [lang]);

  // ─── Verify OTP ─────────────────────────────────────────────────
  const verifyOtp = async (channel: "phone" | "email", destination: string, code: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          destination,
          code,
          purpose: "registration",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(lang === "ar" ? (data.errorAr || data.error) : data.error);
        return false;
      }

      if (data.fullyVerified) {
        toast.success(t("auth.verificationComplete"));
        setTimeout(() => { window.location.href = "/"; }, 1500);
        return true;
      }

      return true;
    } catch {
      setError(lang === "ar" ? "فشل التحقق" : "Verification failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify Phone ──────────────────────────────────────
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneOtp.length !== 6) {
      setError(lang === "ar" ? "أدخل الرمز المكون من 6 أرقام" : "Enter the 6-digit code");
      return;
    }
    const ok = await verifyOtp("phone", fullPhone, phoneOtp);
    if (ok) {
      // Auto-send email OTP
      await sendOtp("email", form.email);
      setStep(3);
      setError("");
    }
  };

  // ─── Step 3: Verify Email ──────────────────────────────────────
  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailOtp.length !== 6) {
      setError(lang === "ar" ? "أدخل الرمز المكون من 6 أرقام" : "Enter the 6-digit code");
      return;
    }
    await verifyOtp("email", form.email, emailOtp);
  };

  const steps = [t("auth.step1"), t("auth.step2"), t("auth.step3")];
  const selectedCountry = COUNTRY_CODES.find((c) => c.code === form.countryCode) || COUNTRY_CODES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 dark:from-[#0B1E2D] dark:to-[#0f2a3d] flex items-center justify-center p-4" dir={dir}>
      <SEOHead title="Register" titleAr="إنشاء حساب" path="/register" noindex={true} />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-4">
          <Link href="/" className="inline-block">
            <img
              src="/assets/brand/mk-logo-transparent.svg"
              alt="Monthly Key - المفتاح الشهري"
              className="h-20 sm:h-24 w-auto object-contain mx-auto drop-shadow-lg"
            />
          </Link>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C5A55A] to-transparent mx-auto mt-2" />
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-bold text-[#0B1E2D] dark:text-foreground">
              {step === 1 ? t("auth.joinUs") : step === 2 ? t("auth.verifyPhone") : t("auth.verifyEmail")}
            </CardTitle>
            <CardDescription className="text-sm">
              {step === 1
                ? t("auth.registerSubtitle")
                : step === 2
                ? `${t("auth.otpSent")} ${fullPhone}`
                : `${t("auth.otpSent")} ${form.email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StepIndicator currentStep={step} steps={steps} lang={lang} />

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {/* ─── Step 1: Account Form ───────────────────────────── */}
            {step === 1 && (
              <form onSubmit={handleStep1} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="userId">{t("auth.userId")}</Label>
                  <Input
                    id="userId"
                    type="text"
                    value={form.userId}
                    onChange={(e) => update("userId", e.target.value)}
                    placeholder={lang === "ar" ? "اختر معرف المستخدم" : "Choose a user ID"}
                    required
                    className={`h-10 ${lang === "ar" ? "text-right" : "text-left"}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="displayName">{t("auth.displayName")}</Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={form.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                    placeholder={lang === "ar" ? "الاسم الظاهر" : "Display name"}
                    required
                    className="h-10"
                  />
                </div>

                {lang === "ar" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="nameAr">{t("auth.nameAr")}</Label>
                    <Input
                      id="nameAr"
                      type="text"
                      value={form.nameAr}
                      onChange={(e) => { update("nameAr", e.target.value); update("name", e.target.value); }}
                      placeholder="الاسم الكامل بالعربي"
                      required
                      className={`h-10 ${lang === "ar" ? "text-right" : "text-left"}`}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t("auth.nameEn")}</Label>
                    <Input
                      id="name"
                      type="text"
                      value={form.name}
                      onChange={(e) => { update("name", e.target.value); update("nameAr", e.target.value); }}
                      placeholder="Full name"
                      required
                      className="h-10 text-left"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="email@example.com"
                    required
                    className={`h-10 ${lang === "ar" ? "text-right" : "text-left"}`}
                  />
                </div>

                {/* International Phone Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone">{t("auth.phone")}</Label>
                  <div className="flex gap-2" dir="ltr">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                        className="h-10 px-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-foreground flex items-center gap-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[90px]"
                      >
                        <span className="text-lg">{selectedCountry.flag}</span>
                        <span className="font-mono text-xs">{selectedCountry.code}</span>
                      </button>
                      {showCountryPicker && (
                        <div className="absolute top-full mt-1 start-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto w-56">
                          {COUNTRY_CODES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { update("countryCode", c.code); setShowCountryPicker(false); }}
                              className={`w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-foreground ${
                                c.code === form.countryCode ? "bg-[#3ECFC0]/10" : ""
                              }`}
                            >
                              <span className="text-lg">{c.flag}</span>
                              <span className="font-mono text-xs">{c.code}</span>
                              <span className="text-gray-500 text-xs">{lang === "ar" ? c.nameAr : c.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="5XXXXXXXX"
                      required
                      className="h-10 flex-1 text-start"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder={lang === "ar" ? "12 حرف على الأقل" : "At least 12 characters"}
                      required
                      className={`h-10 pe-10 ${lang === "ar" ? "text-right" : "text-left"}`}
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

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    placeholder={lang === "ar" ? "أعد إدخال كلمة المرور" : "Re-enter password"}
                    required
                    className={`h-10 ${lang === "ar" ? "text-right" : "text-left"}`}
                  />
                </div>

                {/* ─── Terms & Privacy Agreement ─────────────── */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
                    <Checkbox
                      id="terms-agreement"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                      className="mt-0.5 data-[state=checked]:bg-[#3ECFC0] data-[state=checked]:border-[#3ECFC0]"
                    />
                    <label htmlFor="terms-agreement" className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                      {lang === "ar" ? (
                        <>
                          أوافق على{" "}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setActiveDialogTab("terms"); setShowTermsDialog(true); }}
                            className="text-[#3ECFC0] hover:text-[#2ab5a6] font-semibold underline underline-offset-2"
                          >
                            الشروط والأحكام
                          </button>
                          {" "}و{" "}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setActiveDialogTab("privacy"); setShowTermsDialog(true); }}
                            className="text-[#3ECFC0] hover:text-[#2ab5a6] font-semibold underline underline-offset-2"
                          >
                            سياسة الخصوصية
                          </button>
                        </>
                      ) : (
                        <>
                          I agree to the{" "}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setActiveDialogTab("terms"); setShowTermsDialog(true); }}
                            className="text-[#3ECFC0] hover:text-[#2ab5a6] font-semibold underline underline-offset-2"
                          >
                            Terms & Conditions
                          </button>
                          {" "}and{" "}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setActiveDialogTab("privacy"); setShowTermsDialog(true); }}
                            className="text-[#3ECFC0] hover:text-[#2ab5a6] font-semibold underline underline-offset-2"
                          >
                            Privacy Policy
                          </button>
                        </>
                      )}
                    </label>
                  </div>
                  {!agreedToTerms && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                      <Shield className="w-3 h-3" />
                      <span>{lang === "ar" ? "يجب الموافقة على الشروط والأحكام للمتابعة" : "You must agree to the terms to continue"}</span>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-base font-semibold mt-2"
                  disabled={loading || !agreedToTerms}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {t("auth.nextStep")}
                      {lang === "ar" ? <ChevronLeft className="w-4 h-4 ms-1" /> : <ChevronRight className="w-4 h-4 ms-1" />}
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* ─── Terms & Privacy Dialog ─────────────────────── */}
            <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
              <DialogContent className="max-w-lg max-h-[85vh] p-0 overflow-hidden" dir={dir}>
                <DialogHeader className="px-6 pt-5 pb-0">
                  <DialogTitle className="text-lg font-bold text-[#0B1E2D] dark:text-foreground">
                    {activeDialogTab === "terms"
                      ? (lang === "ar" ? "الشروط والأحكام" : "Terms & Conditions")
                      : (lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy")}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500">
                    {lang === "ar" ? "يرجى قراءة المحتوى بعناية" : "Please read carefully"}
                  </DialogDescription>
                </DialogHeader>
                {/* Tab switcher */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
                  <button
                    type="button"
                    onClick={() => setActiveDialogTab("terms")}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeDialogTab === "terms"
                        ? "border-[#3ECFC0] text-[#3ECFC0]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {lang === "ar" ? "الشروط والأحكام" : "Terms"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDialogTab("privacy")}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeDialogTab === "privacy"
                        ? "border-[#3ECFC0] text-[#3ECFC0]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {lang === "ar" ? "سياسة الخصوصية" : "Privacy"}
                  </button>
                </div>
                <ScrollArea className="h-[55vh] px-6 py-4">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        activeDialogTab === "terms" ? termsContent : privacyContent
                      ),
                    }}
                  />
                </ScrollArea>
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTermsDialog(false)}
                    className="text-sm"
                  >
                    {lang === "ar" ? "إغلاق" : "Close"}
                  </Button>
                  {!agreedToTerms && (
                    <Button
                      size="sm"
                      className="bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-sm"
                      onClick={() => { setAgreedToTerms(true); setShowTermsDialog(false); }}
                    >
                      {lang === "ar" ? "أوافق على الشروط" : "I Agree"}
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* ─── Step 2: Phone OTP ──────────────────────────────── */}
            {step === 2 && (
              <form onSubmit={handleStep2} className="space-y-5">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-[#3ECFC0]/10 flex items-center justify-center">
                    <Phone className="w-7 h-7 text-[#3ECFC0]" />
                  </div>
                </div>

                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  {t("auth.enterOtp")}
                </div>

                <OtpInput value={phoneOtp} onChange={setPhoneOtp} />

                <div className="text-center">
                  {phoneResendTimer > 0 ? (
                    <span className="text-sm text-gray-400">
                      {t("auth.resendIn")} {phoneResendTimer} {t("auth.seconds")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendOtp("phone", fullPhone)}
                      disabled={otpSending}
                      className="text-sm text-[#3ECFC0] hover:text-[#2ab5a6] font-medium disabled:opacity-50"
                    >
                      {otpSending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t("auth.resendOtp")}
                    </button>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-base font-semibold"
                  disabled={loading || phoneOtp.length !== 6}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("auth.verifyBtn")}
                </Button>
              </form>
            )}

            {/* ─── Step 3: Email OTP ──────────────────────────────── */}
            {step === 3 && (
              <form onSubmit={handleStep3} className="space-y-5">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-[#3ECFC0]/10 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-[#3ECFC0]" />
                  </div>
                </div>

                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  {t("auth.enterOtp")}
                </div>

                <OtpInput value={emailOtp} onChange={setEmailOtp} />

                <div className="text-center">
                  {emailResendTimer > 0 ? (
                    <span className="text-sm text-gray-400">
                      {t("auth.resendIn")} {emailResendTimer} {t("auth.seconds")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendOtp("email", form.email)}
                      disabled={otpSending}
                      className="text-sm text-[#3ECFC0] hover:text-[#2ab5a6] font-medium disabled:opacity-50"
                    >
                      {otpSending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t("auth.resendOtp")}
                    </button>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-white text-base font-semibold"
                  disabled={loading || emailOtp.length !== 6}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("auth.verifyBtn")}
                </Button>
              </form>
            )}

            {step === 1 && (
              <div className="mt-4 text-center text-sm">
                <span className="text-gray-500">{t("auth.hasAccount")}</span>{" "}
                <Link href="/login" className="text-[#3ECFC0] hover:text-[#0B1E2D] font-semibold">
                  {t("auth.loginHere")}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
