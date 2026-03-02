import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./lib/i18n";
import { SiteSettingsProvider, useSiteSettings } from "./contexts/SiteSettingsContext";
import React, { lazy, Suspense, useEffect } from "react";
import AiAssistant from "./components/AiAssistant";
import { useAuth } from "./_core/hooks/useAuth";
import CookieConsent from "./components/CookieConsent";
import WhatsAppButton from "./components/WhatsAppButton";
import { Loader2 } from "lucide-react";
import { usePageTracking } from "./hooks/usePageTracking";
import MaintenanceMode from "./pages/MaintenanceMode";

// Lazy load all pages for code-splitting
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Search = lazy(() => import("./pages/Search"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const CreateProperty = lazy(() => import("./pages/CreateProperty"));
const TenantDashboard = lazy(() => import("./pages/TenantDashboard"));
const LandlordDashboard = lazy(() => import("./pages/LandlordDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Messages = lazy(() => import("./pages/Messages"));
const BookingFlow = lazy(() => import("./pages/BookingFlow"));
const MaintenanceRequest = lazy(() => import("./pages/MaintenanceRequest"));
const LeaseContract = lazy(() => import("./pages/LeaseContract"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const CityDistrictManagement = lazy(() => import("./pages/CityDistrictManagement"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const AgentProfile = lazy(() => import("./pages/AgentProfile"));
const AgentEditProfile = lazy(() => import("./pages/AgentEditProfile"));
const AdminManagers = lazy(() => import("./pages/AdminManagers"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));
const FAQ = lazy(() => import("./pages/FAQ"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const AdminServices = lazy(() => import("./pages/AdminServices"));
const AdminEmergencyMaintenance = lazy(() => import("./pages/AdminEmergencyMaintenance"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));
const AdminAIRatings = lazy(() => import("./pages/AdminAIRatings"));
const AiControlPanel = lazy(() => import("./pages/AiControlPanel"));
const MapViewPage = lazy(() => import("./pages/MapView"));
const AdminHardeningKB = lazy(() => import("./pages/AdminHardeningKB"));
const AdminHelpCenter = lazy(() => import("./pages/AdminHelpCenter"));
const AdminAICopilot = lazy(() => import("./pages/AdminAICopilot"));
// DEFERRED: AdminMyAccount — not in sidebar, blocked
// const AdminMyAccount = lazy(() => import("./pages/AdminMyAccount"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AdminWhatsApp = lazy(() => import("./pages/AdminWhatsApp"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminBuildings = lazy(() => import("./pages/AdminBuildings"));
const AdminUnitFinance = lazy(() => import("./pages/AdminUnitFinance"));
const AdminDbStatus = lazy(() => import("./pages/AdminDbStatus"));
const AdminProperties = lazy(() => import("./pages/AdminProperties"));
const AdminPropertyEdit = lazy(() => import("./pages/AdminPropertyEdit"));
const AdminSubmissions = lazy(() => import("./pages/AdminSubmissions"));
const AdminIntegrations = lazy(() => import("./pages/AdminIntegrations"));
const AdminBookings = lazy(() => import("./pages/AdminBookings"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const SubmitProperty = lazy(() => import("./pages/SubmitProperty"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#3ECFC0]" />
    </div>
  );
}

function Router() {
  usePageTracking();
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/search" component={Search} />
        <Route path="/map" component={MapViewPage} />
        <Route path="/property/:id" component={PropertyDetail} />
        <Route path="/list-property" component={CreateProperty} />
        <Route path="/edit-property/:id" component={CreateProperty} />
        <Route path="/tenant" component={TenantDashboard} />
        <Route path="/landlord" component={LandlordDashboard} />
        {/* Orphan route — DEFERRED, redirect to /admin */}
        <Route path="/admin/my-account">{() => { useEffect(() => { window.location.replace("/admin"); }, []); return <PageLoader />; }}</Route>
        <Route path="/admin/knowledge-base" component={KnowledgeBase} />
        {/* Admin sub-routes (must be before /admin catch-all) */}
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/cities" component={CityDistrictManagement} />
        <Route path="/admin/managers" component={AdminManagers} />
        <Route path="/admin/services" component={AdminServices} />
        <Route path="/admin/emergency-maintenance" component={AdminEmergencyMaintenance} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/permissions" component={AdminPermissions} />
        <Route path="/admin/hardening" component={AdminHardeningKB} />
        <Route path="/admin/bookings" component={AdminBookings} />
        <Route path="/admin/whatsapp" component={AdminWhatsApp} />
        <Route path="/admin/payments" component={AdminPayments} />
        <Route path="/admin/buildings/:id" component={AdminBuildings} />
        <Route path="/admin/buildings" component={AdminBuildings} />
        <Route path="/admin/units/:id" component={AdminUnitFinance} />
        <Route path="/admin/db-status" component={AdminDbStatus} />
        <Route path="/admin/properties/:id/edit" component={AdminPropertyEdit} />
        <Route path="/admin/properties" component={AdminProperties} />
        <Route path="/admin/submissions" component={AdminSubmissions} />
        <Route path="/admin/integrations" component={AdminIntegrations} />
        <Route path="/admin/audit-log" component={AdminAuditLog} />
        {/* Admin dashboard catch-all (must be LAST among /admin routes) */}
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/messages" component={Messages} />
        <Route path="/messages/:id" component={Messages} />
        <Route path="/book/:propertyId" component={BookingFlow} />
        <Route path="/maintenance/new/:bookingId" component={MaintenanceRequest} />
        <Route path="/lease/:bookingId" component={LeaseContract} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/payment/cancel" component={PaymentCancel} />
        <Route path="/agent/edit/:token" component={AgentEditProfile} />
        <Route path="/agent/:id" component={AgentProfile} />
        <Route path="/pay/:id" component={PaymentPage} />
        <Route path="/payment-callback/:id" component={PaymentCallback} />
        <Route path="/faq" component={FAQ} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/contact" component={ContactUs} />
        {/* Removed routes: /admin/ai-ratings, /admin/ai-control, /admin/help-center, /admin/ai-copilot — not in Admin Map */}
        <Route path="/submit-property" component={SubmitProperty} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { get, isLoading } = useSiteSettings();
  const { user } = useAuth();
  const [location] = useLocation();
  const maintenanceEnabled = get("maintenance.enabled") === "true";
  const isAdmin = user?.role === "admin";

  // Always allow access to login, register, forgot-password, and admin routes
  // so admins can authenticate even when maintenance mode is on
  const bypassPaths = ["/login", "/register", "/forgot-password"];
  const isAdminRoute = location.startsWith("/admin");
  const isBypassRoute = bypassPaths.some(p => location === p || location.startsWith(p + "?"));

  // Show loading while settings load
  if (isLoading) return <PageLoader />;

  // If maintenance mode is on and user is NOT admin, show maintenance page
  // But always allow login/register/admin routes (admin routes have their own auth guard)
  if (maintenanceEnabled && !isAdmin && !isBypassRoute && !isAdminRoute) {
    return <MaintenanceMode />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <I18nProvider>
          <SiteSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <MaintenanceGate>
              <Router />
              <AiAssistant />
              <WhatsAppButton />
              <CookieConsent />
            </MaintenanceGate>
          </TooltipProvider>
          </SiteSettingsProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
