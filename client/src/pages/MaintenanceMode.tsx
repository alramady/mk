import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useI18n } from "@/lib/i18n";
import { useState, useEffect, useMemo } from "react";
import { Key, Clock, Sparkles, Globe } from "lucide-react";

/* ── SVG Social Icons (inline for zero-dependency) ── */
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.214.12-.042.195-.065.28-.088a.96.96 0 01.287-.038c.218 0 .449.059.63.18.345.24.405.615.39.81a.726.726 0 01-.12.39c-.33.45-1.065.705-1.545.87-.12.045-.24.075-.345.105-.18.06-.27.09-.345.165-.075.09-.105.195-.12.315-.015.18.06.36.12.465.45.705 1.125 1.29 1.95 1.695.21.105.42.18.615.24.33.09.585.24.66.48.09.3-.12.585-.33.765a3.3 3.3 0 01-.675.435c-.39.195-.81.33-1.245.42-.06.015-.12.03-.18.06-.06.03-.12.075-.165.165-.06.12-.075.27-.09.39-.015.075-.03.15-.045.225a.66.66 0 01-.66.495c-.15 0-.315-.03-.48-.06-.27-.06-.585-.12-.96-.12-.195 0-.39.015-.585.045-.375.06-.72.24-1.095.435-.54.27-1.155.585-2.04.585-.06 0-.12 0-.195-.015-.06.015-.12.015-.195.015-.885 0-1.5-.315-2.04-.585-.375-.195-.72-.375-1.095-.435a3.6 3.6 0 00-.585-.045c-.39 0-.69.06-.96.12-.18.03-.33.06-.48.06a.66.66 0 01-.66-.495c-.015-.075-.03-.15-.045-.225-.015-.12-.03-.27-.09-.39-.045-.09-.105-.135-.165-.165-.06-.03-.12-.045-.18-.06a5.1 5.1 0 01-1.245-.42 3.3 3.3 0 01-.675-.435c-.21-.18-.42-.465-.33-.765.075-.24.33-.39.66-.48.195-.06.405-.135.615-.24.825-.405 1.5-.99 1.95-1.695.06-.105.135-.285.12-.465-.015-.12-.045-.225-.12-.315-.075-.075-.165-.105-.345-.165-.105-.03-.225-.06-.345-.105-.48-.165-1.215-.42-1.545-.87a.726.726 0 01-.12-.39c-.015-.195.045-.57.39-.81a.96.96 0 01.63-.18c.09 0 .18.015.27.038.09.023.165.046.285.088.27.09.615.21.915.214.195 0 .33-.045.405-.09a8.7 8.7 0 01-.03-.51l-.003-.06c-.105-1.628-.23-3.654.3-4.847C7.86 1.069 11.216.793 12.206.793z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/* ── Social links config ── */
const socialPlatforms = [
  { key: "social.twitter", icon: TwitterIcon, label: "X / Twitter", hoverColor: "hover:bg-white/20 hover:text-white" },
  { key: "social.instagram", icon: InstagramIcon, label: "Instagram", hoverColor: "hover:bg-gradient-to-br hover:from-[#f09433] hover:to-[#bc1888] hover:text-white" },
  { key: "social.snapchat", icon: SnapchatIcon, label: "Snapchat", hoverColor: "hover:bg-[#FFFC00] hover:text-black" },
  { key: "social.tiktok", icon: TikTokIcon, label: "TikTok", hoverColor: "hover:bg-white/20 hover:text-white" },
  { key: "social.linkedin", icon: LinkedInIcon, label: "LinkedIn", hoverColor: "hover:bg-[#0A66C2] hover:text-white" },
  { key: "social.youtube", icon: YouTubeIcon, label: "YouTube", hoverColor: "hover:bg-[#FF0000] hover:text-white" },
] as const;

