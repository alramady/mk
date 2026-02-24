import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Building2, Calendar, CreditCard, Wrench, BarChart3, Plus,
  Loader2, Eye, CheckCircle, XCircle, Clock, MessageSquare, MapPin,
  User, Camera
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function LandlordDashboard() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const properties = trpc.property.getByLandlord.useQuery(undefined, { enabled: isAuthenticated });
  const bookings = trpc.booking.landlordBookings.useQuery(undefined, { enabled: isAuthenticated });
  const payments = trpc.payment.landlordPayments.useQuery(undefined, { enabled: isAuthenticated });
  const maintenance = trpc.maintenance.landlordRequests.useQuery(undefined, { enabled: isAuthenticated });

  const [bookingDialog, setBookingDialog] = useState<{ id: number; action: "approve" | "reject" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [maintenanceDialog, setMaintenanceDialog] = useState<{ id: number; status: string } | null>(null);
  const [maintenanceResponse, setMaintenanceResponse] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = trpc.upload.file.useMutation();
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم حفظ الملف الشخصي" : "Profile saved"); },
  });

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

  const updateBooking = trpc.booking.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تحديث الحجز" : "Booking updated");
      utils.booking.landlordBookings.invalidate();
      setBookingDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMaintenance = trpc.maintenance.update.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تحديث طلب الصيانة" : "Maintenance request updated");
      utils.maintenance.landlordRequests.invalidate();
      setMaintenanceDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const statusBadge = (status: string) => {
    const labels: Record<string, string> = lang === "ar" 
      ? { pending: "بانتظار المراجعة", approved: "بانتظار الدفع", active: "نشط", rejected: "مرفوض", completed: "مكتمل", cancelled: "ملغي" }
      : { pending: "Pending Review", approved: "Awaiting Payment", active: "Active", rejected: "Rejected", completed: "Completed", cancelled: "Cancelled" };
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800", approved: "bg-[#3ECFC0]/10 text-[#0B1E2D]",
      active: "bg-blue-100 text-blue-800", rejected: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800", completed: "bg-gray-100 text-gray-800",
      submitted: "bg-yellow-100 text-yellow-800", acknowledged: "bg-blue-100 text-blue-800",
      in_progress: "bg-blue-100 text-blue-800",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>{labels[status] || status}</span>;
  };

  const totalRevenue = payments.data?.reduce((sum, p) => p.status === "completed" ? sum + Number(p.amount) : sum, 0) || 0;
  const activeBookings = bookings.data?.filter(b => b.status === "active" || b.status === "approved").length || 0;
  const pendingBookings = bookings.data?.filter(b => b.status === "pending").length || 0;

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Landlord Dashboard" titleAr="لوحة المالك" path="/landlord" noindex={true} />
      <Navbar />
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">{t("dashboard.landlord")}</h1>
            <p className="text-muted-foreground mt-1">
              {lang === "ar" ? `مرحباً، ${user?.name || ""}` : `Welcome, ${user?.name || ""}`}
            </p>
          </div>
          <Button onClick={() => setLocation("/list-property")} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold">
            <Plus className="h-4 w-4 me-1.5" />
            {t("nav.listProperty")}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-4 text-center">
            <Building2 className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{properties.data?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.myProperties")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{activeBookings}</div>
            <div className="text-xs text-muted-foreground">{lang === "ar" ? "حجوزات نشطة" : "Active Bookings"}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 text-[#C9A96E] mx-auto mb-2" />
            <div className="text-2xl font-bold">{pendingBookings}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.pendingApproval")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <CreditCard className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{t("payment.sar")} {t("dashboard.revenue")}</div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="properties" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="properties" className="gap-1.5"><Building2 className="h-4 w-4" />{t("dashboard.myProperties")}</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1.5"><Calendar className="h-4 w-4" />{lang === "ar" ? "طلبات الحجز" : "Booking Requests"}</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5"><CreditCard className="h-4 w-4" />{t("dashboard.myPayments")}</TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-1.5"><Wrench className="h-4 w-4" />{t("dashboard.maintenance")}</TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" />{lang === "ar" ? "الملف الشخصي" : "Profile"}</TabsTrigger>
          </TabsList>

          {/* Properties */}
          <TabsContent value="properties">
            {properties.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : properties.data && properties.data.length > 0 ? (
              <div className="space-y-3">
                {properties.data.map((p) => (
                  <Card key={p.id} className="card-hover transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                        <img src={p.photos?.[0] || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200&h=200&fit=crop"} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{lang === "ar" ? p.titleAr : p.titleEn}</h3>
                          {statusBadge(p.status)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {lang === "ar" ? p.cityAr : p.city}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="font-semibold text-primary">{Number(p.monthlyRent).toLocaleString()} {t("payment.sar")}</span>
                          <span className="text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{p.viewCount}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/property/${p.id}`)}>{t("common.viewDetails")}</Button>
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/edit-property/${p.id}`)}>{t("common.edit")}</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لم تضف أي عقارات بعد" : "No properties listed yet"}</p>
                <Button className="mt-4 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold" onClick={() => setLocation("/list-property")}>{t("nav.listProperty")}</Button>
              </Card>
            )}
          </TabsContent>

          {/* Bookings */}
          <TabsContent value="bookings">
            {bookings.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : bookings.data && bookings.data.length > 0 ? (
              <div className="space-y-3">
                {bookings.data.map((b) => (
                  <Card key={b.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{lang === "ar" ? `حجز #${b.id}` : `Booking #${b.id}`}</span>
                          {statusBadge(b.status)}
                        </div>
                        <span className="font-bold text-primary">{Number(b.totalAmount).toLocaleString()} {t("payment.sar")}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {new Date(b.moveInDate).toLocaleDateString()} — {new Date(b.moveOutDate).toLocaleDateString()} • {b.durationMonths} {t("booking.months")}
                      </div>
                      {b.tenantNotes && <p className="text-sm bg-secondary p-2 rounded mb-2">{b.tenantNotes}</p>}
                      {b.status === "pending" && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateBooking.mutate({ id: b.id, status: "approved" })}>
                            <CheckCircle className="h-4 w-4 me-1" />{lang === "ar" ? "قبول وإرسال الفاتورة" : "Approve & Send Bill"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setBookingDialog({ id: b.id, action: "reject" })}>
                            <XCircle className="h-4 w-4 me-1" />{lang === "ar" ? "رفض" : "Reject"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setLocation(`/messages?to=${b.tenantId}`)}>
                            <MessageSquare className="h-4 w-4 me-1" />{lang === "ar" ? "تواصل" : "Message"}
                          </Button>
                        </div>
                      )}
                      {b.status === "approved" && (
                        <div className="mt-3 p-2.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
                          <span className="text-blue-700 dark:text-blue-400 font-medium">
                            {lang === "ar" ? "بانتظار دفع المستأجر" : "Awaiting tenant payment"}
                          </span>
                        </div>
                      )}
                      {b.status === "active" && (
                        <div className="mt-3 p-2.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm">
                          <span className="text-green-700 dark:text-green-400 font-medium">
                            {lang === "ar" ? "الحجز نشط - تم الدفع" : "Booking active - Payment confirmed"}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد طلبات حجز" : "No booking requests"}</p>
              </Card>
            )}
          </TabsContent>

          {/* Payments */}
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
                          {statusBadge(p.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</div>
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

          {/* Maintenance */}
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
                          {statusBadge(m.status)}
                          {m.priority && <Badge variant={m.priority === "emergency" ? "destructive" : "secondary"}>{t(`maintenance.${m.priority}` as any)}</Badge>}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{m.description}</p>
                      {m.status === "submitted" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => updateMaintenance.mutate({ id: m.id, status: "acknowledged" })}>
                            {lang === "ar" ? "تأكيد الاستلام" : "Acknowledge"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setMaintenanceDialog({ id: m.id, status: "in_progress" })}>
                            {lang === "ar" ? "بدء العمل" : "Start Work"}
                          </Button>
                        </div>
                      )}
                      {m.status === "in_progress" && (
                        <Button size="sm" className="mt-2" onClick={() => updateMaintenance.mutate({ id: m.id, status: "completed" })}>
                          {lang === "ar" ? "تم الإنجاز" : "Mark Complete"}
                        </Button>
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

                {/* User Info */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="flex-1">
                    <h3 className="text-xl font-heading font-bold">{user?.name}</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{lang === "ar" ? "مالك عقار" : "Landlord"}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Booking Dialog */}
      <Dialog open={!!bookingDialog} onOpenChange={() => setBookingDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "سبب الرفض" : "Rejection Reason"}</DialogTitle>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={lang === "ar" ? "اكتب سبب الرفض..." : "Enter rejection reason..."} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialog(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => {
              if (bookingDialog) updateBooking.mutate({ id: bookingDialog.id, status: "rejected", rejectionReason: rejectReason });
            }}>{lang === "ar" ? "رفض الحجز" : "Reject Booking"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
