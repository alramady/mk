/**
 * Signup Page — MonthlyKey
 *
 * Locale-driven registration form:
 *   - ar: full_name_ar required, full_name_en optional (collapsed)
 *   - en: full_name_en required, full_name_ar optional (collapsed)
 *
 * Includes international phone input with country selector (E.164),
 * password + confirm, and email field.
 *
 * On success → redirects to /verify for OTP stepper.
 */
import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth, type RegisterData } from "../contexts/AuthContext";

// ─── Country codes for phone selector ─────────────────────────
const COUNTRIES = [
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia", nameAr: "السعودية" },
  { code: "+971", flag: "🇦🇪", name: "UAE", nameAr: "الإمارات" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain", nameAr: "البحرين" },
  { code: "+968", flag: "🇴🇲", name: "Oman", nameAr: "عُمان" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait", nameAr: "الكويت" },
  { code: "+974", flag: "🇶🇦", name: "Qatar", nameAr: "قطر" },
  { code: "+20", flag: "🇪🇬", name: "Egypt", nameAr: "مصر" },
  { code: "+962", flag: "🇯🇴", name: "Jordan", nameAr: "الأردن" },
  { code: "+1", flag: "🇺🇸", name: "USA", nameAr: "أمريكا" },
  { code: "+44", flag: "🇬🇧", name: "UK", nameAr: "بريطانيا" },
] as const;

// ─── Validation helpers ───────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ARABIC_RE = /[\u0600-\u06FF]/;
const PHONE_DIGITS_RE = /^\d{7,12}$/;

interface FormErrors {
  fullNameAr?: string;
  fullNameEn?: string;
  email?: string;
  phone?: string;
  password?: string;
  passwordConfirm?: string;
  general?: string;
}

export default function Signup() {
  const navigate = useNavigate();
  const { locale, t, dir } = useLocale();
  const { register } = useAuth();

  // Form state
  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+966");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const selectedCountry = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  );

  // ─── Validate ─────────────────────────────────────────────
  function validate(): FormErrors {
    const e: FormErrors = {};

    // Name validation based on locale
    if (locale === "ar") {
      if (!fullNameAr.trim() || fullNameAr.trim().length < 2) {
        e.fullNameAr = "الاسم الكامل بالعربي مطلوب (حرفين على الأقل)";
      } else if (!ARABIC_RE.test(fullNameAr)) {
        e.fullNameAr = "الاسم يجب أن يحتوي على حروف عربية";
      }
    } else {
      if (!fullNameEn.trim() || fullNameEn.trim().length < 2) {
        e.fullNameEn = "Full name is required (at least 2 characters)";
      }
    }

    if (!email.trim() || !EMAIL_RE.test(email)) {
      e.email = t("البريد الإلكتروني غير صالح", "Invalid email address");
    }

    if (!phoneLocal.trim() || !PHONE_DIGITS_RE.test(phoneLocal.replace(/\s/g, ""))) {
      e.phone = t("رقم الهاتف غير صالح", "Invalid phone number");
    }

    if (!password || password.length < 8) {
      e.password = t(
        "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
        "Password must be at least 8 characters",
      );
    }

    if (password !== passwordConfirm) {
      e.passwordConfirm = t("كلمات المرور غير متطابقة", "Passwords do not match");
    }

    return e;
  }

  // ─── Submit ───────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    const phoneE164 = countryCode + phoneLocal.replace(/\s/g, "");

    const body: RegisterData = {
      preferred_locale: locale,
      email: email.trim().toLowerCase(),
      phone_e164: phoneE164,
      password,
    };

    if (fullNameAr.trim()) body.full_name_ar = fullNameAr.trim();
    if (fullNameEn.trim()) body.full_name_en = fullNameEn.trim();

    const result = await register(body);
    setLoading(false);

    if (result.success) {
      navigate("/verify");
    } else {
      setErrors({ general: result.error });
    }
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div
      dir={dir}
      className="min-h-screen bg-gradient-to-br from-mk-navy via-[#0f2a3d] to-mk-dark flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        {/* Logo + Title */}
        <div className="text-center mb-6">
          <img
            src="/mark-header-gold.png"
            alt="MonthlyKey"
            className="mx-auto mb-3 h-14 w-auto"
          />
          <h1 className="text-xl font-bold text-white">
            {t("إنشاء حساب جديد", "Create Account")}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {t("المفتاح الشهري — منصة التأجير الشهري", "Monthly Key — Monthly Rental Platform")}
          </p>
        </div>

        {/* Error banner */}
        {errors.general && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm text-center">
            {errors.general}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
          noValidate
        >
          {/* ── Required name field ─────────────────────────── */}
          {locale === "ar" ? (
            <Field
              label="الاسم الكامل (عربي)"
              value={fullNameAr}
              onChange={setFullNameAr}
              error={errors.fullNameAr}
              placeholder="محمد أحمد العلي"
              dir="rtl"
              required
            />
          ) : (
            <Field
              label="Full Name (English)"
              value={fullNameEn}
              onChange={setFullNameEn}
              error={errors.fullNameEn}
              placeholder="Mohammed Ahmed"
              dir="ltr"
              required
            />
          )}

          {/* ── Optional name field (collapsible) ──────────── */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="text-sm text-mk-teal hover:text-mk-teal/80 transition-colors flex items-center gap-1"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showOptional ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {locale === "ar"
                ? `Full name (English) — ${t("اختياري", "Optional")}`
                : `الاسم الكامل (عربي) — ${t("اختياري", "Optional")}`}
            </button>

            {showOptional && (
              <div className="mt-2">
                {locale === "ar" ? (
                  <Field
                    label="Full Name (English)"
                    value={fullNameEn}
                    onChange={setFullNameEn}
                    placeholder="Mohammed Ahmed"
                    dir="ltr"
                  />
                ) : (
                  <Field
                    label="الاسم الكامل (عربي)"
                    value={fullNameAr}
                    onChange={setFullNameAr}
                    placeholder="محمد أحمد العلي"
                    dir="rtl"
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Email ──────────────────────────────────────── */}
          <Field
            label={t("البريد الإلكتروني", "Email")}
            value={email}
            onChange={setEmail}
            error={errors.email}
            placeholder="email@example.com"
            type="email"
            dir="ltr"
            required
          />

          {/* ── Phone with country selector ────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("رقم الهاتف", "Phone Number")} <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {/* Country picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryPicker(!showCountryPicker)}
                  className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 hover:bg-gray-100 transition-colors min-w-[100px]"
                >
                  <span>{selectedCountry.flag}</span>
                  <span className="text-gray-700 font-mono">{selectedCountry.code}</span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCountryPicker && (
                  <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCountryCode(c.code);
                          setShowCountryPicker(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          c.code === countryCode ? "bg-mk-teal/5 text-mk-teal" : "text-gray-700"
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span className="font-mono">{c.code}</span>
                        <span className="text-gray-400 text-xs">
                          {locale === "ar" ? c.nameAr : c.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone input */}
              <input
                type="tel"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s]/g, ""))}
                placeholder="501234567"
                dir="ltr"
                className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors ${
                  errors.phone
                    ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                    : "border-gray-200 focus:ring-mk-teal/30 focus:border-mk-teal"
                }`}
              />
            </div>
            {errors.phone && (
              <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
            )}
          </div>

          {/* ── Password ───────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("كلمة المرور", "Password")} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors pe-10 ${
                  errors.password
                    ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                    : "border-gray-200 focus:ring-mk-teal/30 focus:border-mk-teal"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
            <p className="text-gray-400 text-xs mt-1">
              {t("8 أحرف على الأقل", "At least 8 characters")}
            </p>
          </div>

          {/* ── Confirm Password ───────────────────────────── */}
          <Field
            label={t("تأكيد كلمة المرور", "Confirm Password")}
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            error={errors.passwordConfirm}
            placeholder="••••••••"
            type="password"
            dir="ltr"
            required
          />

          {/* ── Submit ─────────────────────────────────────── */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mk-teal text-white py-3 rounded-xl font-medium hover:bg-mk-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t("إنشاء الحساب", "Create Account")}
          </button>
        </form>

        {/* ── Footer links ─────────────────────────────────── */}
        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-gray-400">
            {t("لديك حساب بالفعل؟", "Already have an account?")}{" "}
            <Link to="/login" className="text-mk-teal hover:text-mk-teal/80 transition-colors font-medium">
              {t("تسجيل الدخول", "Sign In")}
            </Link>
          </p>
          <Link
            to="/"
            className="block text-sm text-gray-500 hover:text-white transition-colors"
          >
            {t("العودة للرئيسية", "Back to Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Field Component ─────────────────────────────────
function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  dir = "ltr",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  dir?: "ltr" | "rtl";
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors ${
          error
            ? "border-red-300 focus:ring-red-200 focus:border-red-400"
            : "border-gray-200 focus:ring-mk-teal/30 focus:border-mk-teal"
        }`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
