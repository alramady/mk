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
  CheckCheck, Trash2, CreditCard, CalendarCheck, AlertCircle, BellRing, Package
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
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-white/80 hover:text-white hover:bg-white/10">
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

function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();
  if (!switchable || !toggleTheme) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="text-white/80 hover:text-white hover:bg-white/10 w-8 h-8 p-0"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
    }`}>
      <div className="container">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          {/* Logo — light variant on dark navbar, fixed height, no stretch */}
          <Link href="/" className="flex items-center shrink-0 me-3 transition-transform duration-300 hover:scale-105">
            <img 
              src={lang === "ar" ? "/logo-ar-light.png" : "/logo-horizontal-light.png"}
              alt={lang === "ar" ? "المفتاح الشهري" : "Monthly Key"}
              className="h-10 sm:h-12 md:h-14 w-auto object-contain"
              style={{ maxWidth: '280px' }}
            />
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
            <Link href="/map">
              <Button variant="ghost" size="sm" className={`text-white/80 hover:text-white hover:bg-white/10 ${location === "/map" ? "text-[#3ECFC0]" : ""}`}>
                {t("nav.map")}
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
            {/* Theme toggle */}
            <ThemeToggle />

            {/* Language toggle */}
            <Button variant="ghost" size="sm" onClick={toggleLang} className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5">
              <Globe className="h-4 w-4" />
              <span className="text-xs">{lang === "ar" ? "EN" : "AR"}</span>
            </Button>

            {/* Notifications Dropdown */}
            {isAuthenticated && <NotificationDropdown />}

            {/* List Property CTA */}
            {isAuthenticated && (
              <Link href="/list-property" className="hidden lg:block">
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
            <Link href="/map" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                <MapPin className="h-4 w-4 me-2" />
                {t("nav.map")}
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
