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
  Home, Calendar, CreditCard, Heart, Wrench, Bell, Settings,
  Loader2, Building2, Clock, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

const statusBadge = (status: string, lang: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; labelAr: string }> = {
    pending: { variant: "secondary", label: "Pending", labelAr: "قيد الانتظار" },
    approved: { variant: "default", label: "Approved", labelAr: "مقبول" },
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

  const bookings = trpc.booking.myBookings.useQuery(undefined, { enabled: isAuthenticated });
  const payments = trpc.payment.myPayments.useQuery(undefined, { enabled: isAuthenticated });
  const favorites = trpc.favorite.list.useQuery(undefined, { enabled: isAuthenticated });
  const maintenance = trpc.maintenance.myRequests.useQuery(undefined, { enabled: isAuthenticated });
  const notifications = trpc.notification.list.useQuery(undefined, { enabled: isAuthenticated });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  return (
    <div className="min-h-screen flex flex-col">
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
          </TabsList>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            {bookings.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : bookings.data && bookings.data.length > 0 ? (
              <div className="space-y-3">
                {bookings.data.map((b) => (
                  <Card key={b.id} className="card-hover transition-shadow cursor-pointer" onClick={() => setLocation(`/property/${b.propertyId}`)}>
                    <CardContent className="p-4 flex items-center justify-between">
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
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