/* ── Countdown Timer ── */
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const { lang } = useI18n();
  const labels = lang === "ar"
    ? { days: "يوم", hours: "ساعة", minutes: "دقيقة", seconds: "ثانية" }
    : { days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds" };

  return (
    <div className="flex gap-4 justify-center flex-wrap">
      {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
        <div key={unit} className="flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-lg">
              <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
                {String(timeLeft[unit]).padStart(2, "0")}
              </span>
            </div>
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-b from-[#3ECFC0]/20 to-transparent -z-10 blur-sm" />
          </div>
          <span className="text-sm text-white/50 mt-2 font-medium">{labels[unit]}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ── */
export default function MaintenanceMode() {
  const { get, getByLang } = useSiteSettings();
  const { lang, setLang } = useI18n();
  const isRtl = lang === "ar";

  const title = getByLang("maintenance.title", lang, lang === "ar" ? "قريباً... الانطلاق" : "Coming Soon");
  const subtitle = getByLang("maintenance.subtitle", lang, lang === "ar" ? "نعمل على تجهيز تجربة مميزة لكم" : "We're preparing an exceptional experience for you");
  const message = getByLang("maintenance.message", lang, lang === "ar" ? "ستكون رحلة مميزة معنا في عالم الإيجارات الشهرية. ترقبونا!" : "An exceptional journey awaits you in the world of monthly rentals. Stay tuned!");
  const imageUrl = get("maintenance.imageUrl");
  const countdownDate = get("maintenance.countdownDate");
  const showCountdown = get("maintenance.showCountdown") === "true" && countdownDate;

  // Filter social links that have URLs set
  const activeSocials = socialPlatforms.filter((p) => get(p.key));

  // Floating particles
  const particles = useMemo(() => 
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.1,
    })), []);

  return (
    <div className={`min-h-screen relative overflow-hidden ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1E2D] via-[#0f2a3d] to-[#0B1E2D]" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(62,207,192,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(62,207,192,0.3) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.id % 3 === 0 ? "#C9A96E" : "#3ECFC0",
            opacity: p.opacity,
            animation: `float-particle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          }}
        />
      ))}

      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#3ECFC0]/5 blur-[120px]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#C9A96E]/5 blur-[100px]" />

      {/* Language toggle */}
      <button
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm font-medium">{lang === "ar" ? "EN" : "عربي"}</span>
      </button>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        
        {/* Logo */}
        <div className="relative mb-8">
          <img 
            src="/assets/brand/mk-logo-transparent.svg" 
            alt="Monthly Key" 
            className="w-28 h-28"
          />
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-white/5 to-transparent -z-10 blur-xl animate-pulse" />
        </div>

        {/* Site name */}
        <div className="text-center mb-2">
          <span className="text-sm font-medium text-[#3ECFC0]/70 tracking-widest uppercase">
            {lang === "ar" ? "المفتاح الشهري" : "Monthly Key"}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white text-center mb-4 leading-tight">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-white/80 text-center max-w-2xl mb-6">
          {subtitle}
        </p>

        {/* Custom image */}
        {imageUrl && (
          <div className="relative mb-8 max-w-lg w-full">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={imageUrl} alt="" className="w-full h-auto object-cover" />
            </div>
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-[#3ECFC0]/10 to-[#C9A96E]/10 -z-10 blur-xl" />
          </div>
        )}

        {/* Countdown */}
        {showCountdown && (
          <div className="mb-10">
            <CountdownTimer targetDate={countdownDate} />
          </div>
        )}

        {/* Message */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="relative px-8 py-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <p className="text-base sm:text-lg text-white/80 text-center leading-relaxed">
              {message}
            </p>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-[#C9A96E] text-white text-xs font-bold">
              {lang === "ar" ? "رسالة" : "Message"}
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        {activeSocials.length > 0 && (
          <div className="mb-10">
            <p className="text-sm text-white/60 text-center mb-4 font-medium">
              {lang === "ar" ? "تابعنا على" : "Follow us on"}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {activeSocials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.key}
                    href={get(social.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={social.label}
                    className={`group relative w-12 h-12 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/50 transition-all duration-300 ${social.hoverColor} hover:border-transparent hover:scale-110 hover:shadow-lg`}
                  >
                    <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    {/* Tooltip */}
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {social.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Decorative divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-px bg-gradient-to-r from-transparent to-[#3ECFC0]/40" />
          <Clock className="w-5 h-5 text-[#3ECFC0]/40" />
          <div className="w-16 h-px bg-gradient-to-l from-transparent to-[#3ECFC0]/40" />
        </div>

        {/* Footer info */}
        <p className="text-sm text-white/50 text-center">
          {lang === "ar" 
            ? "نعمل بجد لتقديم أفضل تجربة إيجار شهري في المملكة العربية السعودية"
            : "Working hard to deliver the best monthly rental experience in Saudi Arabia"
          }
        </p>

        {/* Subtle admin login link */}
        <a href="/login" className="mt-6 text-xs text-white/20 hover:text-white/50 transition-colors">
          {lang === "ar" ? "دخول الإدارة" : "Admin Login"}
        </a>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(0) translateX(0); }
          100% { transform: translateY(-30px) translateX(15px); }
        }
      `}</style>
    </div>
  );
}
