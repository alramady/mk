import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, LogOut, PanelLeft, Wrench,
  AlertTriangle, BarChart3, Settings, MapPin, KeyRound,
  BookOpen, UserCog, Shield, MessageCircle, Database,
  Building2, Inbox, Plug, CalendarCheck, CreditCard, Hotel,
  Sun, Moon, Languages,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

type MenuItem = {
  icon: typeof LayoutDashboard;
  labelKey: string;
  path: string;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, labelKey: "adminMenu.dashboard", path: "/admin" },
  { icon: Building2, labelKey: "adminMenu.properties", path: "/admin/properties" },
  { icon: Inbox, labelKey: "adminMenu.submissions", path: "/admin/submissions" },
  { icon: Hotel, labelKey: "adminMenu.buildings", path: "/admin/buildings" },
  { icon: CalendarCheck, labelKey: "adminMenu.bookings", path: "/admin/bookings" },
  { icon: CreditCard, labelKey: "adminMenu.payments", path: "/admin/payments" },
  { icon: UserCog, labelKey: "adminMenu.managers", path: "/admin/managers" },
  { icon: Wrench, labelKey: "adminMenu.services", path: "/admin/services" },
  { icon: AlertTriangle, labelKey: "adminMenu.emergency", path: "/admin/emergency-maintenance" },
  { icon: BarChart3, labelKey: "adminMenu.analytics", path: "/admin/analytics" },
  { icon: MapPin, labelKey: "adminMenu.cities", path: "/admin/cities" },
  { icon: KeyRound, labelKey: "adminMenu.permissions", path: "/admin/permissions" },
  { icon: BookOpen, labelKey: "adminMenu.knowledgeBase", path: "/admin/knowledge-base" },
  { icon: MessageCircle, labelKey: "adminMenu.whatsapp", path: "/admin/whatsapp" },
  { icon: Plug, labelKey: "adminMenu.integrations", path: "/admin/integrations" },
  { icon: Shield, labelKey: "adminMenu.hardening", path: "/admin/hardening" },
  { icon: Database, labelKey: "adminMenu.dbStatus", path: "/admin/db-status" },
  { icon: Settings, labelKey: "adminMenu.settings", path: "/admin/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { t, lang, dir } = useI18n();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir={dir}>
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <img 
              src="/assets/brand/mk-logo-transparent.svg" 
              alt="Monthly Key - المفتاح الشهري" 
              className="h-24 w-auto object-contain"
              style={{ maxWidth: '120px' }} 
            />
            <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C5A55A] to-transparent" />
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {t("adminMenu.loginRequired" as any)}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t("adminMenu.loginAccess" as any)}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]"
          >
            {t("adminMenu.login" as any)}
          </Button>
        </div>
      </div>
    );
  }

  // RTL → sidebar on right; LTR → sidebar on left
  const sidebarSide = lang === "ar" ? "right" : "left";

  return (
    <div dir={dir}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={setSidebarWidth} sidebarSide={sidebarSide}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </div>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  sidebarSide: "left" | "right";
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  sidebarSide,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  const activeMenuItem = menuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const rect = sidebarRef.current?.getBoundingClientRect();
      if (!rect) return;

      let newWidth: number;
      if (sidebarSide === "right") {
        newWidth = rect.right - e.clientX;
      } else {
        newWidth = e.clientX - rect.left;
      }
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth, sidebarSide]);

  const roleLabel = user?.role === "admin"
    ? t("adminMenu.sysAdmin" as any)
    : user?.role === "landlord"
    ? t("adminMenu.landlord" as any)
    : t("adminMenu.tenant" as any);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          side={sidebarSide}
          collapsible="icon"
          className="border-e-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label={t("adminMenu.toggleMenu" as any)}
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center min-w-0">
                  <img 
                    src="/assets/brand/mk-logo-dark.svg" 
                    alt="Monthly Key - المفتاح الشهري" 
                    className="h-8 w-auto object-contain dark:hidden"
                    style={{ maxWidth: '160px' }} 
                  />
                  <img 
                    src="/assets/brand/mk-logo-transparent.svg" 
                    alt="Monthly Key - المفتاح الشهري" 
                    className="h-8 w-auto object-contain hidden dark:block"
                    style={{ maxWidth: '160px' }} 
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <img 
                    src="/assets/brand/mk-logo-transparent.svg" 
                    alt="MK" 
                    className="h-7 w-7 object-contain" 
                  />
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                const label = t(item.labelKey as any);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-[#3ECFC0]" : ""}`}
                      />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-start group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-[#3ECFC0] text-[#0B1E2D]">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {roleLabel}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/")}
                  className="cursor-pointer"
                >
                  <LayoutDashboard className="me-2 h-4 w-4" />
                  <span>{t("adminMenu.homepage" as any)}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="me-2 h-4 w-4" />
                  <span>{t("adminMenu.logout" as any)}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="mt-2 text-center group-data-[collapsible=icon]:hidden">
              <p className="text-[10px] text-muted-foreground/50 font-mono" title={`Full build: ${typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : ''}`}>
                Build {typeof __APP_BUILD_VERSION__ !== 'undefined' ? __APP_BUILD_VERSION__ : 'dev'}
              </p>
              <p className="text-[9px] text-muted-foreground/40 font-mono">
                {typeof __APP_GIT_SHA__ !== 'undefined' && __APP_GIT_SHA__ !== 'unknown' ? `SHA: ${__APP_GIT_SHA__}` : ''}
                {' • monthly-key-app'}
              </p>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 ${sidebarSide === "right" ? "start-0" : "end-0"} w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Top bar — always visible on mobile, also shows toggles on desktop */}
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile && (
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
            )}
            <span className="tracking-tight text-foreground text-sm font-medium">
              {activeMenuItem ? t(activeMenuItem.labelKey as any) : t("adminMenu.menu" as any)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            >
              <Languages className="h-4 w-4" />
              <span className="text-xs">{lang === "ar" ? "EN" : "عربي"}</span>
            </button>
            {/* Theme toggle */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label={theme === "dark" ? t("adminMenu.lightMode" as any) : t("adminMenu.darkMode" as any)}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
        <main className="flex-1 p-4 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </>
  );
}
