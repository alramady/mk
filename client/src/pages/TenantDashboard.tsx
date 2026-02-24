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
  Phone, Mail, MapPin, FileText, Camera, Save, Eye, Upload, X, ImageIcon, Video, Play
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { MediaLightbox } from "@/components/MediaLightbox";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";

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

export default function TenantDashboard() {
  const { t, lang } = useI18n();
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
    if (file.size > 5 * 1024 * 1024) { toast.error(lang === "ar" ? "حجم الصورة يجب أن يكون أقل من 5 ميجا" : "Image must be under 5MB"); return; }
    setUploadingAvatar(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const result = await uploadFile.mutateAsync({ base64, filename: file.name, contentType: file.type });
      await updateProfile.mutateAsync({ avatarUrl: result.url });
      toast.success(lang === "ar" ? "تم رفع الصورة بنجاح" : "Photo uploaded successfully");
    } catch { toast.error(lang === "ar" ? "فشل رفع الصورة" : "Failed to upload photo"); }
    setUploadingAvatar(false);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(lang === "ar" ? "حجم الملف يجب أن يكون أقل من 10 ميجا" : "File must be under 10MB"); return; }
    setUploadingDoc(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const result = await uploadFile.mutateAsync({ base64, filename: file.name, contentType: file.type });
      await updateProfile.mutateAsync({ idDocumentUrl: result.url });
      toast.success(lang === "ar" ? "تم رفع المستند بنجاح" : "Document uploaded successfully");
    } catch { toast.error(lang === "ar" ? "فشل رفع المستند" : "Failed to upload document"); }
    setUploadingDoc(false);
  };

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم حفظ الملف الشخصي" : "Profile saved successfully"); },
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
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Tenant Dashboard" titleAr="لوحة المستأجر" path="/tenant" noindex={true} />
      <Navbar />
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">{t("dashboard.tenant")}</h1>
          <p className="text-muted-foreground mt-1">
            {lang === "ar" ? `مرحباً، ${user?.name || ""}` : `Welcome, ${user?.name || ""}`}
          </p>
        </div>

        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="bookings" className="gap-1.5"><Calendar className="h-4 w-4" />{t("dashboard.myBookings")}</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5"><CreditCard className="h-4 w-4" />{t("dashboard.myPayments")}</TabsTrigger>
            <TabsTrigger value="favorites" className="gap-1.5"><Heart className="h-4 w-4" />{t("dashboard.favorites")}</TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-1.5"><Wrench className="h-4 w-4" />{t("dashboard.maintenance")}</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-4 w-4" />{t("nav.notifications")}</TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" />{lang === "ar" ? "الملف الشخصي" : "Profile"}</TabsTrigger>
            <TabsTrigger value="inspections" className="gap-1.5"><Eye className="h-4 w-4" />{lang === "ar" ? "طلبات المعاينة" : "Inspections"}</TabsTrigger>
            <TabsTrigger value="services" className="gap-1.5"><Building2 className="h-4 w-4" />{lang === "ar" ? "الخدمات" : "Services"}</TabsTrigger>
            <TabsTrigger value="emergency" className="gap-1.5"><AlertCircle className="h-4 w-4" />{lang === "ar" ? "طوارئ الصيانة" : "Emergency"}</TabsTrigger>
          </TabsList>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            {bookings.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : bookings.data && bookings.data.length > 0 ? (
              <div className="space-y-3">
                {bookings.data.map((b) => (
                  <Card key={b.id} className="card-hover transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setLocation(`/property/${b.propertyId}`)}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{lang === "ar" ? `حجز #${b.id}` : `Booking #${b.id}`}</span>
                            {statusBadge(b.status, lang)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(b.moveInDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")} — {new Date(b.moveOutDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {b.durationMonths} {t("booking.months")} • {Number(b.monthlyRent).toLocaleString()} {t("payment.sar")}{t("property.perMonth")}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="font-bold text-primary">{Number(b.totalAmount).toLocaleString()} {t("payment.sar")}</div>
                          <div className="text-xs text-muted-foreground">{t("common.total")}</div>
                        </div>
                      </div>
                      {/* Booking Timeline */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Clock className="h-3 w-3" />
                          <span>{lang === "ar" ? "الجدول الزمني" : "Timeline"}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "pending" || b.status === "approved" || b.status === "active" || b.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {lang === "ar" ? "تم الطلب" : "Requested"}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "approved" || b.status === "active" || b.status === "completed" ? "bg-green-100 text-green-700" : b.status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                            {b.status === "rejected" ? (lang === "ar" ? "مرفوض" : "Rejected") : (lang === "ar" ? "موافق عليه" : "Approved")}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "active" || b.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {lang === "ar" ? "تم الدفع" : "Paid"}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "active" ? "bg-blue-100 text-blue-700" : b.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {b.status === "completed" ? (lang === "ar" ? "مكتمل" : "Completed") : (lang === "ar" ? "نشط" : "Active")}
                          </span>
                        </div>
                      </div>
                      {b.status === "approved" && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <div className="p-2.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium mb-1">
                              <CheckCircle className="h-3.5 w-3.5" />
                              {lang === "ar" ? "تم قبول طلبك! يرجى إكمال الدفع" : "Your request was approved! Please complete payment"}
                            </div>
                            {(b as any).landlordNotes && (
                              <p className="text-blue-600 dark:text-blue-300 text-xs">{(b as any).landlordNotes}</p>
                            )}
                          </div>
                          <Button
                            className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] font-semibold border-0 h-11"
                            onClick={(e) => { e.stopPropagation(); setLocation(`/pay/${b.id}`); }}
                          >
                            <CreditCard className="h-4 w-4 me-2" />
                            {lang === "ar" ? "ادفع الآن" : "Pay Now"}
                            <span className="ms-2 text-xs opacity-80">({Number(b.totalAmount).toLocaleString()} {t("payment.sar")})</span>
                          </Button>
                        </div>
                      )}
                      {b.status === "rejected" && (b as any).rejectionReason && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
                            <span className="font-medium text-red-700 dark:text-red-400">
                              {lang === "ar" ? "سبب الرفض: " : "Rejection reason: "}
                            </span>
                            <span className="text-red-600 dark:text-red-300">{(b as any).rejectionReason}</span>
                          </div>
                        </div>
                      )}
                      {b.status === "active" && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="p-2.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm">
                            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                              <CheckCircle className="h-3.5 w-3.5" />
                              {lang === "ar" ? "الحجز نشط - تم تأكيد الدفع" : "Booking active - Payment confirmed"}
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
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد حجوزات بعد" : "No bookings yet"}</p>
                <Button className="mt-4" onClick={() => setLocation("/search")}>{t("nav.search")}</Button>
              </Card>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            {payments.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : payments.data && payments.data.length > 0 ? (
              <div className="space-y-3">
                {payments.data.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{t(`payment.${p.type}` as any)}</span>
                          {statusBadge(p.status, lang)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                        </div>
                      </div>
                      <div className="font-bold text-primary">{Number(p.amount).toLocaleString()} {t("payment.sar")}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد مدفوعات" : "No payments yet"}</p>
              </Card>
            )}
          </TabsContent>

          {/* Favorites Tab */}
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
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد عقارات مفضلة" : "No favorites yet"}</p>
                <Button className="mt-4" onClick={() => setLocation("/search")}>{t("nav.search")}</Button>
              </Card>
            )}
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            {maintenance.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : maintenance.data && maintenance.data.length > 0 ? (
              <div className="space-y-3">
                {maintenance.data.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
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
                          <span className="font-medium">{lang === "ar" ? "رد المالك:" : "Landlord Response:"}</span> {m.landlordResponse}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد طلبات صيانة" : "No maintenance requests"}</p>
              </Card>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            {notifications.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : notifications.data && notifications.data.length > 0 ? (
              <div className="space-y-2">
                {notifications.data.map((n) => (
                  <Card key={n.id} className={`${!n.isRead ? "border-primary/30 bg-primary/5" : ""}`}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{lang === "ar" ? n.titleAr : n.titleEn}</div>
                        {(n.contentEn || n.contentAr) && (
                          <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? n.contentAr : n.contentEn}</p>
                        )}
                        <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
              </Card>
            )}
          </TabsContent>
          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <User className="h-5 w-5 text-[#3ECFC0]" />
                  {lang === "ar" ? "الملف الشخصي" : "Personal Profile"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Upload Section */}
                <div className="bg-muted/30 rounded-xl p-6 border border-dashed border-[#3ECFC0]/30">
                  <h4 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                    <Camera className="h-4 w-4 text-[#3ECFC0]" />
                    {lang === "ar" ? "الصورة الشخصية" : "Profile Photo"}
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
                        <p className="text-sm font-medium">{lang === "ar" ? "اضغط على الصورة لتحديثها" : "Click the photo to update it"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{lang === "ar" ? "JPG أو PNG أو WebP — الحد الأقصى 5 ميجابايت" : "JPG, PNG or WebP — max 5MB"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                          {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                          {lang === "ar" ? "رفع صورة جديدة" : "Upload New Photo"}
                        </Button>
                        {user?.avatarUrl && (
                          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={async () => {
                            try {
                              await updateProfile.mutateAsync({ avatarUrl: "" });
                              toast.success(lang === "ar" ? "تم إزالة الصورة" : "Photo removed");
                            } catch { toast.error(lang === "ar" ? "فشل إزالة الصورة" : "Failed to remove photo"); }
                          }}>
                            <XCircle className="h-3.5 w-3.5" />
                            {lang === "ar" ? "إزالة" : "Remove"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Info & Profile Completion */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="flex-1">
                    <h3 className="text-xl font-heading font-bold">{user?.name}</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{user?.role === "admin" ? (lang === "ar" ? "مدير" : "Admin") : (lang === "ar" ? "مستأجر" : "Tenant")}</Badge>
                    </div>
                    {/* Profile Completion */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{lang === "ar" ? "اكتمال الملف" : "Profile Completion"}</span>
                        <span className="font-semibold text-[#3ECFC0]">{(user as any)?.profileCompletionPct || 0}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#3ECFC0] rounded-full transition-all" style={{ width: `${(user as any)?.profileCompletionPct || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#3ECFC0]" />
                    {lang === "ar" ? "معلومات التواصل" : "Contact Information"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "رقم الهاتف" : "Phone Number"}</Label>
                      <Input dir="ltr" placeholder="05xxxxxxxx" value={profileForm.phone} onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "المدينة" : "City"}</Label>
                      <Input value={profileForm.city} onChange={(e) => setProfileForm(p => ({ ...p, city: e.target.value }))} placeholder={lang === "ar" ? "الرياض" : "Riyadh"} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{lang === "ar" ? "العنوان" : "Address"}</Label>
                      <Input value={profileForm.address} onChange={(e) => setProfileForm(p => ({ ...p, address: e.target.value }))} placeholder={lang === "ar" ? "العنوان الكامل" : "Full address"} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Identity Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#3ECFC0]" />
                    {lang === "ar" ? "معلومات الهوية" : "Identity Information"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "رقم الهوية / الإقامة" : "National ID / Iqama"}</Label>
                      <Input dir="ltr" value={profileForm.nationalId} onChange={(e) => setProfileForm(p => ({ ...p, nationalId: e.target.value }))} placeholder="1xxxxxxxxx" />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "تاريخ الميلاد" : "Date of Birth"}</Label>
                      <Input type="date" dir="ltr" value={profileForm.dateOfBirth} onChange={(e) => setProfileForm(p => ({ ...p, dateOfBirth: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "الجنسية" : "Nationality"}</Label>
                      <Input value={profileForm.nationality} onChange={(e) => setProfileForm(p => ({ ...p, nationality: e.target.value }))} placeholder={lang === "ar" ? "سعودي" : "Saudi"} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Emergency Contact */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#C9A96E]" />
                    {lang === "ar" ? "جهة اتصال الطوارئ" : "Emergency Contact"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "اسم جهة الاتصال" : "Contact Name"}</Label>
                      <Input value={profileForm.emergencyContact} onChange={(e) => setProfileForm(p => ({ ...p, emergencyContact: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "رقم الطوارئ" : "Emergency Phone"}</Label>
                      <Input dir="ltr" value={profileForm.emergencyPhone} onChange={(e) => setProfileForm(p => ({ ...p, emergencyPhone: e.target.value }))} placeholder="05xxxxxxxx" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Bio */}
                <div className="space-y-2">
                  <Label>{lang === "ar" ? "نبذة شخصية" : "About Me"}</Label>
                  <Textarea value={profileForm.bio} onChange={(e) => setProfileForm(p => ({ ...p, bio: e.target.value }))} placeholder={lang === "ar" ? "أخبرنا عن نفسك..." : "Tell us about yourself..."} rows={3} />
                </div>

                {/* ID Document Upload */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#C9A96E]" />
                    {lang === "ar" ? "مستند الهوية" : "ID Document"}
                  </h4>
                  {(user as any)?.idDocumentUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm">{lang === "ar" ? "تم رفع مستند الهوية" : "ID document uploaded"}</span>
                      <Button variant="outline" size="sm" className="ms-auto" onClick={() => docInputRef.current?.click()}>
                        {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === "ar" ? "تحديث" : "Update")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" onClick={() => docInputRef.current?.click()}>
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <span className="text-sm">{lang === "ar" ? "يرجى رفع صورة الهوية / الإقامة" : "Please upload your ID / Iqama copy"}</span>
                      {uploadingDoc && <Loader2 className="h-4 w-4 animate-spin ms-auto" />}
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
                  {updateProfile.isPending ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ الملف الشخصي" : "Save Profile")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inspections Tab */}
          <TabsContent value="inspections">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Eye className="h-5 w-5 text-[#3ECFC0]" />
                  {lang === "ar" ? "طلبات المعاينة" : "Inspection Requests"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  <Eye className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  {lang === "ar" ? "طلبات المعاينة ستظهر هنا" : "Your inspection requests will appear here"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <TenantServicesTab lang={lang} />
          </TabsContent>

          {/* Emergency Maintenance Tab */}
          <TabsContent value="emergency">
            <TenantEmergencyTab lang={lang} />
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

// ─── Tenant Services Tab ─────────────────────────────────────────────
function TenantServicesTab({ lang }: { lang: string }) {
  const services = trpc.services.listActive.useQuery();
  const myRequests = trpc.serviceRequests.myRequests.useQuery();
  const requestService = trpc.serviceRequests.create.useMutation({
    onSuccess: () => { myRequests.refetch(); toast.success(lang === "ar" ? "تم طلب الخدمة بنجاح" : "Service requested successfully"); },
  });
  const [selectedService, setSelectedService] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800", approved: "bg-blue-100 text-blue-800",
    in_progress: "bg-purple-100 text-purple-800", completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
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
          <CardTitle className="font-heading flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#3ECFC0]" />
            {lang === "ar" ? "الخدمات المتاحة" : "Available Services"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {services.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#3ECFC0]" /></div>
          ) : services.data && services.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.data.map((s) => (
                <div key={s.id} className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedService?.id === s.id ? "border-[#3ECFC0] bg-[#3ECFC0]/5" : "hover:border-[#3ECFC0]/50"}`} onClick={() => setSelectedService(s)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{lang === "ar" ? s.nameAr : s.nameEn}</h4>
                      <p className="text-sm text-muted-foreground">{lang === "ar" ? s.descriptionAr : s.descriptionEn}</p>
                    </div>
                    <span className="font-bold text-[#C9A96E] whitespace-nowrap">{Number(s.price).toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">{lang === "ar" ? "لا توجد خدمات متاحة حالياً" : "No services available currently"}</p>
          )}
          {selectedService && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-semibold">{lang === "ar" ? `طلب: ${selectedService.nameAr}` : `Request: ${selectedService.nameEn}`}</h4>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={lang === "ar" ? "ملاحظات إضافية..." : "Additional notes..."} rows={2} />
              <Button onClick={() => { requestService.mutate({ serviceId: selectedService.id, totalPrice: String(selectedService.price), notes }); setSelectedService(null); setNotes(""); }} disabled={requestService.isPending} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
                {requestService.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {lang === "ar" ? "طلب الخدمة" : "Request Service"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Requests */}
      {myRequests.data && myRequests.data.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-heading">{lang === "ar" ? "طلباتي" : "My Requests"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {myRequests.data.map((r) => {
              const st = statusLabels[r.status] || statusLabels.pending;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <span className="font-medium">#{r.id} — {lang === "ar" ? `خدمة #${r.serviceId}` : `Service #${r.serviceId}`}</span>
                    <div className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#C9A96E]">{Number(r.totalPrice).toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[r.status] || ""}`}>{lang === "ar" ? st.ar : st.en}</span>
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
function TenantEmergencyTab({ lang }: { lang: string }) {
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
    onSuccess: () => { myRequests.refetch(); setShowForm(false); setForm({ propertyId: 0, urgency: "medium", category: "other", title: "", titleAr: "", description: "", descriptionAr: "" }); setMediaFiles([]); toast.success(lang === "ar" ? "تم إرسال طلب الصيانة" : "Maintenance request submitted"); },
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const maxImages = 5;
    const maxVideoSize = 50 * 1024 * 1024; // 50MB
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    const currentImages = mediaFiles.filter(f => f.type === "image").length;
    const currentVideos = mediaFiles.filter(f => f.type === "video").length;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) { toast.error(lang === "ar" ? "نوع ملف غير مدعوم" : "Unsupported file type"); continue; }
        if (isImage && currentImages + 1 > maxImages) { toast.error(lang === "ar" ? `الحد الأقصى ${maxImages} صور` : `Maximum ${maxImages} images`); continue; }
        if (isVideo && currentVideos >= 1) { toast.error(lang === "ar" ? "فيديو واحد فقط مسموح" : "Only 1 video allowed"); continue; }
        if (isImage && file.size > maxImageSize) { toast.error(lang === "ar" ? "حجم الصورة يجب أن لا يتجاوز 10MB" : "Image must be under 10MB"); continue; }
        if (isVideo && file.size > maxVideoSize) { toast.error(lang === "ar" ? "حجم الفيديو يجب أن لا يتجاوز 50MB" : "Video must be under 50MB"); continue; }

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        const result = await uploadMedia.mutateAsync({ base64, filename: file.name, contentType: file.type });
        setMediaFiles(prev => [...prev, { url: result.url, type: isVideo ? "video" : "image", name: file.name }]);
      }
      toast.success(lang === "ar" ? "تم رفع الملفات بنجاح" : "Files uploaded successfully");
    } catch {
      toast.error(lang === "ar" ? "فشل رفع الملف" : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const urgencyLabels: Record<string, { en: string; ar: string; color: string }> = {
    low: { en: "Low", ar: "منخفض", color: "bg-blue-100 text-blue-800" },
    medium: { en: "Medium", ar: "متوسط", color: "bg-yellow-100 text-yellow-800" },
    high: { en: "High", ar: "عالي", color: "bg-orange-100 text-orange-800" },
    critical: { en: "Critical", ar: "حرج", color: "bg-red-100 text-red-800" },
  };
  const statusLabels: Record<string, { en: string; ar: string; color: string }> = {
    open: { en: "Open", ar: "مفتوح", color: "bg-red-100 text-red-800" },
    assigned: { en: "Assigned", ar: "تم التعيين", color: "bg-blue-100 text-blue-800" },
    in_progress: { en: "In Progress", ar: "قيد التنفيذ", color: "bg-purple-100 text-purple-800" },
    resolved: { en: "Resolved", ar: "تم الحل", color: "bg-green-100 text-green-800" },
    closed: { en: "Closed", ar: "مغلق", color: "bg-gray-100 text-gray-800" },
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
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {lang === "ar" ? "طوارئ الصيانة" : "Emergency Maintenance"}
            </CardTitle>
            <Button onClick={() => setShowForm(!showForm)} className="bg-red-500 hover:bg-red-600 text-white">
              <AlertCircle className="h-4 w-4 me-2" />{lang === "ar" ? "طلب صيانة طارئة" : "Emergency Request"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-6 p-4 border border-red-200 rounded-lg bg-red-50/50 dark:bg-red-950/10 space-y-4">
              <h4 className="font-semibold text-red-700 dark:text-red-400">{lang === "ar" ? "طلب صيانة طارئة جديد" : "New Emergency Request"}</h4>
              {activeBookings.length > 0 && (
                <div>
                  <Label>{lang === "ar" ? "العقار" : "Property"}</Label>
                  <Select value={String(form.propertyId || "")} onValueChange={v => setForm(p => ({ ...p, propertyId: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر العقار" : "Select property"} /></SelectTrigger>
                    <SelectContent>
                      {activeBookings.map((b: any) => <SelectItem key={b.id} value={String(b.propertyId)}>{lang === "ar" ? `عقار #${b.propertyId}` : `Property #${b.propertyId}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{lang === "ar" ? "الأولوية" : "Urgency"}</Label>
                  <Select value={form.urgency} onValueChange={v => setForm(p => ({ ...p, urgency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(urgencyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{lang === "ar" ? v.ar : v.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{lang === "ar" ? "التصنيف" : "Category"}</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{lang === "ar" ? v.ar : v.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{lang === "ar" ? "العنوان (EN)" : "Title (EN)"}</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>{lang === "ar" ? "العنوان (عربي)" : "Title (AR)"}</Label><Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{lang === "ar" ? "الوصف (EN)" : "Description (EN)"}</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
                <div><Label>{lang === "ar" ? "الوصف (عربي)" : "Description (AR)"}</Label><Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={3} /></div>
              </div>
              {/* Media Upload Section */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Camera className="h-4 w-4" />
                  {lang === "ar" ? "صور وفيديوهات (اختياري)" : "Photos & Videos (optional)"}
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {lang === "ar" ? "يمكنك رفع حتى 5 صور وفيديو واحد لتوضيح المشكلة" : "Upload up to 5 images and 1 video to illustrate the issue"}
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
                      <span className="text-sm text-muted-foreground">{lang === "ar" ? "جاري الرفع..." : "Uploading..."}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground">{lang === "ar" ? "اسحب الملفات هنا أو اضغط للاختيار" : "Drag files here or click to browse"}</span>
                      <span className="text-xs text-muted-foreground/70">{lang === "ar" ? "JPG, PNG, WebP, MP4 — صور حتى 10MB، فيديو حتى 50MB" : "JPG, PNG, WebP, MP4 — Images up to 10MB, Video up to 50MB"}</span>
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
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                          <span className="text-[10px] text-white flex items-center gap-1">
                            {f.type === "image" ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                            {f.type === "image" ? (lang === "ar" ? "صورة" : "Image") : (lang === "ar" ? "فيديو" : "Video")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { if (!form.title || !form.description) { toast.error(lang === "ar" ? "يرجى تعبئة العنوان والوصف" : "Please fill title and description"); return; } createRequest.mutate({ ...form, imageUrls: mediaFiles.map(f => f.url) } as any); }} disabled={createRequest.isPending || uploading} className="bg-red-500 hover:bg-red-600 text-white">
                  {createRequest.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {lang === "ar" ? "إرسال" : "Submit"}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setMediaFiles([]); }}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
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
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold">#{r.id}</span>
                          <span className="font-semibold">{r.titleAr || r.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${urg.color}`}>{lang === "ar" ? urg.ar : urg.en}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{lang === "ar" ? st.ar : st.en}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{lang === "ar" ? cat.ar : cat.en} • {new Date(r.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                        <p className="text-sm mt-1">{r.descriptionAr || r.description}</p>
                        {/* Media Attachments */}
                        {r.imageUrls && Array.isArray(r.imageUrls) && r.imageUrls.length > 0 && (
                          <div className="mt-2">
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                              {r.imageUrls.map((url: string, idx: number) => {
                                const isVid = /\.(mp4|webm|mov|avi)$/i.test(url);
                                return (
                                  <button key={idx} onClick={() => { setLightboxItems((r.imageUrls as string[]).map((u: string) => ({ url: u, type: /\.(mp4|webm|mov|avi)$/i.test(u) ? "video" as const : "image" as const }))); setLightboxIndex(idx); setLightboxOpen(true); }} className="relative block rounded-lg overflow-hidden border bg-muted aspect-square hover:ring-2 hover:ring-[#3ECFC0] transition-all cursor-pointer">
                                    {isVid ? (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-black/80">
                                        <Play className="h-6 w-6 text-white" />
                                      </div>
                                    ) : (
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {r.assignedTo && <p className="text-sm text-[#3ECFC0] mt-1">{lang === "ar" ? `الفني: ${r.assignedTo}` : `Technician: ${r.assignedTo}`} {r.assignedPhone && `(${r.assignedPhone})`}</p>}
                        {r.resolution && <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm"><strong>{lang === "ar" ? "الحل:" : "Resolution:"}</strong> {r.resolutionAr || r.resolution}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              {lang === "ar" ? "لا توجد طلبات صيانة طوارئ" : "No emergency maintenance requests"}
            </p>
          )}
        </CardContent>
      </Card>
      <MediaLightbox items={lightboxItems} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  );
}
