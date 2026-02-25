/**
 * Verification Stepper — MonthlyKey
 *
 * Two-step OTP verification flow:
 *   Step 1: Verify Phone (SMS OTP)
 *   Step 2: Verify Email (Email OTP)
 *
 * Features:
 *   - 6-digit code input with paste support
 *   - 60-second resend countdown
 *   - Locale-aware messaging (AR/EN)
 *   - Auto-advance on both verified
 *   - Skip to home if already verified
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

type Step = "phone" | "email";

export default function Verify() {
  const navigate = useNavigate();
  const { t, dir, locale } = useLocale();
  const { user, token, isPendingVerification, refreshUser, logout } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if not authenticated or already verified
  useEffect(() => {
    if (!token || !user) {
      navigate("/login");
      return;
    }
    if (user.phone_verified) setPhoneVerified(true);
    if (user.email_verified) setEmailVerified(true);
    if (user.verification_state === "VERIFIED") {
      navigate("/");
    }
  }, [token, user, navigate]);

  // Auto-advance step when phone is verified
  useEffect(() => {
    if (phoneVerified && !emailVerified) {
      setStep("email");
      resetCode();
      setError("");
      setSuccess("");
    }
    if (phoneVerified && emailVerified) {
      navigate("/");
    }
  }, [phoneVerified, emailVerified, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function resetCode() {
    setCode(Array(CODE_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  }

  // ─── Send OTP ─────────────────────────────────────────────
  const sendOtp = useCallback(
    async (channel: Step) => {
      if (sending || cooldown > 0) return;
      setSending(true);
      setError("");
      setSuccess("");

      try {
        const res = await fetch(`${API_BASE}/auth/verification/${channel}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.cooldown_remaining) {
            setCooldown(data.cooldown_remaining);
          }
          setError(data.message || t("فشل في إرسال الرمز", "Failed to send code"));
          return;
        }

        setCooldown(COOLDOWN_SECONDS);
        setSuccess(
          channel === "phone"
            ? t("تم إرسال الرمز إلى هاتفك", "Code sent to your phone")
            : t("تم إرسال الرمز إلى بريدك الإلكتروني", "Code sent to your email"),
        );
      } catch {
        setError(t("خطأ في الشبكة", "Network error"));
      } finally {
        setSending(false);
      }
    },
    [sending, cooldown, token, t],
  );

  // Auto-send OTP when step changes
  useEffect(() => {
    if (step === "phone" && !phoneVerified) {
      sendOtp("phone");
    } else if (step === "email" && !emailVerified) {
      sendOtp("email");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Verify OTP ───────────────────────────────────────────
  async function handleVerify() {
    const codeStr = code.join("");
    if (codeStr.length !== CODE_LENGTH) {
      setError(t("أدخل الرمز المكون من 6 أرقام", "Enter the 6-digit code"));
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/verification/${step}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: codeStr }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || t("رمز غير صحيح", "Invalid code"));
        return;
      }

      // Mark as verified
      if (step === "phone") {
        setPhoneVerified(true);
        setSuccess(t("تم التحقق من الهاتف بنجاح", "Phone verified successfully"));
      } else {
        setEmailVerified(true);
        setSuccess(t("تم التحقق من البريد بنجاح", "Email verified successfully"));
      }

      await refreshUser();
    } catch {
      setError(t("خطأ في الشبكة", "Network error"));
    } finally {
      setVerifying(false);
    }
  }

  // ─── Code Input Handlers ──────────────────────────────────
  function handleCodeChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every((d) => d !== "") && newCode.join("").length === CODE_LENGTH) {
      setTimeout(() => handleVerify(), 100);
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;

    const newCode = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);

    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();

    if (pasted.length === CODE_LENGTH) {
      setTimeout(() => handleVerify(), 100);
    }
  }

  // ─── Masked destination ───────────────────────────────────
  const maskedPhone = user?.phone_e164
    ? user.phone_e164.slice(0, 4) + "****" + user.phone_e164.slice(-2)
    : "****";
  const maskedEmail = user?.email
    ? user.email.slice(0, 2) + "***@" + user.email.split("@")[1]
    : "***@***";

  // ─── Render ───────────────────────────────────────────────
  return (
    <div
      dir={dir}
      className="min-h-screen bg-gradient-to-br from-mk-navy via-[#0f2a3d] to-mk-dark flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/mark-header-gold.png"
            alt="MonthlyKey"
            className="mx-auto mb-3 h-14 w-auto"
          />
          <h1 className="text-xl font-bold text-white">
            {t("التحقق من الحساب", "Account Verification")}
          </h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <StepIndicator
            number={1}
            label={t("الهاتف", "Phone")}
            active={step === "phone"}
            completed={phoneVerified}
          />
          <div className={`h-0.5 w-10 rounded ${phoneVerified ? "bg-mk-teal" : "bg-gray-600"}`} />
          <StepIndicator
            number={2}
            label={t("البريد", "Email")}
            active={step === "email"}
            completed={emailVerified}
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Step description */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-mk-teal/10 flex items-center justify-center">
              {step === "phone" ? (
                <svg className="w-7 h-7 text-mk-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-mk-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              {step === "phone"
                ? t("التحقق من رقم الهاتف", "Verify Phone Number")
                : t("التحقق من البريد الإلكتروني", "Verify Email Address")}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === "phone"
                ? t(`أدخل الرمز المرسل إلى ${maskedPhone}`, `Enter the code sent to ${maskedPhone}`)
                : t(`أدخل الرمز المرسل إلى ${maskedEmail}`, `Enter the code sent to ${maskedEmail}`)}
            </p>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-600 text-sm text-center">
              {error}
            </div>
          )}
          {success && !error && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-600 text-sm text-center">
              {success}
            </div>
          )}

          {/* 6-digit code input */}
          <div className="flex justify-center gap-2 mb-6" dir="ltr">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  digit
                    ? "border-mk-teal bg-mk-teal/5 focus:ring-mk-teal/30"
                    : "border-gray-200 focus:ring-mk-teal/30 focus:border-mk-teal"
                }`}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={verifying || code.join("").length !== CODE_LENGTH}
            className="w-full bg-mk-teal text-white py-3 rounded-xl font-medium hover:bg-mk-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {verifying && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t("تحقق", "Verify")}
          </button>

          {/* Resend */}
          <div className="text-center mt-4">
            {cooldown > 0 ? (
              <p className="text-sm text-gray-400">
                {t("إعادة الإرسال بعد", "Resend in")}{" "}
                <span className="font-mono text-mk-teal">{cooldown}</span>{" "}
                {t("ثانية", "seconds")}
              </p>
            ) : (
              <button
                onClick={() => {
                  resetCode();
                  sendOtp(step);
                }}
                disabled={sending}
                className="text-sm text-mk-teal hover:text-mk-teal/80 transition-colors font-medium disabled:opacity-50"
              >
                {sending
                  ? t("جاري الإرسال...", "Sending...")
                  : t("إعادة إرسال الرمز", "Resend Code")}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            {t("تسجيل الخروج", "Sign Out")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────
function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          completed
            ? "bg-mk-teal text-white"
            : active
              ? "bg-mk-teal/20 text-mk-teal border-2 border-mk-teal"
              : "bg-gray-700 text-gray-400"
        }`}
      >
        {completed ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <span
        className={`text-xs ${
          completed ? "text-mk-teal" : active ? "text-white" : "text-gray-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
