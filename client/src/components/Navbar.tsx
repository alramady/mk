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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Home, Search, Bell, MessageSquare, Menu, X, Globe, User,
  LogOut, LayoutDashboard, KeyRound, Plus, ChevronDown, MapPin,
  CheckCheck, Trash2, CreditCard, CalendarCheck, AlertCircle, BellRing, Package,
  Star, ClipboardList, Mail, EyeOff, Bookmark, Languages
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "booking_approved": return <CalendarCheck className="h-4 w-4 text-green-500 shrink-0" />;
    case "booking_rejected": return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "payment_received": return <CreditCard className="h-4 w-4 text-blue-500 shrink-0" />;
    case "payment_due": return <CreditCard className="h-4 w-4 text-amber-500 shrink-0" />;
    case "new_booking": return <Package className="h-4 w-4 text-purple-500 shrink-0" />;
    default: return <BellRing className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function timeAgo(date: string | Date, lang: string) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (lang === "ar") {
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHr < 24) return `منذ ${diffHr} ساعة`;
    if (diffDay < 7) return `منذ ${diffDay} يوم`;
    return d.toLocaleDateString("ar-SA");
  }
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US");
}

function NotificationDropdown() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const notifs = trpc.notification.list.useQuery(undefined, {
    enabled: open,
    refetchInterval: open ? 15000 : false,
  });
  const unreadCount = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });
  const deleteNotif = trpc.notification.delete.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });

  const count = unreadCount.data?.count ?? 0;
  const items = notifs.data ?? [];

  const handleClick = (n: any) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    setOpen(false);
    // Navigate based on notification type
    if (n.relatedType === "booking" && n.relatedId) {
      navigate(`/tenant`);
    } else if (n.relatedType === "payment" && n.relatedId) {
      navigate(`/pay/${n.relatedId}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-white/90 hover:text-white hover:bg-white/10">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <Badge className="absolute -top-1 -end-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0 animate-pulse">
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 max-h-[70vh] overflow-hidden" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">
            {lang === "ar" ? "الإشعارات" : "Notifications"}
            {count > 0 && <span className="text-xs text-muted-foreground ms-1.5">({count})</span>}
          </h3>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {lang === "ar" ? "قراءة الكل" : "Mark all read"}
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="overflow-y-auto max-h-[55vh]">
          {notifs.isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد إشعارات" : "No notifications"}
              </p>
            </div>
          ) : (
            items.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0 hover:bg-muted/50 ${
                  !n.isRead ? "bg-primary/5" : ""
                }`}
                onClick={() => handleClick(n)}
              >
                <div className="mt-0.5">
                  <NotificationIcon type={n.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold" : ""}`}>
                    {lang === "ar" ? (n.titleAr || n.titleEn) : n.titleEn}
                  </p>
                  {(n.contentAr || n.contentEn) && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {lang === "ar" ? (n.contentAr || n.contentEn) : n.contentEn}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {timeAgo(n.createdAt, lang)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.isRead && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotif.mutate({ id: n.id });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CollectionsDropdown() {
  const { t, lang } = useI18n();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const items = [
    {
      key: "saved",
      icon: Star,
      label: t("collections.saved"),
      href: "/tenant?tab=favorites",
    },
    {
      key: "inspections",
      icon: ClipboardList,
      label: t("collections.inspections"),
      href: "/tenant?tab=inspections",
    },
    {
      key: "enquired",
      icon: Mail,
      label: t("collections.enquired"),
      href: "/tenant?tab=enquiries",
    },
    {
      key: "hidden",
      icon: EyeOff,
      label: t("collections.hidden"),
      href: "/tenant?tab=hidden",
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-white/90 hover:text-white hover:bg-white/10">
          <Bookmark className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0" sideOffset={8}>
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">{t("nav.collections")}</h3>
        </div>
        <div className="py-1">
          {items.map((item) => (
            <button
              key={item.key}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted/50 transition-colors border-b last:border-b-0 text-foreground"
              onClick={() => {
                setOpen(false);
                window.location.href = item.href;
              }}
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "menu-row" }) {
  const { theme, toggleTheme, switchable } = useTheme();
  const { lang } = useI18n();
  if (!switchable || !toggleTheme) return null;

  if (variant === "menu-row") {
    return (
      <button
        onClick={toggleTheme}
        className={`flex items-center justify-between w-full px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 transition-colors ${lang === "ar" ? "flex-row-reverse" : ""}`}
      >
        <span className={`flex items-center gap-2 ${lang === "ar" ? "flex-row-reverse" : ""}`}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="text-sm">{lang === "ar" ? "الوضع الليلي" : "Dark Mode"}</span>
        </span>
        {/* Toggle switch visual */}
        <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${theme === "dark" ? "bg-[#3ECFC0]" : "bg-white/20"}`}>
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${theme === "dark" ? (lang === "ar" ? "translate-x-0.5" : "translate-x-5") : (lang === "ar" ? "translate-x-5" : "translate-x-0.5")}`} />
        </div>
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="text-white/90 hover:text-white hover:bg-white/10"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function LanguageToggle({ variant = "icon" }: { variant?: "icon" | "menu-row" }) {
  const { lang, toggleLang } = useI18n();

  if (variant === "menu-row") {
    return (
      <button
        onClick={toggleLang}
        className={`flex items-center justify-between w-full px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 transition-colors ${lang === "ar" ? "flex-row-reverse" : ""}`}
      >
        <span className={`flex items-center gap-2 ${lang === "ar" ? "flex-row-reverse" : ""}`}>
          <Languages className="h-4 w-4" />
          <span className="text-sm">{lang === "ar" ? "اللغة" : "Language"}</span>
        </span>
        {/* Language pill toggle */}
        <div className="flex items-center gap-0.5 bg-white/10 rounded-full p-0.5">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all duration-300 ${lang === "ar" ? "bg-[#3ECFC0] text-[#0B1E2D]" : "text-white/70"}`}>
            AR
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all duration-300 ${lang === "en" ? "bg-[#3ECFC0] text-[#0B1E2D]" : "text-white/70"}`}>
            EN
          </span>
        </div>
      </button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleLang} className="text-white/90 hover:text-white hover:bg-white/10 gap-1.5">
      <Globe className="h-4 w-4" />
      <span className="text-xs">{lang === "ar" ? "EN" : "AR"}</span>
    </Button>
  );
}

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
    }`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="container">
        <div className={`flex h-16 sm:h-20 items-center justify-between ${lang === "ar" ? "flex-row-reverse" : ""}`}>
          {/* Logo + Business Name — Premium horizontal layout */}
          <Link href="/" className={`group flex items-center shrink-0 me-3 gap-2.5 sm:gap-3 transition-all duration-300 hover:scale-[1.02] ${lang === "ar" ? "flex-row-reverse" : ""}`}>
            {/* Logo icon */}
            <div className="relative">
              <img loading="lazy" 
                src="/assets/brand/mk-logo-dark.svg"
                alt={lang === "ar" ? "المفتاح الشهري" : "Monthly Key"}
                className="h-9 sm:h-11 md:h-12 w-auto object-contain drop-shadow-[0_0_8px_rgba(62,207,192,0.15)] group-hover:drop-shadow-[0_0_12px_rgba(62,207,192,0.3)] transition-all duration-500"
              />
            </div>
            {/* Thin separator line */}
            <div className="hidden sm:block h-7 md:h-8 w-px bg-gradient-to-b from-transparent via-[#3ECFC0]/40 to-transparent" />
            {/* Business name */}
            <div className="flex flex-col justify-center items-start leading-none" style={{ minWidth: 0 }}>
              <span className="block text-[15px] sm:text-[17px] md:text-[19px] font-bold tracking-wide bg-gradient-to-r from-white via-[#e0e0e0] to-[#c0c0c0] bg-clip-text text-transparent group-hover:from-[#3ECFC0] group-hover:via-white group-hover:to-[#3ECFC0] transition-all duration-500 whitespace-nowrap" style={{ fontFamily: lang === 'ar' ? "'Cairo', 'Tajawal', sans-serif" : "'Inter', 'DM Sans', sans-serif" }}>
                {lang === "ar" ? "المفتاح الشهري" : "Monthly Key"}
              </span>
              <span className="block text-[8px] sm:text-[9px] md:text-[10px] font-medium tracking-[0.2em] uppercase text-[#3ECFC0]/60 mt-0.5 group-hover:text-[#3ECFC0]/90 transition-colors duration-500 whitespace-nowrap">
                {lang === "ar" ? "MONTHLY KEY" : "المفتاح الشهري"}
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className={`text-white/90 hover:text-white hover:bg-white/10 ${location === "/" ? "text-[#3ECFC0]" : ""}`}>
                {t("nav.home")}
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="ghost" size="sm" className={`text-white/90 hover:text-white hover:bg-white/10 ${location === "/search" ? "text-[#3ECFC0]" : ""}`}>
                {t("nav.search")}
              </Button>
            </Link>
            <Link href="/map">
              <Button variant="ghost" size="sm" className={`text-white/90 hover:text-white hover:bg-white/10 ${location === "/map" ? "text-[#3ECFC0]" : ""}`}>
                {t("nav.map")}
              </Button>
            </Link>
            {isAuthenticated && (
              <>
                <Link href={getDashboardLink()}>
                  <Button variant="ghost" size="sm" className={`text-white/90 hover:text-white hover:bg-white/10 ${["/tenant", "/landlord", "/admin"].includes(location) ? "text-[#3ECFC0]" : ""}`}>
                    {t("nav.dashboard")}
                  </Button>
                </Link>
                <Link href="/messages">
                  <Button variant="ghost" size="sm" className={`relative text-white/90 hover:text-white hover:bg-white/10 ${location.startsWith("/messages") ? "text-[#3ECFC0]" : ""}`}>
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
          <div className={`flex items-center gap-2 ${lang === "ar" ? "flex-row-reverse" : ""}`}>
            {/* Theme toggle — desktop only */}
            <div className="hidden md:block">
              <ThemeToggle variant="icon" />
            </div>

            {/* Language toggle — desktop only */}
            <div className="hidden md:block">
              <LanguageToggle variant="icon" />
            </div>

            {/* Collections Dropdown */}
            {isAuthenticated && <CollectionsDropdown />}

            {/* Notifications Dropdown */}
            {isAuthenticated && <NotificationDropdown />}

            {/* List Property CTA */}
            {isAuthenticated && (
              <Link href="/submit-property" className="hidden lg:block">
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
                      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name || ""} className="object-cover" />}
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
                  <DropdownMenuItem onClick={() => window.location.href = "/submit-property"}>
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
              className="md:hidden h-9 w-9 text-white/90 hover:text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden border-t border-white/10 overflow-hidden transition-all duration-500 ease-out ${mobileMenuOpen ? "max-h-[500px] py-3 opacity-100" : "max-h-0 py-0 opacity-0"}`}>
          <div className="space-y-1">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className={`w-full ${lang === "ar" ? "justify-end" : "justify-start"} text-white/90 hover:text-white hover:bg-white/10`}>
                <Home className="h-4 w-4 me-2" />
                {t("nav.home")}
              </Button>
            </Link>
            <Link href="/search" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className={`w-full ${lang === "ar" ? "justify-end" : "justify-start"} text-white/90 hover:text-white hover:bg-white/10`}>
                <Search className="h-4 w-4 me-2" />
                {t("nav.search")}
              </Button>
            </Link>
            <Link href="/map" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className={`w-full ${lang === "ar" ? "justify-end" : "justify-start"} text-white/90 hover:text-white hover:bg-white/10`}>
                <MapPin className="h-4 w-4 me-2" />
                {t("nav.map")}
              </Button>
            </Link>
            {isAuthenticated && (
              <>
                <Link href={getDashboardLink()} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className={`w-full ${lang === "ar" ? "justify-end" : "justify-start"} text-white/90 hover:text-white hover:bg-white/10`}>
                    <LayoutDashboard className="h-4 w-4 me-2" />
                    {t("nav.dashboard")}
                  </Button>
                </Link>
                <Link href="/messages" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className={`w-full ${lang === "ar" ? "justify-end" : "justify-start"} text-white/90 hover:text-white hover:bg-white/10`}>
                    <MessageSquare className="h-4 w-4 me-2" />
                    {t("nav.messages")}
                  </Button>
                </Link>
                {/* List property — only for landlord role; tenants use footer/menu link */}
                {user?.role === "landlord" && (
                  <Link href="/submit-property" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className={`w-full ${lang === "ar" ? "justify-end" : "justify-start"} text-white/90 hover:text-white hover:bg-white/10`}>
                      <Plus className="h-4 w-4 me-2" />
                      {t("nav.listProperty")}
                    </Button>
                  </Link>
                )}
              </>
            )}

            {/* Divider */}
            <div className="my-2 mx-4 border-t border-white/10" />

            {/* Dark mode toggle — mobile menu row */}
            <ThemeToggle variant="menu-row" />

            {/* Language switcher — mobile menu row */}
            <LanguageToggle variant="menu-row" />
          </div>
        </div>
      </div>
    </nav>
  );
}
