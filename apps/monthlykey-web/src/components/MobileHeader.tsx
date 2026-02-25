import { Search, Menu, X, Globe, User, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth } from "../contexts/AuthContext";

/**
 * MobileHeader — premium 2-row header for MonthlyKey.
 * Auth-aware: shows user info when logged in, login CTA when logged out.
 * Manager actions (List Property) only visible to OWNER/OPS_MANAGER/ADMIN roles.
 */

interface MobileHeaderProps {
  transparent?: boolean;
  hideSearch?: boolean;
}

export default function MobileHeader({ transparent = false, hideSearch = false }: MobileHeaderProps) {
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLocale();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const isManager = user?.role === "OWNER" || user?.role === "OPS_MANAGER" || user?.role === "ADMIN";

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const toggleLang = () => {
    setLocale(locale === "ar" ? "en" : "ar");
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  const bgClass = transparent
    ? "bg-transparent absolute top-0 inset-x-0 z-50"
    : "bg-mk-navy sticky top-0 z-50 shadow-sm";

  return (
    <header className={bgClass} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Row A: Controls + Logo + Controls */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Hamburger (mobile) */}
        <div className="flex items-center gap-2 w-20 md:w-auto">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={t("القائمة", "Menu")}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {/* Desktop: logo */}
          <Link to="/" className="hidden md:flex items-center gap-2.5 shrink-0">
            <MKLogo size={34} />
            <span className="font-bold text-white text-sm">
              {t("المفتاح الشهري", "Monthly Key")}
            </span>
          </Link>
        </div>

        {/* Center: Logo (mobile only) */}
        <Link to="/" className="md:hidden flex items-center gap-2 shrink-0">
          <MKLogo size={26} />
          <span className="font-bold text-white text-xs">
            {t("المفتاح الشهري", "Monthly Key")}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <Link to="/search" className="hover:text-white transition-colors">
            {t("تصفح العقارات", "Browse Properties")}
          </Link>
          <Link to="/" className="hover:text-white transition-colors">
            {t("كيف نعمل", "How It Works")}
          </Link>
          <Link to="/" className="hover:text-white transition-colors">
            {t("تواصل معنا", "Contact Us")}
          </Link>
        </nav>

        {/* Right: Lang + User */}
        <div className="flex items-center gap-1.5 w-20 md:w-auto justify-end">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs font-medium"
            aria-label={t("تبديل اللغة", "Switch Language")}
          >
            <Globe size={14} />
            <span>{locale === "ar" ? "EN" : "عربي"}</span>
          </button>

          {isAuthenticated ? (
            <>
              {/* Logged-in: user avatar + name */}
              <div className="hidden md:flex items-center gap-2 text-gray-300 px-2 py-1">
                <div className="w-7 h-7 rounded-full bg-mk-teal text-white text-[10px] font-bold flex items-center justify-center">
                  {(user?.name ?? "U").slice(0, 2)}
                </div>
                <span className="text-xs font-medium max-w-[100px] truncate">
                  {user?.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-1 text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs"
              >
                <LogOut size={14} />
              </button>
              {/* Manager CTA — only for OWNER/OPS_MANAGER/ADMIN */}
              {isManager && (
                <button className="hidden md:block bg-mk-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-mk-teal/90 transition-colors">
                  {t("أضف عقارك", "List Property")}
                </button>
              )}
            </>
          ) : (
            <>
              {/* Mobile: user icon */}
              <button
                onClick={() => navigate("/login")}
                className="md:hidden text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                aria-label={t("تسجيل الدخول", "Login")}
              >
                <User size={17} />
              </button>
              {/* Desktop: login + signup CTA */}
              <button
                onClick={() => navigate("/login")}
                className="hidden md:flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10 text-sm"
              >
                <User size={15} />
                <span>{t("دخول", "Login")}</span>
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="hidden md:block bg-mk-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-mk-teal/90 transition-colors"
              >
                {t("إنشاء حساب", "Sign Up")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Row B: Search bar */}
      {!hideSearch && (
        <div className="px-4 pb-3">
          <form onSubmit={handleSearch} className="relative">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("ابحث بالحي، المعلم، المبنى...", "Search by neighborhood, landmark, building...")}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-gray-400 rounded-xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/50 focus:border-mk-teal/50 transition-all"
            />
          </form>
        </div>
      )}

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="md:hidden bg-mk-dark/95 backdrop-blur-md border-t border-white/10 animate-in slide-in-from-top-2 duration-200"
        >
          <nav className="flex flex-col px-4 py-3 gap-1">
            <Link
              to="/search"
              onClick={() => setMenuOpen(false)}
              className="text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors"
            >
              {t("تصفح العقارات", "Browse Properties")}
            </Link>
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors"
            >
              {t("كيف نعمل", "How It Works")}
            </Link>
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors"
            >
              {t("تواصل معنا", "Contact Us")}
            </Link>
            <hr className="border-white/10 my-1" />

            {isAuthenticated ? (
              <>
                {/* Logged-in mobile menu */}
                <div className="flex items-center gap-2 px-3 py-2 text-gray-200">
                  <div className="w-8 h-8 rounded-full bg-mk-teal text-white text-xs font-bold flex items-center justify-center">
                    {(user?.name ?? "U").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                </div>
                {isManager && (
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="bg-mk-teal text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-mk-teal/90 transition-colors mt-1"
                  >
                    {t("أضف عقارك", "List Property")}
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors mt-1"
                >
                  <LogOut size={15} />
                  {t("تسجيل الخروج", "Logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <User size={15} />
                  {t("تسجيل الدخول", "Login")}
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="bg-mk-teal text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-mk-teal/90 transition-colors mt-1 text-center"
                >
                  {t("إنشاء حساب جديد", "Create Account")}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

/**
 * Compact logo mark for MonthlyKey.
 */
function MKLogo({ size = 26 }: { size?: number }) {
  return (
    <img
      src="/mark-header-gold.png"
      alt="MonthlyKey"
      className="shrink-0"
      style={{ height: size, width: "auto" }}
    />
  );
}

export { MKLogo };
