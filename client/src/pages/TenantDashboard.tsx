import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Home, Calendar, CreditCard, Heart, Wrench, Bell, Settings, User,
  Loader2, Building2, Clock, CheckCircle, XCircle, AlertCircle,
  Phone, Mail, MapPin, FileText, Camera, Save, Eye, Upload, X, ImageIcon, Video, Play,
  EyeOff, MessageSquare
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { normalizeMediaUrl } from "@/lib/utils";
import { SafeMediaThumb } from "@/components/SafeMediaThumb";
import { MediaLightbox } from "@/components/MediaLightbox";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";

/* ─── Bilingual status badge helper ─── */
const statusBadge = (status: string, lang: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; labelAr: string }> = {
    pending: { variant: "secondary", label: "Pending Review", labelAr: "بانتظار المراجعة" },
    approved: { variant: "outline", label: "Awaiting Payment", labelAr: "بانتظار الدفع" },
    active: { variant: "default", label: "Active", labelAr: "نشط" },
    rejected: { variant: "destructive", label: "Rejected", labelAr: "مرفوض" },
    cancelled: { variant: "destructive", label: "Cancelled", labelAr: "ملغي" },
    completed: { variant: "outline", label: "Completed", labelAr: "مكتمل" },
    submitted: { variant: "secondary", label: "Submitted", labelAr: "تم الإرسال" },
    acknowledged: { variant: "secondary", label: "Acknowledged", labelAr: "تم الاستلام" },
    in_progress: { variant: "default", label: "In Progress", labelAr: "قيد التنفيذ" },
  };
  const s = map[status] || { variant: "secondary" as const, label: status, labelAr: status };
  return <Badge variant={s.variant}>{lang === "ar" ? s.labelAr : s.label}</Badge>;
};

/* ─── RTL-aware timeline arrow ─── */
const TimelineArrow = ({ isRtl }: { isRtl: boolean }) => (
  <span className="text-muted-foreground text-xs select-none">{isRtl ? "\u2190" : "\u2192"}</span>
);

