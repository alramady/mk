import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./lib/i18n";
import { SiteSettingsProvider } from "./contexts/SiteSettingsContext";
import { lazy, Suspense } from "react";
import AiAssistant from "./components/AiAssistant";
import CookieConsent from "./components/CookieConsent";
import WhatsAppButton from "./components/WhatsAppButton";
import { Loader2 } from "lucide-react";

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
const FAQ = lazy(() => import("./pages/FAQ"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const AdminServices = lazy(() => import("./pages/AdminServices"));
const AdminEmergencyMaintenance = lazy(() => import("./pages/AdminEmergencyMaintenance"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#3ECFC0]" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/search" component={Search} />
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
        <Route path="/faq" component={FAQ} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/contact" component={ContactUs} />
        <Route path="/admin/services" component={AdminServices} />
        <Route path="/admin/emergency-maintenance" component={AdminEmergencyMaintenance} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/permissions" component={AdminPermissions} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <SiteSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <AiAssistant />
            <WhatsAppButton />
            <CookieConsent />
          </TooltipProvider>
          </SiteSettingsProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
