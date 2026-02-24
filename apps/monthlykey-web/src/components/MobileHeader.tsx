import { Search, Menu, X, Globe, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";

/**
 * MobileHeader — 2-row premium header for MonthlyKey
 * Row A: compact logo (left) + language toggle + hamburger menu (right)
 * Row B: full-width search input
 *
 * On desktop (md+): single row with logo, nav links, search, and CTA
 */

interface MobileHeaderProps {
  /** If true, hero is visible so header can be transparent/overlay */
  transparent?: boolean;
}

export default function MobileHeader({ transparent = false }: MobileHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const menuRef = useRef<HTMLDivElement>(null);

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
    setLang((prev) => (prev === "ar" ? "en" : "ar"));
    // Future: integrate i18n
  };

  const bgClass = transparent
    ? "bg-transparent absolute top-0 inset-x-0 z-50"
    : "bg-mk-navy sticky top-0 z-50 shadow-sm";

  return (
    <header className={bgClass}>
      {/* Row A: Logo + controls */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <MKLogo />
          <span className="font-bold text-white text-sm hidden sm:inline">
            المفتاح الشهري
          </span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <Link to="/search" className="hover:text-white transition-colors">
            تصفح العقارات
          </Link>
          <Link to="/" className="hover:text-white transition-colors">
            كيف نعمل
          </Link>
          <Link to="/" className="hover:text-white transition-colors">
            تواصل معنا
          </Link>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs font-medium"
            aria-label="تبديل اللغة"
          >
            <Globe size={15} />
            <span>{lang === "ar" ? "EN" : "عربي"}</span>
          </button>

          {/* Login — desktop */}
          <button
            onClick={() => navigate("/login")}
            className="hidden md:flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10 text-sm"
          >
            <User size={15} />
            <span>دخول</span>
          </button>

          {/* CTA — desktop */}
          <button
            className="hidden md:block bg-mk-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-mk-teal/90 transition-colors"
          >
            أضف عقارك
          </button>

          {/* Hamburger — mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="القائمة"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Row B: Search bar */}
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
            placeholder="ابحث بالحي، المعلم، المبنى..."
            className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-gray-400 rounded-xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/50 focus:border-mk-teal/50 transition-all"
          />
        </form>
      </div>

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
              تصفح العقارات
            </Link>
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors"
            >
              كيف نعمل
            </Link>
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors"
            >
              تواصل معنا
            </Link>
            <hr className="border-white/10 my-1" />
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <User size={15} />
              تسجيل الدخول
            </Link>
            <button className="bg-mk-teal text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-mk-teal/90 transition-colors mt-1">
              أضف عقارك
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

/** Compact SVG logo mark for MonthlyKey */
function MKLogo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Key shape background */}
      <rect width="32" height="32" rx="8" fill="#C5A55A" />
      {/* Key icon */}
      <path
        d="M16 8a5 5 0 0 0-4.9 6.04L8 17.14V22h3v-2h2v-2h1.5l1.6-1.6A5 5 0 1 0 16 8Zm1.5 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
        fill="#0B1E2D"
      />
    </svg>
  );
}

export { MKLogo };
