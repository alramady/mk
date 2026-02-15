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
import {
  Users, Building2, Calendar, CreditCard, BarChart3,
  Loader2, CheckCircle, XCircle, Shield, TrendingUp, BookOpen,
  Package, AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();

  const stats = trpc.admin.stats.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const users = trpc.admin.users.useQuery({ limit: 50 }, { enabled: isAuthenticated && user?.role === "admin" });
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

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Admin Dashboard" titleAr="لوحة الإدارة" path="/admin" noindex={true} />
      <Navbar />
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">{t("dashboard.admin")}</h1>
          <p className="text-muted-foreground mt-1">{lang === "ar" ? "إدارة المنصة" : "Platform Management"}</p>
        </div>

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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-4 text-center">
            <Users className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.data?.userCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.totalUsers")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Building2 className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.data?.activeProperties ?? 0}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.activeListings")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 text-[#C9A96E] mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.data?.pendingProperties ?? 0}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.pendingApproval")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{Number(stats.data?.totalRevenue ?? 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{t("payment.sar")} {t("dashboard.revenue")}</div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="properties" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="properties" className="gap-1.5"><Building2 className="h-4 w-4" />{t("dashboard.allProperties")}</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />{t("dashboard.users")}</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1.5"><Calendar className="h-4 w-4" />{t("dashboard.allBookings")}</TabsTrigger>
          </TabsList>

          {/* Properties */}
          <TabsContent value="properties">
            {properties.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : properties.data && properties.data.length > 0 ? (
              <div className="space-y-3">
                {properties.data.map((p) => (
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
            {users.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : users.data && users.data.length > 0 ? (
              <div className="space-y-2">
                {users.data.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{u.name || "—"}</span>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{u.email || "—"}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا يوجد مستخدمون" : "No users"}</p>
              </Card>
            )}
          </TabsContent>

          {/* Bookings */}
          <TabsContent value="bookings">
            {bookings.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : bookings.data && bookings.data.length > 0 ? (
              <div className="space-y-3">
                {bookings.data.map((b) => (
                  <Card key={b.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{lang === "ar" ? `حجز #${b.id}` : `Booking #${b.id}`}</span>
                          <Badge variant={b.status === "active" ? "default" : b.status === "pending" ? "secondary" : "outline"}>{b.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(b.moveInDate).toLocaleDateString()} — {new Date(b.moveOutDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="font-bold text-primary">{Number(b.totalAmount).toLocaleString()} {t("payment.sar")}</div>
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
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
