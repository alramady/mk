import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users, Building2, Calendar, CreditCard, BarChart3,
  Loader2, CheckCircle, XCircle, Shield, TrendingUp, BookOpen,
  Package, AlertTriangle, Star, Bot, Clock, Send, BanknoteIcon,
  FileText, Eye, HelpCircle, MessageSquare, Search, UserCog
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useState } from "react";

// Status badge styling
function BookingStatusBadge({ status, lang }: { status: string; lang: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; labelAr: string; icon: React.ReactNode }> = {
    pending: { variant: "secondary", label: "Pending Review", labelAr: "بانتظار المراجعة", icon: <Clock className="h-3 w-3" /> },
    approved: { variant: "outline", label: "Awaiting Payment", labelAr: "بانتظار الدفع", icon: <BanknoteIcon className="h-3 w-3" /> },
    active: { variant: "default", label: "Active", labelAr: "نشط", icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { variant: "destructive", label: "Rejected", labelAr: "مرفوض", icon: <XCircle className="h-3 w-3" /> },
    completed: { variant: "outline", label: "Completed", labelAr: "مكتمل", icon: <CheckCircle className="h-3 w-3" /> },
    cancelled: { variant: "destructive", label: "Cancelled", labelAr: "ملغي", icon: <XCircle className="h-3 w-3" /> },
  };
  const s = map[status] || { variant: "outline" as const, label: status, labelAr: status, icon: null };
  return (
    <Badge variant={s.variant} className="gap-1">
      {s.icon}
      {lang === "ar" ? s.labelAr : s.label}
    </Badge>
  );
}

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();

  // Dialogs state
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [rejectReason, setRejectReason] = useState("");
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [approveNotes, setApproveNotes] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  // User management state
  const [userSearch, setUserSearch] = useState("");
  const [userSearchDebounced, setUserSearchDebounced] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [roleChangeUser, setRoleChangeUser] = useState<{ id: number; name: string; currentRole: string } | null>(null);
  const [newRole, setNewRole] = useState("");
  const searchTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleUserSearch = (val: string) => {
    setUserSearch(val);
    if (searchTimeoutRef[0]) clearTimeout(searchTimeoutRef[0]);
    searchTimeoutRef[1](setTimeout(() => setUserSearchDebounced(val), 400));
  };

  const stats = trpc.admin.stats.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const users = trpc.admin.users.useQuery(
    { limit: 100, search: userSearchDebounced || undefined, role: userRoleFilter !== "all" ? userRoleFilter : undefined },
    { enabled: isAuthenticated && user?.role === "admin" }
  );
  const rolesQuery = trpc.roles.list.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const updateUserRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تحديث دور المستخدم بنجاح" : "User role updated successfully");
      utils.admin.users.invalidate();
      setRoleChangeUser(null);
      setNewRole("");
    },
    onError: (e) => toast.error(e.message),
  });
  const assignRole = trpc.roles.assignToUser.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تعيين الدور والصلاحيات بنجاح" : "Role and permissions assigned successfully");
      utils.admin.users.invalidate();
      setRoleChangeUser(null);
      setNewRole("");
    },
    onError: (e) => toast.error(e.message),
  });
  const properties = trpc.admin.properties.useQuery({ limit: 50 }, { enabled: isAuthenticated && user?.role === "admin" });
  const bookings = trpc.admin.bookings.useQuery({ limit: 50 }, { enabled: isAuthenticated && user?.role === "admin" });

  const approveProp = trpc.admin.approveProperty.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تحديث حالة العقار" : "Property status updated");
      utils.admin.properties.invalidate();
      utils.admin.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveBooking = trpc.admin.approveBooking.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم قبول الحجز وإرسال الفاتورة للمستأجر" : "Booking approved and bill sent to tenant");
      utils.admin.bookings.invalidate();
      utils.admin.stats.invalidate();
      setApproveDialog({ open: false, bookingId: null });
      setApproveNotes("");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectBooking = trpc.admin.rejectBooking.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم رفض الحجز" : "Booking rejected");
      utils.admin.bookings.invalidate();
      utils.admin.stats.invalidate();
      setRejectDialog({ open: false, bookingId: null });
      setRejectReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmPayment = trpc.admin.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تأكيد الدفع - الحجز نشط الآن" : "Payment confirmed - Booking is now active");
      utils.admin.bookings.invalidate();
      utils.admin.stats.invalidate();
      setConfirmDialog({ open: false, bookingId: null });
      setPaymentMethod("cash");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendReminder = trpc.admin.sendBillReminder.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم إرسال تذكير الدفع للمستأجر" : "Payment reminder sent to tenant");
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-heading font-bold mb-2">{lang === "ar" ? "غير مصرح" : "Unauthorized"}</h2>
          <p className="text-muted-foreground">{lang === "ar" ? "ليس لديك صلاحية الوصول لهذه الصفحة" : "You don't have access to this page"}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const pendingBookings = bookings.data?.filter((b: any) => b.status === "pending") ?? [];
  const approvedBookings = bookings.data?.filter((b: any) => b.status === "approved") ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Admin Dashboard" titleAr="لوحة الإدارة" path="/admin" noindex={true} />
      <Navbar />
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">{t("dashboard.admin")}</h1>
          <p className="text-muted-foreground mt-1">{lang === "ar" ? "إدارة المنصة" : "Platform Management"}</p>
        </div>

        {/* Pending Actions Alert */}
        {(pendingBookings.length > 0 || approvedBookings.length > 0) && (
          <div className="mb-6 p-4 rounded-lg border-2 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">
                {lang === "ar" ? "إجراءات مطلوبة" : "Actions Required"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {pendingBookings.length > 0 && (
                <span className="text-amber-600 dark:text-amber-300">
                  {lang === "ar" 
                    ? `${pendingBookings.length} حجز بانتظار الموافقة`
                    : `${pendingBookings.length} booking(s) awaiting approval`}
                </span>
              )}
              {approvedBookings.length > 0 && (
                <span className="text-blue-600 dark:text-blue-300">
                  {lang === "ar"
                    ? `${approvedBookings.length} حجز بانتظار تأكيد الدفع`
                    : `${approvedBookings.length} booking(s) awaiting payment confirmation`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href="/admin/knowledge-base">
            <Button variant="outline" className="gap-2">
              <BookOpen className="h-4 w-4" />
              {lang === "ar" ? "قاعدة المعرفة" : "Knowledge Base"}
            </Button>
          </Link>
          <Link href="/admin/cities">
            <Button variant="outline" className="gap-2">
              <Building2 className="h-4 w-4" />
              {lang === "ar" ? "إدارة المدن والأحياء" : "Cities & Districts"}
            </Button>
          </Link>
          <Link href="/admin/managers">
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              {lang === "ar" ? "مدراء العقارات" : "Property Managers"}
            </Button>
          </Link>
          <Link href="/admin/services">
            <Button variant="outline" className="gap-2">
              <Package className="h-4 w-4" />
              {lang === "ar" ? "إدارة الخدمات" : "Services Management"}
            </Button>
          </Link>
          <Link href="/admin/emergency-maintenance">
            <Button variant="outline" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              {lang === "ar" ? "طوارئ الصيانة" : "Emergency Maintenance"}
            </Button>
          </Link>
          <Link href="/admin/analytics">
            <Button variant="outline" className="gap-2 border-[#3ECFC0] text-[#3ECFC0] hover:bg-[#3ECFC0]/10">
              <BarChart3 className="h-4 w-4" />
              {lang === "ar" ? "التحليلات" : "Analytics"}
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button variant="outline" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              {lang === "ar" ? "إعدادات المنصة" : "Platform Settings"}
            </Button>
          </Link>
          <Link href="/admin/permissions">
            <Button variant="outline" className="gap-2 border-amber-500 text-amber-500 hover:bg-amber-500/10">
              <Shield className="h-4 w-4" />
              {lang === "ar" ? "الأدوار والصلاحيات" : "Roles & Permissions"}
            </Button>
          </Link>
          <Link href="/admin/ai-ratings">
            <Button variant="outline" className="gap-2 border-purple-500 text-purple-500 hover:bg-purple-500/10">
              <Star className="h-4 w-4" />
              {lang === "ar" ? "تقييمات المساعد الذكي" : "AI Ratings"}
            </Button>
          </Link>
          <Link href="/admin/ai-control">
            <Button variant="outline" className="gap-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500/10">
              <Bot className="h-4 w-4" />
              {lang === "ar" ? "لوحة تحكم الذكاء الاصطناعي" : "AI Control Panel"}
            </Button>
          </Link>
          <Link href="/admin/help-center">
            <Button variant="outline" className="gap-2 border-blue-500 text-blue-500 hover:bg-blue-500/10">
              <HelpCircle className="h-4 w-4" />
              {lang === "ar" ? "مركز المساعدة" : "Help Center"}
            </Button>
          </Link>
          <Link href="/admin/ai-copilot">
            <Button variant="outline" className="gap-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500/10">
              <MessageSquare className="h-4 w-4" />
              {lang === "ar" ? "مساعد الإدارة الذكي" : "Admin AI Copilot"}
            </Button>
          </Link>
          <Link href="/admin/my-account">
            <Button variant="outline" className="gap-2 border-amber-500 text-amber-500 hover:bg-amber-500/10">
              <UserCog className="h-4 w-4" />
              {lang === "ar" ? "حسابي" : "My Account"}
            </Button>
          </Link>
          <Link href="/admin/payments">
            <Button variant="outline" className="gap-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600/10">
              <CreditCard className="h-4 w-4" />
              {lang === "ar" ? "سجل المدفوعات" : "Payments Registry"}
            </Button>
          </Link>
          <Link href="/admin/buildings">
            <Button variant="outline" className="gap-2 border-sky-600 text-sky-600 hover:bg-sky-600/10">
              <Building2 className="h-4 w-4" />
              {lang === "ar" ? "نظرة عامة على المباني" : "Building Overview"}
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5 relative">
              <div className="absolute top-0 end-0 w-20 h-20 bg-[#3ECFC0]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-[#3ECFC0]" />
                </div>
              </div>
              <div className="text-2xl font-heading font-bold">{stats.data?.userCount ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("dashboard.totalUsers")}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5 relative">
              <div className="absolute top-0 end-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <div className="text-2xl font-heading font-bold">{stats.data?.activeProperties ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("dashboard.activeListings")}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5 relative">
              <div className="absolute top-0 end-0 w-20 h-20 bg-[#C9A96E]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#C9A96E]/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-[#C9A96E]" />
                </div>
              </div>
              <div className="text-2xl font-heading font-bold">{stats.data?.pendingProperties ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("dashboard.pendingApproval")}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-[#0B1E2D] to-[#132d42]">
            <CardContent className="p-5 relative">
              <div className="absolute top-0 end-0 w-20 h-20 bg-[#3ECFC0]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#3ECFC0]/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-[#3ECFC0]" />
                </div>
              </div>
              <div className="text-2xl font-heading font-bold text-white">{Number(stats.data?.totalRevenue ?? 0).toLocaleString()}</div>
              <div className="text-xs text-white/60 mt-0.5">{t("payment.sar")} {t("dashboard.revenue")}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="bookings" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              {t("dashboard.allBookings")}
              {pendingBookings.length > 0 && (
                <Badge className="h-5 px-1.5 text-[10px] bg-amber-500 text-white border-0">{pendingBookings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="properties" className="gap-1.5"><Building2 className="h-4 w-4" />{t("dashboard.allProperties")}</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />{t("dashboard.users")}</TabsTrigger>
          </TabsList>

          {/* Bookings - Enhanced with approval workflow */}
          <TabsContent value="bookings">
            {bookings.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : bookings.data && bookings.data.length > 0 ? (
              <div className="space-y-3">
                {bookings.data.map((b: any) => (
                  <Card key={b.id} className={`transition-all ${b.status === "pending" ? "border-amber-500/50 shadow-amber-500/10 shadow-md" : b.status === "approved" ? "border-blue-500/50 shadow-blue-500/10 shadow-md" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Booking info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-semibold text-base">{lang === "ar" ? `حجز #${b.id}` : `Booking #${b.id}`}</span>
                            <BookingStatusBadge status={b.status} lang={lang} />
                          </div>
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(b.moveInDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")} — {new Date(b.moveOutDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                            </div>
                            {b.tenantId && (
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                {lang === "ar" ? `المستأجر #${b.tenantId}` : `Tenant #${b.tenantId}`}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-end sm:text-center shrink-0">
                          <div className="font-bold text-lg text-primary">{Number(b.totalAmount).toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{t("payment.sar")}</div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {b.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white gap-1"
                                onClick={() => setApproveDialog({ open: true, bookingId: b.id })}
                                disabled={approveBooking.isPending}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {lang === "ar" ? "موافقة وإرسال الفاتورة" : "Approve & Send Bill"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                onClick={() => setRejectDialog({ open: true, bookingId: b.id })}
                                disabled={rejectBooking.isPending}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {lang === "ar" ? "رفض" : "Reject"}
                              </Button>
                            </>
                          )}
                          {b.status === "approved" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
                                onClick={() => setConfirmDialog({ open: true, bookingId: b.id })}
                                disabled={confirmPayment.isPending}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                {lang === "ar" ? "تأكيد الدفع" : "Confirm Payment"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => sendReminder.mutate({ bookingId: b.id })}
                                disabled={sendReminder.isPending}
                              >
                                <Send className="h-3.5 w-3.5" />
                                {lang === "ar" ? "تذكير بالدفع" : "Send Reminder"}
                              </Button>
                            </>
                          )}
                          {b.status === "active" && (
                            <Link href={`/admin/lease/${b.id}`}>
                              <Button size="sm" variant="outline" className="gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                {lang === "ar" ? "عقد الإيجار" : "Lease Contract"}
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Rejection reason display */}
                      {b.status === "rejected" && b.rejectionReason && (
                        <div className="mt-3 p-2.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
                          <span className="font-medium text-red-700 dark:text-red-400">
                            {lang === "ar" ? "سبب الرفض: " : "Rejection reason: "}
                          </span>
                          <span className="text-red-600 dark:text-red-300">{b.rejectionReason}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد حجوزات" : "No bookings"}</p>
              </Card>
            )}
          </TabsContent>

          {/* Properties */}
          <TabsContent value="properties">
            {properties.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : properties.data && properties.data.length > 0 ? (
              <div className="space-y-3">
                {properties.data.map((p: any) => (
                  <Card key={p.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{lang === "ar" ? p.titleAr : p.titleEn}</span>
                          <Badge variant={p.status === "active" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>{p.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lang === "ar" ? p.cityAr : p.city} • {Number(p.monthlyRent).toLocaleString()} {t("payment.sar")}
                        </div>
                      </div>
                      {p.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approveProp.mutate({ id: p.id, status: "active" })}>
                            <CheckCircle className="h-4 w-4 me-1" />{lang === "ar" ? "موافقة" : "Approve"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => approveProp.mutate({ id: p.id, status: "rejected" })}>
                            <XCircle className="h-4 w-4 me-1" />{lang === "ar" ? "رفض" : "Reject"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد عقارات" : "No properties"}</p>
              </Card>
            )}
          </TabsContent>

          {/* Users */}
          <TabsContent value="users">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={lang === "ar" ? "ابحث بالاسم أو الإيميل أو الهاتف..." : "Search by name, email, or phone..."}
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={lang === "ar" ? "كل الأدوار" : "All Roles"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "ar" ? "كل الأدوار" : "All Roles"}</SelectItem>
                  <SelectItem value="admin">{lang === "ar" ? "مدير" : "Admin"}</SelectItem>
                  <SelectItem value="landlord">{lang === "ar" ? "مالك" : "Landlord"}</SelectItem>
                  <SelectItem value="tenant">{lang === "ar" ? "مستأجر" : "Tenant"}</SelectItem>
                  <SelectItem value="user">{lang === "ar" ? "مستخدم" : "User"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Results count */}
            {users.data && (
              <p className="text-sm text-muted-foreground mb-3">
                {lang === "ar" ? `${users.data.length} مستخدم` : `${users.data.length} user(s) found`}
              </p>
            )}
            {users.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : users.data && users.data.length > 0 ? (
              <div className="space-y-2">
                {users.data.map((u: any) => {
                  const roleColors: Record<string, string> = {
                    admin: "bg-red-500/10 text-red-600 border-red-200 dark:text-red-400",
                    landlord: "bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400",
                    tenant: "bg-green-500/10 text-green-600 border-green-200 dark:text-green-400",
                    user: "bg-gray-500/10 text-gray-600 border-gray-200 dark:text-gray-400",
                  };
                  const roleLabels: Record<string, { ar: string; en: string }> = {
                    admin: { ar: "مدير", en: "Admin" },
                    landlord: { ar: "مالك", en: "Landlord" },
                    tenant: { ar: "مستأجر", en: "Tenant" },
                    user: { ar: "مستخدم", en: "User" },
                  };
                  return (
                    <Card key={u.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-sm font-bold text-primary">
                                {(u.nameAr || u.name || u.displayName || "?").charAt(0)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold truncate">{u.nameAr || u.name || u.displayName || "—"}</span>
                                <Badge className={`text-xs ${roleColors[u.role] || roleColors.user}`}>
                                  {roleLabels[u.role]?.[lang === "ar" ? "ar" : "en"] || u.role}
                                </Badge>
                                {u.isRootAdmin && <Badge className="text-xs bg-red-600 text-white border-0">{lang === "ar" ? "مدير أساسي" : "Root Admin"}</Badge>}
                                {u.isVerified && <Badge variant="outline" className="text-xs text-green-600 border-green-300">{lang === "ar" ? "موثق" : "Verified"}</Badge>}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">{u.email || "—"}</div>
                              {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-xs text-muted-foreground text-end hidden sm:block">
                              <div>{lang === "ar" ? "انضم" : "Joined"}</div>
                              <div>{new Date(u.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</div>
                            </div>
                            {u.isRootAdmin ? (
                              <Badge variant="outline" className="text-xs text-red-500 border-red-300">
                                {lang === "ar" ? "محمي" : "Protected"}
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setRoleChangeUser({ id: u.id, name: u.nameAr || u.name || u.displayName || u.email || "—", currentRole: u.role }); setNewRole(u.role); }}
                                className="gap-1.5"
                              >
                                <UserCog className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{lang === "ar" ? "تغيير الدور" : "Change Role"}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {userSearch
                    ? (lang === "ar" ? `لا توجد نتائج لـ "${userSearch}"` : `No results for "${userSearch}"`)
                    : (lang === "ar" ? "لا يوجد مستخدمون" : "No users")}
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onOpenChange={(open) => { setApproveDialog({ open, bookingId: open ? approveDialog.bookingId : null }); if (!open) setApproveNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "موافقة على الحجز" : "Approve Booking"}</DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "سيتم قبول الحجز وإنشاء فاتورة وإرسال إشعار للمستأجر بالدفع."
                : "This will approve the booking, create a bill, and notify the tenant to pay."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {lang === "ar" ? "ملاحظات (اختياري)" : "Notes (optional)"}
            </label>
            <Textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder={lang === "ar" ? "أي ملاحظات للمستأجر..." : "Any notes for the tenant..."}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog({ open: false, bookingId: null })}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
              onClick={() => {
                if (approveDialog.bookingId) {
                  approveBooking.mutate({ id: approveDialog.bookingId, landlordNotes: approveNotes || undefined });
                }
              }}
              disabled={approveBooking.isPending}
            >
              {approveBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4" />
              {lang === "ar" ? "موافقة وإرسال الفاتورة" : "Approve & Send Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => { setRejectDialog({ open, bookingId: open ? rejectDialog.bookingId : null }); if (!open) setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "رفض الحجز" : "Reject Booking"}</DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "يرجى ذكر سبب الرفض. سيتم إشعار المستأجر."
                : "Please provide a reason for rejection. The tenant will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {lang === "ar" ? "سبب الرفض *" : "Rejection Reason *"}
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={lang === "ar" ? "اذكر سبب رفض الحجز..." : "Explain why the booking is rejected..."}
              rows={3}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, bookingId: null })}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              className="gap-1"
              onClick={() => {
                if (rejectDialog.bookingId && rejectReason.trim()) {
                  rejectBooking.mutate({ id: rejectDialog.bookingId, rejectionReason: rejectReason.trim() });
                }
              }}
              disabled={rejectBooking.isPending || !rejectReason.trim()}
            >
              {rejectBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <XCircle className="h-4 w-4" />
              {lang === "ar" ? "رفض الحجز" : "Reject Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => { setConfirmDialog({ open, bookingId: open ? confirmDialog.bookingId : null }); if (!open) setPaymentMethod("cash"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تأكيد استلام الدفع" : "Confirm Payment Received"}</DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "تأكيد أنه تم استلام الدفع من المستأجر. سيتم تفعيل الحجز وإشعار المستأجر."
                : "Confirm that payment has been received from the tenant. The booking will be activated and the tenant notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {lang === "ar" ? "طريقة الدفع" : "Payment Method"}
            </label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{lang === "ar" ? "نقداً" : "Cash"}</SelectItem>
                <SelectItem value="bank_transfer">{lang === "ar" ? "تحويل بنكي" : "Bank Transfer"}</SelectItem>
                <SelectItem value="paypal">{lang === "ar" ? "PayPal" : "PayPal"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, bookingId: null })}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
              onClick={() => {
                if (confirmDialog.bookingId) {
                  confirmPayment.mutate({
                    bookingId: confirmDialog.bookingId,
                    paymentMethod: paymentMethod as "paypal" | "cash" | "bank_transfer",
                  });
                }
              }}
              disabled={confirmPayment.isPending}
            >
              {confirmPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <CreditCard className="h-4 w-4" />
              {lang === "ar" ? "تأكيد الدفع" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeUser} onOpenChange={(open) => { if (!open) { setRoleChangeUser(null); setNewRole(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تغيير دور المستخدم" : "Change User Role"}</DialogTitle>
            <DialogDescription>
              {roleChangeUser && (
                <span>{lang === "ar" ? `تغيير دور: ${roleChangeUser.name}` : `Changing role for: ${roleChangeUser.name}`}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* System Role (user/admin/landlord/tenant) */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {lang === "ar" ? "الدور الأساسي" : "Base Role"}
              </label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{lang === "ar" ? "مستخدم عادي" : "User"}</SelectItem>
                  <SelectItem value="tenant">{lang === "ar" ? "مستأجر" : "Tenant"}</SelectItem>
                  <SelectItem value="landlord">{lang === "ar" ? "مالك عقار" : "Landlord"}</SelectItem>
                  <SelectItem value="admin">{lang === "ar" ? "مدير نظام" : "System Admin"}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar" ? "يحدد نوع الحساب والواجهة التي يراها المستخدم" : "Determines account type and which interface the user sees"}
              </p>
            </div>
            {/* Permission Role (from roles table) */}
            {newRole === "admin" && rolesQuery.data && rolesQuery.data.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {lang === "ar" ? "دور الصلاحيات (اختياري)" : "Permission Role (optional)"}
                </label>
                <div className="space-y-2">
                  {rolesQuery.data.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        if (roleChangeUser) {
                          assignRole.mutate({ userId: roleChangeUser.id, roleId: r.id });
                        }
                      }}
                      disabled={assignRole.isPending}
                      className="w-full text-start p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{lang === "ar" ? r.nameAr : r.name}</div>
                          <div className="text-xs text-muted-foreground">{lang === "ar" ? r.descriptionAr : r.description}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {(r.permissions as string[])?.length || 0} {lang === "ar" ? "صلاحية" : "permissions"}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "ar" ? "اضغط على دور لتعيين صلاحياته للمستخدم (مثل: محاسب، مدير عقارات، موظف دعم)" : "Click a role to assign its permissions to the user (e.g., Accountant, Property Manager, Support Agent)"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRoleChangeUser(null); setNewRole(""); }}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                if (roleChangeUser && newRole) {
                  updateUserRole.mutate({ userId: roleChangeUser.id, role: newRole as any });
                }
              }}
              disabled={updateUserRole.isPending || !newRole || newRole === roleChangeUser?.currentRole}
              className="gap-1.5"
            >
              {updateUserRole.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <UserCog className="h-4 w-4" />
              {lang === "ar" ? "حفظ الدور" : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
