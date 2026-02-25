import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { t, dir } = useLocale();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || t("فشل تسجيل الدخول", "Login failed"));
    }
  };

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-mk-navy via-[#0f2a3d] to-mk-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/mark-header-gold.png"
            alt="MonthlyKey"
            className="mx-auto mb-4 h-16 w-auto"
          />
          <h1 className="text-2xl font-bold text-white">
            {t("المفتاح الشهري", "Monthly Key")}
          </h1>
          <p className="text-gray-400 mt-1">
            {t("تسجيل الدخول لحسابك", "Sign in to your account")}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("البريد الإلكتروني", "Email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("كلمة المرور", "Password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal"
              required
            />
          </div>
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
            {t("تسجيل الدخول", "Sign In")}
          </button>
        </form>

        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-gray-400">
            {t("ليس لديك حساب؟", "Don't have an account?")}{" "}
            <Link to="/signup" className="text-mk-teal hover:text-mk-teal/80 transition-colors font-medium">
              {t("إنشاء حساب", "Sign Up")}
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
