import { Button } from "@/components/ui/button";
import { Home, Search, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import SEOHead from "@/components/SEOHead";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B1E2D] relative overflow-hidden">
      <SEOHead title="Page Not Found" titleAr="الصفحة غير موجودة" noindex={true} />
      
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 start-1/4 w-64 h-64 bg-[#3ECFC0]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 end-1/4 w-80 h-80 bg-[#C9A96E]/5 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative z-10 text-center px-6 max-w-lg">
        {/* Large 404 number */}
        <div className="relative mb-6">
          <span className="text-[140px] sm:text-[180px] font-heading font-extrabold leading-none bg-gradient-to-b from-[#3ECFC0] via-[#3ECFC0]/60 to-transparent bg-clip-text text-transparent select-none">
            404
          </span>
          {/* Gold key icon overlay */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/lDFKiBXvXbLyTkzm.png" 
              alt="" 
              className="h-16 sm:h-20 w-auto opacity-20 drop-shadow-lg"
            />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-3">
          {isAr ? "الصفحة غير موجودة" : "Page Not Found"}
        </h1>

        {/* Description */}
        <p className="text-white/50 text-sm sm:text-base leading-relaxed mb-8 max-w-sm mx-auto">
          {isAr 
            ? "عذراً، الصفحة التي تبحث عنها غير موجودة. ربما تم نقلها أو حذفها."
            : "Sorry, the page you're looking for doesn't exist. It may have been moved or deleted."
          }
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => setLocation("/")}
            className="bg-[#3ECFC0] hover:bg-[#35b5a8] text-[#0B1E2D] font-semibold px-6 py-2.5 rounded-lg transition-all duration-300 shadow-lg shadow-[#3ECFC0]/20 hover:shadow-[#3ECFC0]/30 hover:-translate-y-0.5"
          >
            <Home className="w-4 h-4 me-2" />
            {isAr ? "الصفحة الرئيسية" : "Go Home"}
          </Button>
          <Button
            onClick={() => setLocation("/search")}
            variant="outline"
            className="border-white/20 text-white/70 hover:text-white hover:bg-white/5 hover:border-white/30 px-6 py-2.5 rounded-lg transition-all duration-300"
          >
            <Search className="w-4 h-4 me-2" />
            {isAr ? "البحث عن عقار" : "Search Properties"}
          </Button>
        </div>

        {/* Bottom accent */}
        <div className="mt-12 flex justify-center">
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C9A96E]/40 to-transparent rounded-full" />
        </div>
      </div>
    </div>
  );
}
