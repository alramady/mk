import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Home, Search, Bell, MessageSquare, Menu, X, Globe, User,
  LogOut, LayoutDashboard, Building2, Plus, ChevronDown
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const { get: s } = useSiteSettings();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const unreadNotifs = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const unreadMsgs = trpc.message.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const getDashboardLink = () => {
    if (!user) return "/tenant";
    if (user.role === "admin") return "/admin";
    if (user.role === "landlord") return "/landlord";
    return "/tenant";
  };

  const isHome = location === "/";

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? "bg-[#0B1E2D]/95 backdrop-blur shadow-lg" 
        : isHome 
          ? "bg-[#0B1E2D]" 
          : "bg-[#0B1E2D]/95 backdrop-blur"
    }`}>
      <div className="container">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            {s("site.logoUrl") ? (
              <img src={s("site.logoUrl")} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#3ECFC0] flex items-center justify-center transition-transform duration-300 hover:scale-110">
                <Building2 className="h-5 w-5 text-[#0B1E2D]" />
              </div>
            )}
            <span className="text-xl font-bold font-heading text-white">
              {lang === "ar" ? (s("site.nameAr") || "إيجار") : (s("site.nameEn") || "Ijar")}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className={`text-white/80 hover:text-white hover:bg-white/10 ${location === "/" ? "text-[#3ECFC0]" : ""}`}>
                {t("nav.home")}
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="ghost" size="sm" className={`text-white/80 hover:text-white hover:bg-white/10 ${location === "/search" ? "text-[#3ECFC0]" : ""}`}>
                {t("nav.search")}
              </Button>
            </Link>
            {isAuthenticated && (
              <>
                <Link href={getDashboardLink()}>
                  <Button variant="ghost" size="sm" className={`text-white/80 hover:text-white hover:bg-white/10 ${["/tenant", "/landlord", "/admin"].includes(location) ? "text-[#3ECFC0]" : ""}`}>
                    {t("nav.dashboard")}
                  </Button>
                </Link>
                <Link href="/messages">
                  <Button variant="ghost" size="sm" className={`relative text-white/80 hover:text-white hover:bg-white/10 ${location.startsWith("/messages") ? "text-[#3ECFC0]" : ""}`}>
                    {t("nav.messages")}
                    {(unreadMsgs.data?.count ?? 0) > 0 && (
                      <Badge className="absolute -top-1 -end-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
                        {unreadMsgs.data?.count}
                      </Badge>
                    )}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <Button variant="ghost" size="sm" onClick={toggleLang} className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5">
              <Globe className="h-4 w-4" />
              <span className="text-xs">{lang === "ar" ? "EN" : "AR"}</span>
            </Button>

            {/* Notifications */}
            {isAuthenticated && (
              <Link href={getDashboardLink()}>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 text-white/80 hover:text-white hover:bg-white/10">
                  <Bell className="h-4 w-4" />
                  {(unreadNotifs.data?.count ?? 0) > 0 && (
                    <Badge className="absolute -top-1 -end-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
                      {unreadNotifs.data?.count}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            {/* List Property CTA */}
            {isAuthenticated && (
              <Link href="/list-property" className="hidden md:block">
                <Button size="sm" className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 font-semibold btn-animate">
                  <Plus className="h-4 w-4 me-1.5" />
                  {t("nav.listProperty")}
                </Button>
              </Link>
            )}

            {/* User menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-white/90 hover:text-white hover:bg-white/10">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-[#3ECFC0] text-[#0B1E2D] font-semibold">
                        {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm">{user?.name}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => window.location.href = getDashboardLink()}>
                    <LayoutDashboard className="h-4 w-4 me-2" />
                    {t("nav.dashboard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = "/list-property"}>
                    <Plus className="h-4 w-4 me-2" />
                    {t("nav.listProperty")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 me-2" />
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white">
                    {t("nav.login")}
                  </Button>
                </Link>
                <Link href="/register" className="hidden md:block">
                  <Button size="sm" className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 font-semibold">
                    {t("auth.register")}
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden border-t border-white/10 overflow-hidden transition-all duration-500 ease-out ${mobileMenuOpen ? "max-h-96 py-3 opacity-100" : "max-h-0 py-0 opacity-0"}`}>
          <div className="space-y-1">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                <Home className="h-4 w-4 me-2" />
                {t("nav.home")}
              </Button>
            </Link>
            <Link href="/search" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                <Search className="h-4 w-4 me-2" />
                {t("nav.search")}
              </Button>
            </Link>
            {isAuthenticated && (
              <>
                <Link href={getDashboardLink()} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                    <LayoutDashboard className="h-4 w-4 me-2" />
                    {t("nav.dashboard")}
                  </Button>
                </Link>
                <Link href="/messages" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                    <MessageSquare className="h-4 w-4 me-2" />
                    {t("nav.messages")}
                  </Button>
                </Link>
                <Link href="/list-property" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                    <Plus className="h-4 w-4 me-2" />
                    {t("nav.listProperty")}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
