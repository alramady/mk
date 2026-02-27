import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./lib/i18n";
import { SiteSettingsProvider, useSiteSettings } from "./contexts/SiteSettingsContext";
import React, { lazy, Suspense } from "react";
import AiAssistant from "./components/AiAssistant";
import { useAuth } from "./_core/hooks/useAuth";
import CookieConsent from "./components/CookieConsent";
import WhatsAppButton from "./components/WhatsAppButton";
import { Loader2 } from "lucide-react";
import { usePageTracking } from "./hooks/usePageTracking";
import MaintenanceMode from "./pages/MaintenanceMode";

// Eager load critical pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Lazy load other pages
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
const AdminMyAccount = lazy(() => import("./pages/AdminMyAccount"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AdminWhatsApp = lazy(() => import("./pages/AdminWhatsApp"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminBuildings = lazy(() => import("./pages/AdminBuildings"));
const AdminUnitFinance = lazy(() => import("./pages/AdminUnitFinance"));
const AdminDbStatus = lazy(() => import("./pages/AdminDbStatus"));

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
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/messages" component={Messages} />
        <Route path="/messages/:id" component={Messages} />
        <Route path="/book/:propertyId" component={BookingFlow} />
        <Route path="/maintenance/new/:bookingId" component={MaintenanceRequest} />
        <Route path="/lease/:bookingId" component={LeaseContract} />
        <Route path="/admin/knowledge-base" component={KnowledgeBase} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/cities" component={CityDistrictManagement} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/payment/cancel" component={PaymentCancel} />
        <Route path="/agent/edit/:token" component={AgentEditProfile} />
        <Route path="/agent/:id" component={AgentProfile} />
        <Route path="/admin/managers" component={AdminManagers} />
        <Route path="/pay/:id" component={PaymentPage} />
        <Route path="/payment-callback/:id" component={PaymentCallback} />
        <Route path="/faq" component={FAQ} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/contact" component={ContactUs} />
        <Route path="/admin/services" component={AdminServices} />
        <Route path="/admin/emergency-maintenance" component={AdminEmergencyMaintenance} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/permissions" component={AdminPermissions} />
        <Route path="/admin/ai-ratings" component={AdminAIRatings} />
        <Route path="/admin/ai-control" component={AiControlPanel} />
        <Route path="/admin/hardening" component={AdminHardeningKB} />
        <Route path="/admin/help-center" component={AdminHelpCenter} />
        <Route path="/admin/ai-copilot" component={AdminAICopilot} />
        <Route path="/admin/my-account" component={AdminMyAccount} />
        <Route path="/admin/whatsapp" component={AdminWhatsApp} />
        <Route path="/admin/payments" component={AdminPayments} />
        <Route path="/admin/buildings" component={AdminBuildings} />
        <Route path="/admin/buildings/:id" component={AdminBuildings} />
        <Route path="/admin/units/:id" component={AdminUnitFinance} />
        <Route path="/admin/db-status" component={AdminDbStatus} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { get, isLoading } = useSiteSettings();
  const { user } = useAuth();
  const maintenanceEnabled = get("maintenance.enabled") === "true";
  const isAdmin = user?.role === "admin";

  // Show loading while settings load
  if (isLoading) return <PageLoader />;

  // If maintenance mode is on and user is NOT admin, show maintenance page
  if (maintenanceEnabled && !isAdmin) {
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
