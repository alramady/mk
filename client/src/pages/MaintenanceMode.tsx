import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useI18n } from "@/lib/i18n";
import { useState, useEffect, useMemo } from "react";
import { Key, Clock, Sparkles, ArrowLeft, Globe } from "lucide-react";

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
        
        {/* Logo / Key icon */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#3ECFC0] to-[#2ba89e] flex items-center justify-center shadow-2xl shadow-[#3ECFC0]/20">
            <Key className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#C9A96E] flex items-center justify-center animate-bounce">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-[#3ECFC0]/10 to-transparent -z-10 blur-xl animate-pulse" />
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
        <p className="text-lg sm:text-xl text-white/60 text-center max-w-2xl mb-6">
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

        {/* Decorative divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-px bg-gradient-to-r from-transparent to-[#3ECFC0]/40" />
          <Clock className="w-5 h-5 text-[#3ECFC0]/40" />
          <div className="w-16 h-px bg-gradient-to-l from-transparent to-[#3ECFC0]/40" />
        </div>

        {/* Footer info */}
        <p className="text-sm text-white/30 text-center">
          {lang === "ar" 
            ? "نعمل بجد لتقديم أفضل تجربة إيجار شهري في المملكة العربية السعودية"
            : "Working hard to deliver the best monthly rental experience in Saudi Arabia"
          }
        </p>
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