export default function TenantDashboard() {
  const { t, lang, dir } = useI18n();
  const isAr = lang === "ar";
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Profile state
  const [profileForm, setProfileForm] = useState({
    phone: "", nationalId: "", dateOfBirth: "", nationality: "",
    emergencyContact: "", emergencyPhone: "",
    address: "", city: "", bio: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = trpc.upload.file.useMutation();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(isAr ? "حجم الصورة يجب أن يكون أقل من 5 ميجا" : "Image must be under 5MB"); return; }
    setUploadingAvatar(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const result = await uploadFile.mutateAsync({ base64, filename: file.name, contentType: file.type });
      await updateProfile.mutateAsync({ avatarUrl: result.url });
      toast.success(isAr ? "تم رفع الصورة بنجاح" : "Photo uploaded successfully");
    } catch { toast.error(isAr ? "فشل رفع الصورة" : "Failed to upload photo"); }
    setUploadingAvatar(false);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(isAr ? "حجم الملف يجب أن يكون أقل من 10 ميجا" : "File must be under 10MB"); return; }
    setUploadingDoc(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const result = await uploadFile.mutateAsync({ base64, filename: file.name, contentType: file.type });
      await updateProfile.mutateAsync({ idDocumentUrl: result.url });
      toast.success(isAr ? "تم رفع المستند بنجاح" : "Document uploaded successfully");
    } catch { toast.error(isAr ? "فشل رفع المستند" : "Failed to upload document"); }
    setUploadingDoc(false);
  };

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { toast.success(isAr ? "تم حفظ الملف الشخصي" : "Profile saved successfully"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Load user data into form
  useEffect(() => {
    if (user) {
      setProfileForm({
        phone: (user as any).phone || "",
        nationalId: (user as any).nationalId || "",
        dateOfBirth: (user as any).dateOfBirth || "",
        nationality: (user as any).nationality || "",
        emergencyContact: (user as any).emergencyContact || "",
        emergencyPhone: (user as any).emergencyPhone || "",
        address: (user as any).address || "",
        city: (user as any).city || "",
        bio: (user as any).bio || "",
      });
    }
  }, [user]);

  const bookings = trpc.booking.myBookings.useQuery(undefined, { enabled: isAuthenticated });
  const payments = trpc.payment.myPayments.useQuery(undefined, { enabled: isAuthenticated });
  const favorites = trpc.favorite.list.useQuery(undefined, { enabled: isAuthenticated });
  const maintenance = trpc.maintenance.myRequests.useQuery(undefined, { enabled: isAuthenticated });
  const notifications = trpc.notification.list.useQuery(undefined, { enabled: isAuthenticated });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <SEOHead title={isAr ? "لوحة المستأجر" : "Tenant Dashboard"} titleAr="لوحة المستأجر" path="/tenant" noindex={true} />
      <Navbar />
      <div className="container py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">{t("dashboard.tenant")}</h1>
          <p className="text-muted-foreground mt-1">
            {isAr ? `مرحباً، ${user?.name || ""}` : `Welcome, ${user?.name || ""}`}
          </p>
        </div>

        <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "bookings"} className="space-y-6">
          {/* ─── Tab Navigation ─── */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-auto gap-1 p-1 w-max min-w-full sm:min-w-0 sm:flex-wrap">
              <TabsTrigger value="bookings" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Calendar className="h-4 w-4 shrink-0" />{t("dashboard.myBookings")}</TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><CreditCard className="h-4 w-4 shrink-0" />{t("dashboard.myPayments")}</TabsTrigger>
              <TabsTrigger value="favorites" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Heart className="h-4 w-4 shrink-0" />{t("dashboard.favorites")}</TabsTrigger>
              <TabsTrigger value="maintenance" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Wrench className="h-4 w-4 shrink-0" />{t("dashboard.maintenance")}</TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Bell className="h-4 w-4 shrink-0" />{t("nav.notifications")}</TabsTrigger>
              <TabsTrigger value="profile" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><User className="h-4 w-4 shrink-0" />{isAr ? "الملف الشخصي" : "Profile"}</TabsTrigger>
              <TabsTrigger value="inspections" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Eye className="h-4 w-4 shrink-0" />{isAr ? "طلبات المعاينة" : "Inspections"}</TabsTrigger>
              <TabsTrigger value="services" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Building2 className="h-4 w-4 shrink-0" />{isAr ? "الخدمات" : "Services"}</TabsTrigger>
              <TabsTrigger value="emergency" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><AlertCircle className="h-4 w-4 shrink-0" />{isAr ? "طوارئ الصيانة" : "Emergency"}</TabsTrigger>
              <TabsTrigger value="enquiries" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><MessageSquare className="h-4 w-4 shrink-0" />{isAr ? "الاستفسارات" : "Enquiries"}</TabsTrigger>
              <TabsTrigger value="hidden" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><EyeOff className="h-4 w-4 shrink-0" />{isAr ? "المخفية" : "Hidden"}</TabsTrigger>
            </TabsList>
          </div>

          {/* ═══════════ BOOKINGS TAB ═══════════ */}
          <TabsContent value="bookings">
            {bookings.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : bookings.data && bookings.data.length > 0 ? (
              <div className="space-y-3">
                {bookings.data.map((b) => (
                  <Card key={b.id} className="card-hover transition-shadow">
                    <CardContent className="p-4">
                      {/* Booking header row */}
                      <div className="flex items-center justify-between cursor-pointer booking-header-row" onClick={() => setLocation(`/property/${b.propertyId}`)}>
                        <div className="flex-1 min-w-0 booking-info">
                          <div className="flex items-center gap-2 mb-1 flex-wrap badge-row">
                            <span className="font-semibold">{isAr ? `حجز #${b.id}` : `Booking #${b.id}`}</span>
                            {statusBadge(b.status, lang)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(b.moveInDate).toLocaleDateString(isAr ? "ar-SA" : "en-US")} — {new Date(b.moveOutDate).toLocaleDateString(isAr ? "ar-SA" : "en-US")}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {b.durationMonths} {t("booking.months")} • <span className="currency-amount">{Number(b.monthlyRent).toLocaleString()}</span> {t("payment.sar")}{t("property.perMonth")}
                          </div>
                        </div>
                        <div className={`shrink-0 booking-amount ${isAr ? "text-start ms-4" : "text-end ms-4"}`}>
                          <div className="font-bold text-primary"><span className="currency-amount">{Number(b.totalAmount).toLocaleString()}</span> {t("payment.sar")}</div>
                          <div className="text-xs text-muted-foreground">{t("common.total")}</div>
                        </div>
                      </div>

                      {/* Booking Timeline — RTL-aware */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 section-header-row">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{isAr ? "الجدول الزمني" : "Timeline"}</span>
                        </div>
                        <div className={`flex items-center gap-1 flex-wrap ${isAr ? "flex-row-reverse" : ""}`}>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "pending" || b.status === "approved" || b.status === "active" || b.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {isAr ? "تم الطلب" : "Requested"}
                          </span>
                          <TimelineArrow isRtl={isAr} />
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "approved" || b.status === "active" || b.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : b.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {b.status === "rejected" ? (isAr ? "مرفوض" : "Rejected") : (isAr ? "موافق عليه" : "Approved")}
                          </span>
                          <TimelineArrow isRtl={isAr} />
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "active" || b.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {isAr ? "تم الدفع" : "Paid"}
                          </span>
                          <TimelineArrow isRtl={isAr} />
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "active" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : b.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {b.status === "completed" ? (isAr ? "مكتمل" : "Completed") : (isAr ? "نشط" : "Active")}
                          </span>
                        </div>
                      </div>

                      {/* Ledger / Invoice Info */}
                      {(b as any).ledgerEntries?.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 section-header-row">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span>{isAr ? "الفاتورة" : "Invoice"}</span>
                          </div>
                          {(b as any).ledgerEntries.map((le: any) => (
                            <div key={le.id} className="flex items-center justify-between text-xs p-2 rounded border bg-muted/30 mb-1 invoice-row">
                              <div className="flex items-center gap-2 badge-row">
                                <span className="font-mono invoice-code">{le.invoiceNumber}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                                  le.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                  le.status === 'VOID' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                                  le.status === 'DUE' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' :
                                  'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                }`}>
                                  {le.status === 'PAID' ? (isAr ? 'مدفوع' : 'Paid') :
                                   le.status === 'VOID' ? (isAr ? 'ملغي' : 'Void') :
                                   le.status === 'DUE' ? (isAr ? 'مستحق' : 'Due') : le.status}
                                </span>
                              </div>
                              <span className="font-medium"><span className="currency-amount">{Number(le.amount).toLocaleString()}</span> {isAr ? "ر.س" : le.currency}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Approved — Payment CTA */}
                      {b.status === "approved" && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <div className="p-2.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium mb-1 alert-row">
                              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                              {isAr ? "تم قبول طلبك! يرجى إكمال الدفع" : "Your request was approved! Please complete payment"}
                            </div>
                            {(b as any).landlordNotes && (
                              <p className="text-blue-600 dark:text-blue-300 text-xs">{(b as any).landlordNotes}</p>
                            )}
                          </div>
                          {(b as any).paymentConfigured ? (
                            <Button
                              className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] font-semibold border-0 h-11"
                              onClick={(e) => {
                                e.stopPropagation();
                                const dueLedger = (b as any).ledgerEntries?.find((l: any) => l.status === 'DUE');
                                if (dueLedger) {
                                  setLocation(`/pay/${b.id}?ledgerId=${dueLedger.id}`);
                                } else {
                                  toast.error(isAr ? 'لا توجد فاتورة مستحقة' : 'No DUE invoice found');
                                }
                              }}
                            >
                              <CreditCard className="h-4 w-4 me-2" />
                              {isAr ? "ادفع الآن" : "Pay Now"}
                              <span className="ms-2 text-xs opacity-80">(<span className="currency-amount">{Number(b.totalAmount).toLocaleString()}</span> {t("payment.sar")})</span>
                            </Button>
                          ) : (
                            <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
                              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium alert-row">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                {isAr ? "الدفع الإلكتروني غير مفعّل حالياً — يرجى التواصل مع الإدارة" : "Online payment not configured — please contact admin"}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rejected reason */}
                      {b.status === "rejected" && (b as any).rejectionReason && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
                            <span className="font-medium text-red-700 dark:text-red-400">
                              {isAr ? "سبب الرفض: " : "Rejection reason: "}
                            </span>
                            <span className="text-red-600 dark:text-red-300">{(b as any).rejectionReason}</span>
                          </div>
                        </div>
                      )}

                      {/* Active booking */}
                      {b.status === "active" && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="p-2.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm">
                            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium alert-row">
                              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                              {isAr ? "الحجز نشط — تم تأكيد الدفع" : "Booking active — Payment confirmed"}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{isAr ? "لا توجد حجوزات بعد" : "No bookings yet"}</p>
                <Button className="mt-4" onClick={() => setLocation("/search")}>{t("nav.search")}</Button>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ PAYMENTS TAB ═══════════ */}
          <TabsContent value="payments">
            {payments.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : payments.data && payments.data.length > 0 ? (
              <div className="space-y-3">
                {payments.data.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4 flex items-center justify-between payment-row">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap badge-row">
                          <span className="font-semibold">{t(`payment.${p.type}` as any)}</span>
                          {statusBadge(p.status, lang)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}
                        </div>
                      </div>
                      <div className="font-bold text-primary shrink-0 ms-4"><span className="currency-amount">{Number(p.amount).toLocaleString()}</span> {t("payment.sar")}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{isAr ? "لا توجد مدفوعات" : "No payments yet"}</p>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ FAVORITES TAB ═══════════ */}
          <TabsContent value="favorites">
            {favorites.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full" />)}
              </div>
            ) : favorites.data && favorites.data.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.data.map((prop) => (
                  <PropertyCard key={prop.id} property={prop} />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{isAr ? "لا توجد عقارات مفضلة" : "No favorites yet"}</p>
                <Button className="mt-4" onClick={() => setLocation("/search")}>{t("nav.search")}</Button>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ MAINTENANCE TAB ═══════════ */}
          <TabsContent value="maintenance">
            {maintenance.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : maintenance.data && maintenance.data.length > 0 ? (
              <div className="space-y-3">
                {maintenance.data.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2 maintenance-row">
                        <div className="flex items-center gap-2 flex-wrap badge-row">
                          <span className="font-semibold">{m.title}</span>
                          {statusBadge(m.status, lang)}
                        </div>
                        {m.priority && (
                          <Badge variant={m.priority === "emergency" ? "destructive" : "secondary"}>
                            {t(`maintenance.${m.priority}` as any)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>
                      {m.landlordResponse && (
                        <div className="mt-2 p-2 bg-secondary rounded text-sm">
                          <span className="font-medium">{isAr ? "رد المالك:" : "Landlord Response:"}</span> {m.landlordResponse}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{isAr ? "لا توجد طلبات صيانة" : "No maintenance requests"}</p>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ NOTIFICATIONS TAB ═══════════ */}
          <TabsContent value="notifications">
            {notifications.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : notifications.data && notifications.data.length > 0 ? (
              <div className="space-y-2">
                {notifications.data.map((n) => (
                  <Card key={n.id} className={`${!n.isRead ? "border-primary/30 bg-primary/5" : ""}`}>
                    <CardContent className="p-4 flex items-start gap-3 notification-row">
                      <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} style={isAr ? {order: 2} : undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{isAr ? n.titleAr : n.titleEn}</div>
                        {(n.contentEn || n.contentAr) && (
                          <p className="text-xs text-muted-foreground mt-0.5">{isAr ? n.contentAr : n.contentEn}</p>
                        )}
                        <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{isAr ? "لا توجد إشعارات" : "No notifications"}</p>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ PROFILE TAB ═══════════ */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 section-header-row">
                  <User className="h-5 w-5 text-[#3ECFC0]" />
                  {isAr ? "الملف الشخصي" : "Personal Profile"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Verification Status Badges */}
                <div className="bg-muted/20 rounded-xl p-4 border">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm section-header-row">
                    <CheckCircle className="h-4 w-4 text-[#3ECFC0] shrink-0" />
                    {isAr ? "حالة التحقق" : "Verification Status"}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={(user as any)?.emailVerified ? "default" : "secondary"} className="text-xs gap-1">
                      <Mail className="w-3 h-3" />
                      {isAr ? "البريد" : "Email"} {(user as any)?.emailVerified ? "✓" : "✗"}
                    </Badge>
                    <Badge variant={(user as any)?.phoneVerified ? "default" : "secondary"} className="text-xs gap-1">
                      <Phone className="w-3 h-3" />
                      {isAr ? "الهاتف" : "Phone"} {(user as any)?.phoneVerified ? "✓" : "✗"}
                    </Badge>
                    {user?.isVerified && (
                      <Badge className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        {isAr ? "موثق بالكامل" : "Fully Verified"}
                      </Badge>
                    )}
                    {(user as any)?.kycStatus === "verified" && (
                      <Badge className="text-xs gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <CheckCircle className="w-3 h-3" />
                        {isAr ? "هوية موثقة" : "Identity Verified"}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Avatar Upload Section */}
                <div className="bg-muted/30 rounded-xl p-6 border border-dashed border-[#3ECFC0]/30">
                  <h4 className="font-semibold mb-4 flex items-center gap-2 text-sm section-header-row">
                    <Camera className="h-4 w-4 text-[#3ECFC0] shrink-0" />
                    {isAr ? "الصورة الشخصية" : "Profile Photo"}
                  </h4>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Avatar Preview */}
                    <div className="relative group cursor-pointer shrink-0" onClick={() => avatarInputRef.current?.click()}>
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-28 h-28 rounded-full object-cover border-4 border-[#3ECFC0]/20 shadow-lg" />
                      ) : (
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#3ECFC0]/20 to-[#3ECFC0]/5 flex items-center justify-center border-4 border-dashed border-[#3ECFC0]/30">
                          <User className="h-10 w-10 text-[#3ECFC0]/60" />
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploadingAvatar ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                      </div>
                      <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarUpload} />
                    </div>
                    {/* Upload Info & Actions */}
                    <div className="flex-1 text-center sm:text-start space-y-3">
                      <div>
                        <p className="text-sm font-medium">{isAr ? "اضغط على الصورة لتحديثها" : "Click the photo to update it"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{isAr ? "JPG أو PNG أو WebP — الحد الأقصى 5 ميجابايت" : "JPG, PNG or WebP — max 5MB"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                          {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                          {isAr ? "رفع صورة جديدة" : "Upload New Photo"}
                        </Button>
                        {user?.avatarUrl && (
                          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={async () => {
                            try {
                              await updateProfile.mutateAsync({ avatarUrl: "" });
                              toast.success(isAr ? "تم إزالة الصورة" : "Photo removed");
                            } catch { toast.error(isAr ? "فشل إزالة الصورة" : "Failed to remove photo"); }
                          }}>
                            <XCircle className="h-3.5 w-3.5" />
                            {isAr ? "إزالة" : "Remove"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Info & Profile Completion */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-heading font-bold">{user?.name}</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{user?.role === "admin" ? (isAr ? "مدير" : "Admin") : (isAr ? "مستأجر" : "Tenant")}</Badge>
                    </div>
                    {/* Profile Completion */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{isAr ? "اكتمال الملف" : "Profile Completion"}</span>
                        <span className="font-semibold text-[#3ECFC0]">{(user as any)?.profileCompletionPct || 0}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#3ECFC0] rounded-full transition-all progress-bar-fill" style={{ width: `${(user as any)?.profileCompletionPct || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2 section-header-row">
                    <Phone className="h-4 w-4 text-[#3ECFC0] shrink-0" />
                    {isAr ? "معلومات التواصل" : "Contact Information"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isAr ? "رقم الهاتف" : "Phone Number"}</Label>
                      <Input dir="ltr" placeholder="05xxxxxxxx" value={profileForm.phone} onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? "المدينة" : "City"}</Label>
                      <Input value={profileForm.city} onChange={(e) => setProfileForm(p => ({ ...p, city: e.target.value }))} placeholder={isAr ? "الرياض" : "Riyadh"} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{isAr ? "العنوان" : "Address"}</Label>
                      <Input value={profileForm.address} onChange={(e) => setProfileForm(p => ({ ...p, address: e.target.value }))} placeholder={isAr ? "العنوان الكامل" : "Full address"} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Identity Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2 section-header-row">
                    <FileText className="h-4 w-4 text-[#3ECFC0] shrink-0" />
                    {isAr ? "معلومات الهوية" : "Identity Information"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isAr ? "رقم الهوية / الإقامة" : "National ID / Iqama"}</Label>
                      <Input dir="ltr" value={profileForm.nationalId} onChange={(e) => setProfileForm(p => ({ ...p, nationalId: e.target.value }))} placeholder="1xxxxxxxxx" />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? "تاريخ الميلاد" : "Date of Birth"}</Label>
                      <Input type="date" dir="ltr" value={profileForm.dateOfBirth} onChange={(e) => setProfileForm(p => ({ ...p, dateOfBirth: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? "الجنسية" : "Nationality"}</Label>
                      <Input value={profileForm.nationality} onChange={(e) => setProfileForm(p => ({ ...p, nationality: e.target.value }))} placeholder={isAr ? "سعودي" : "Saudi"} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Emergency Contact */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2 section-header-row">
                    <AlertCircle className="h-4 w-4 text-[#C9A96E] shrink-0" />
                    {isAr ? "جهة اتصال الطوارئ" : "Emergency Contact"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isAr ? "اسم جهة الاتصال" : "Contact Name"}</Label>
                      <Input value={profileForm.emergencyContact} onChange={(e) => setProfileForm(p => ({ ...p, emergencyContact: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? "رقم الطوارئ" : "Emergency Phone"}</Label>
                      <Input dir="ltr" value={profileForm.emergencyPhone} onChange={(e) => setProfileForm(p => ({ ...p, emergencyPhone: e.target.value }))} placeholder="05xxxxxxxx" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Bio */}
                <div className="space-y-2">
                  <Label>{isAr ? "نبذة شخصية" : "About Me"}</Label>
                  <Textarea value={profileForm.bio} onChange={(e) => setProfileForm(p => ({ ...p, bio: e.target.value }))} placeholder={isAr ? "أخبرنا عن نفسك..." : "Tell us about yourself..."} rows={3} />
                </div>

                {/* ID Document Upload */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2 section-header-row">
                    <FileText className="h-4 w-4 text-[#C9A96E] shrink-0" />
                    {isAr ? "مستند الهوية" : "ID Document"}
                  </h4>
                  {(user as any)?.idDocumentUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 doc-row">
                      <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      <span className="text-sm flex-1">{isAr ? "تم رفع مستند الهوية" : "ID document uploaded"}</span>
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => docInputRef.current?.click()}>
                        {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "تحديث" : "Update")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors doc-row" onClick={() => docInputRef.current?.click()}>
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                      <span className="text-sm flex-1">{isAr ? "يرجى رفع صورة الهوية / الإقامة" : "Please upload your ID / Iqama copy"}</span>
                      {uploadingDoc && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    </div>
                  )}
                  <input ref={docInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocUpload} />
                </div>

                <Separator />

                <Button
                  className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] font-semibold"
                  disabled={updateProfile.isPending}
                  onClick={() => updateProfile.mutate(profileForm)}
                >
                  <Save className="h-4 w-4 me-2" />
                  {updateProfile.isPending ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ الملف الشخصي" : "Save Profile")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ INSPECTIONS TAB ═══════════ */}
          <TabsContent value="inspections">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 section-header-row">
                  <Eye className="h-5 w-5 text-[#3ECFC0]" />
                  {isAr ? "طلبات المعاينة" : "Inspection Requests"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  <Eye className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  {isAr ? "طلبات المعاينة ستظهر هنا" : "Your inspection requests will appear here"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ SERVICES TAB ═══════════ */}
          <TabsContent value="services">
            <TenantServicesTab lang={lang} isAr={isAr} />
          </TabsContent>

          {/* ═══════════ EMERGENCY MAINTENANCE TAB ═══════════ */}
          <TabsContent value="emergency">
            <TenantEmergencyTab lang={lang} isAr={isAr} />
          </TabsContent>

          {/* ═══════════ ENQUIRIES TAB ═══════════ */}
          <TabsContent value="enquiries">
            <TenantEnquiriesTab lang={lang} isAr={isAr} />
          </TabsContent>

          {/* ═══════════ HIDDEN PROPERTIES TAB ═══════════ */}
          <TabsContent value="hidden">
            <TenantHiddenTab lang={lang} isAr={isAr} />
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

// ─── Tenant Services Tab ─────────────────────────────────────────────
function TenantServicesTab({ lang, isAr }: { lang: string; isAr: boolean }) {
  const services = trpc.services.listActive.useQuery();
  const myRequests = trpc.serviceRequests.myRequests.useQuery();
  const requestService = trpc.serviceRequests.create.useMutation({
    onSuccess: () => { myRequests.refetch(); toast.success(isAr ? "تم طلب الخدمة بنجاح" : "Service requested successfully"); },
  });
  const [selectedService, setSelectedService] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  const statusLabels: Record<string, { en: string; ar: string }> = {
    pending: { en: "Pending", ar: "قيد الانتظار" }, approved: { en: "Approved", ar: "مقبول" },
    in_progress: { en: "In Progress", ar: "قيد التنفيذ" }, completed: { en: "Completed", ar: "مكتمل" },
    cancelled: { en: "Cancelled", ar: "ملغي" },
  };

  return (
    <div className="space-y-6">
      {/* Available Services */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 section-header-row">
            <Building2 className="h-5 w-5 text-[#3ECFC0]" />
            {isAr ? "الخدمات المتاحة" : "Available Services"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {services.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#3ECFC0]" /></div>
          ) : services.data && services.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.data.map((s) => (
                <div key={s.id} className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedService?.id === s.id ? "border-[#3ECFC0] bg-[#3ECFC0]/5" : "hover:border-[#3ECFC0]/50"}`} onClick={() => setSelectedService(s)}>
                  <div className="flex justify-between items-start gap-3 service-row">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{isAr ? s.nameAr : s.nameEn}</h4>
                      <p className="text-sm text-muted-foreground">{isAr ? s.descriptionAr : s.descriptionEn}</p>
                    </div>
                    <span className="font-bold text-[#C9A96E] whitespace-nowrap shrink-0"><span className="currency-amount">{Number(s.price).toLocaleString()}</span> {isAr ? "ر.س" : "SAR"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">{isAr ? "لا توجد خدمات متاحة حالياً" : "No services available currently"}</p>
          )}
          {selectedService && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-semibold">{isAr ? `طلب: ${selectedService.nameAr}` : `Request: ${selectedService.nameEn}`}</h4>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={isAr ? "ملاحظات إضافية..." : "Additional notes..."} rows={2} />
              <Button onClick={() => { requestService.mutate({ serviceId: selectedService.id, totalPrice: String(selectedService.price), notes }); setSelectedService(null); setNotes(""); }} disabled={requestService.isPending} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
                {requestService.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {isAr ? "طلب الخدمة" : "Request Service"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Requests */}
      {myRequests.data && myRequests.data.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-heading">{isAr ? "طلباتي" : "My Requests"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {myRequests.data.map((r) => {
              const st = statusLabels[r.status] || statusLabels.pending;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border flex-wrap gap-2 request-row">
                  <div className="min-w-0">
                    <span className="font-medium">#{r.id} — {isAr ? `خدمة #${r.serviceId}` : `Service #${r.serviceId}`}</span>
                    <div className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-[#C9A96E]"><span className="currency-amount">{Number(r.totalPrice).toLocaleString()}</span> {isAr ? "ر.س" : "SAR"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[r.status] || ""}`}>{isAr ? st.ar : st.en}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tenant Emergency Maintenance Tab ────────────────────────────────
function TenantEmergencyTab({ lang, isAr }: { lang: string; isAr: boolean }) {
  const myRequests = trpc.emergencyMaintenance.myRequests.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ propertyId: 0, urgency: "medium" as string, category: "other" as string, title: "", titleAr: "", description: "", descriptionAr: "" });
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: "image" | "video"; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxItems, setLightboxItems] = useState<{url: string; type: "image" | "video"}[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bookings = trpc.booking.myBookings.useQuery();
  const uploadMedia = trpc.emergencyMaintenance.uploadMedia.useMutation();
  const createRequest = trpc.emergencyMaintenance.create.useMutation({
    onSuccess: () => { myRequests.refetch(); setShowForm(false); setForm({ propertyId: 0, urgency: "medium", category: "other", title: "", titleAr: "", description: "", descriptionAr: "" }); setMediaFiles([]); toast.success(isAr ? "تم إرسال طلب الصيانة" : "Maintenance request submitted"); },
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const maxImages = 5;
    const maxVideoSize = 50 * 1024 * 1024;
    const maxImageSize = 10 * 1024 * 1024;
    const currentImages = mediaFiles.filter(f => f.type === "image").length;
    const currentVideos = mediaFiles.filter(f => f.type === "video").length;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) { toast.error(isAr ? "نوع ملف غير مدعوم" : "Unsupported file type"); continue; }
        if (isImage && currentImages + 1 > maxImages) { toast.error(isAr ? `الحد الأقصى ${maxImages} صور` : `Maximum ${maxImages} images`); continue; }
        if (isVideo && currentVideos >= 1) { toast.error(isAr ? "فيديو واحد فقط مسموح" : "Only 1 video allowed"); continue; }
        if (isImage && file.size > maxImageSize) { toast.error(isAr ? "حجم الصورة يجب أن لا يتجاوز 10MB" : "Image must be under 10MB"); continue; }
        if (isVideo && file.size > maxVideoSize) { toast.error(isAr ? "حجم الفيديو يجب أن لا يتجاوز 50MB" : "Video must be under 50MB"); continue; }

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        const result = await uploadMedia.mutateAsync({ base64, filename: file.name, contentType: file.type });
        setMediaFiles(prev => [...prev, { url: result.url, type: isVideo ? "video" : "image", name: file.name }]);
      }
      toast.success(isAr ? "تم رفع الملفات بنجاح" : "Files uploaded successfully");
    } catch {
      toast.error(isAr ? "فشل رفع الملف" : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const urgencyLabels: Record<string, { en: string; ar: string; color: string }> = {
    low: { en: "Low", ar: "منخفض", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    medium: { en: "Medium", ar: "متوسط", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    high: { en: "High", ar: "عالي", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
    critical: { en: "Critical", ar: "حرج", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };
  const statusLabels: Record<string, { en: string; ar: string; color: string }> = {
    open: { en: "Open", ar: "مفتوح", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    assigned: { en: "Assigned", ar: "تم التعيين", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    in_progress: { en: "In Progress", ar: "قيد التنفيذ", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
    resolved: { en: "Resolved", ar: "تم الحل", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    closed: { en: "Closed", ar: "مغلق", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400" },
  };
  const categoryLabels: Record<string, { en: string; ar: string }> = {
    plumbing: { en: "Plumbing", ar: "سباكة" }, electrical: { en: "Electrical", ar: "كهرباء" },
    ac_heating: { en: "AC/Heating", ar: "تكييف/تدفئة" }, appliance: { en: "Appliance", ar: "أجهزة" },
    structural: { en: "Structural", ar: "هيكلي" }, pest: { en: "Pest Control", ar: "مكافحة حشرات" },
    security: { en: "Security", ar: "أمن" }, other: { en: "Other", ar: "أخرى" },
  };

  const activeBookings = bookings.data?.filter((b: any) => b.status === "approved" || b.status === "active") || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3 emergency-row">
            <CardTitle className="font-heading flex items-center gap-2 section-header-row">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {isAr ? "طوارئ الصيانة" : "Emergency Maintenance"}
            </CardTitle>
            <Button onClick={() => setShowForm(!showForm)} className="bg-red-500 hover:bg-red-600 text-white">
              <AlertCircle className="h-4 w-4 me-2" />{isAr ? "طلب صيانة طارئة" : "Emergency Request"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-6 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-950/10 space-y-4">
              <h4 className="font-semibold text-red-700 dark:text-red-400">{isAr ? "طلب صيانة طارئة جديد" : "New Emergency Request"}</h4>
              {activeBookings.length > 0 && (
                <div>
                  <Label>{isAr ? "العقار" : "Property"}</Label>
                  <Select value={String(form.propertyId || "")} onValueChange={v => setForm(p => ({ ...p, propertyId: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder={isAr ? "اختر العقار" : "Select property"} /></SelectTrigger>
                    <SelectContent>
                      {activeBookings.map((b: any) => <SelectItem key={b.id} value={String(b.propertyId)}>{isAr ? `عقار #${b.propertyId}` : `Property #${b.propertyId}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{isAr ? "الأولوية" : "Urgency"}</Label>
                  <Select value={form.urgency} onValueChange={v => setForm(p => ({ ...p, urgency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(urgencyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{isAr ? v.ar : v.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isAr ? "التصنيف" : "Category"}</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{isAr ? v.ar : v.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>{isAr ? "العنوان (EN)" : "Title (EN)"}</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} dir="ltr" /></div>
                <div><Label>{isAr ? "العنوان (عربي)" : "Title (AR)"}</Label><Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} dir="rtl" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>{isAr ? "الوصف (EN)" : "Description (EN)"}</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} dir="ltr" /></div>
                <div><Label>{isAr ? "الوصف (عربي)" : "Description (AR)"}</Label><Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={3} dir="rtl" /></div>
              </div>
              {/* Media Upload Section */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Camera className="h-4 w-4" />
                  {isAr ? "صور وفيديوهات (اختياري)" : "Photos & Videos (optional)"}
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {isAr ? "يمكنك رفع حتى 5 صور وفيديو واحد لتوضيح المشكلة" : "Upload up to 5 images and 1 video to illustrate the issue"}
                </p>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
                <div
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-red-400 hover:bg-red-50/30 dark:hover:bg-red-950/10 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-red-400", "bg-red-50/30"); }}
                  onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove("border-red-400", "bg-red-50/30"); }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("border-red-400", "bg-red-50/30"); handleFileUpload(e.dataTransfer.files); }}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                      <span className="text-sm text-muted-foreground">{isAr ? "جاري الرفع..." : "Uploading..."}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground">{isAr ? "اسحب الملفات هنا أو اضغط للاختيار" : "Drag files here or click to browse"}</span>
                      <span className="text-xs text-muted-foreground/70">{isAr ? "JPG, PNG, WebP, MP4 — صور حتى 10MB، فيديو حتى 50MB" : "JPG, PNG, WebP, MP4 — Images up to 10MB, Video up to 50MB"}</span>
                    </div>
                  )}
                </div>
                {/* Preview Grid */}
                {mediaFiles.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
                    {mediaFiles.map((f, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
                        {f.type === "image" ? (
                          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-black/80">
                            <Play className="h-8 w-8 text-white mb-1" />
                            <span className="text-xs text-white/70 truncate px-2">{f.name}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(i)}
                          className="absolute top-1 end-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5">
                          <span className="text-[10px] text-white flex items-center gap-1">
                            {f.type === "image" ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                            {f.type === "image" ? (isAr ? "صورة" : "Image") : (isAr ? "فيديو" : "Video")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => { if (!form.title || !form.description) { toast.error(isAr ? "يرجى تعبئة العنوان والوصف" : "Please fill title and description"); return; } createRequest.mutate({ ...form, imageUrls: mediaFiles.map(f => f.url) } as any); }} disabled={createRequest.isPending || uploading} className="bg-red-500 hover:bg-red-600 text-white">
                  {createRequest.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {isAr ? "إرسال" : "Submit"}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setMediaFiles([]); }}>{isAr ? "إلغاء" : "Cancel"}</Button>
              </div>
            </div>
          )}

          {/* My Emergency Requests */}
          {myRequests.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#3ECFC0]" /></div>
          ) : myRequests.data && myRequests.data.length > 0 ? (
            <div className="space-y-3">
              {myRequests.data.map((r) => {
                const urg = urgencyLabels[r.urgency] || urgencyLabels.medium;
                const st = statusLabels[r.status] || statusLabels.open;
                const cat = categoryLabels[r.category] || categoryLabels.other;
                return (
                  <div key={r.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between flex-wrap gap-2 emergency-row">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold">#{r.id}</span>
                          <span className="font-semibold">{isAr ? (r.titleAr || r.title) : (r.title || r.titleAr)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${urg.color}`}>{isAr ? urg.ar : urg.en}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{isAr ? st.ar : st.en}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{isAr ? cat.ar : cat.en} • {new Date(r.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US")}</p>
                        <p className="text-sm mt-1">{isAr ? (r.descriptionAr || r.description) : (r.description || r.descriptionAr)}</p>
                        {/* Media Attachments */}
                        {r.imageUrls && Array.isArray(r.imageUrls) && r.imageUrls.length > 0 && (
                          <div className="mt-2">
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                              {r.imageUrls.map((url: string, idx: number) => {
                                const isVid = /\.(mp4|webm|mov|avi)$/i.test(url);
                                return isVid ? (
                                  <button key={idx} onClick={() => { setLightboxItems((r.imageUrls as string[]).map((u: string) => ({ url: normalizeMediaUrl(u), type: /\.(mp4|webm|mov|avi)$/i.test(u) ? "video" as const : "image" as const }))); setLightboxIndex(idx); setLightboxOpen(true); }} className="relative block rounded-lg overflow-hidden border bg-muted aspect-square hover:ring-2 hover:ring-[#3ECFC0] transition-all cursor-pointer">
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/80">
                                      <Play className="h-6 w-6 text-white" />
                                    </div>
                                  </button>
                                ) : (
                                  <SafeMediaThumb
                                    key={idx}
                                    src={url}
                                    alt={`${isAr ? 'مرفق' : 'Attachment'} ${idx + 1}`}
                                    onClick={() => { setLightboxItems((r.imageUrls as string[]).map((u: string) => ({ url: normalizeMediaUrl(u), type: /\.(mp4|webm|mov|avi)$/i.test(u) ? "video" as const : "image" as const }))); setLightboxIndex(idx); setLightboxOpen(true); }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {r.assignedTo && <p className="text-sm text-[#3ECFC0] mt-1">{isAr ? `الفني: ${r.assignedTo}` : `Technician: ${r.assignedTo}`} {r.assignedPhone && `(${r.assignedPhone})`}</p>}
                        {r.resolution && <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm"><strong>{isAr ? "الحل:" : "Resolution:"}</strong> {isAr ? (r.resolutionAr || r.resolution) : (r.resolution || r.resolutionAr)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              {isAr ? "لا توجد طلبات صيانة طوارئ" : "No emergency maintenance requests"}
            </p>
          )}
        </CardContent>
      </Card>
      <MediaLightbox items={lightboxItems} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  );
}


// ─── Tenant Enquiries Tab ─────────────────────────────────────────────
function TenantEnquiriesTab({ lang, isAr }: { lang: string; isAr: boolean }) {
  const enquiries = trpc.enquiry.list.useQuery();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#3ECFC0]" />
            {isAr ? "الاستفسارات" : "Enquiries"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enquiries.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !enquiries.data || enquiries.data.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">{isAr ? "لا توجد استفسارات بعد" : "No enquiries yet"}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {isAr ? "عند استفسارك عن أي عقار ستظهر هنا" : "When you enquire about a property, it will appear here"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {enquiries.data.map((e: any) => (
                <div key={e.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">
                      {e.property ? (isAr ? (e.property.titleAr || e.property.title) : e.property.title) : (isAr ? "عقار محذوف" : "Deleted property")}
                    </h4>
                    {e.message && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.message}</p>}
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {new Date(e.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  {e.property && (
                    <a href={`/property/${e.propertyId}`} className="text-xs text-[#3ECFC0] hover:underline whitespace-nowrap">
                      {isAr ? "عرض العقار" : "View Property"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tenant Hidden Properties Tab ─────────────────────────────────────
function TenantHiddenTab({ lang, isAr }: { lang: string; isAr: boolean }) {
  const hidden = trpc.hidden.list.useQuery();
  const toggleHidden = trpc.hidden.toggle.useMutation({
    onSuccess: () => {
      hidden.refetch();
      toast.success(isAr ? "تم إظهار العقار" : "Property unhidden");
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-[#3ECFC0]" />
            {isAr ? "العقارات المخفية" : "Hidden Properties"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hidden.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !hidden.data || hidden.data.length === 0 ? (
            <div className="text-center py-12">
              <EyeOff className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">{isAr ? "لا توجد عقارات مخفية" : "No hidden properties"}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {isAr ? "العقارات التي تخفيها لن تظهر في نتائج البحث" : "Properties you hide won't appear in search results"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hidden.data.map((p: any) => (
                <div key={p.id} className="relative group">
                  <PropertyCard property={p} lang={lang} />
                  <div className="absolute top-2 end-2 z-10">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      onClick={() => toggleHidden.mutate({ propertyId: p.id })}
                      disabled={toggleHidden.isPending}
                    >
                      <Eye className="h-3.5 w-3.5 me-1" />
                      {isAr ? "إظهار" : "Unhide"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
