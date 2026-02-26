import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, ArrowLeft, Loader2, TrendingUp, Users, CreditCard,
  AlertTriangle, Home, ChevronRight, BarChart3, DollarSign, Percent
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { getLoginUrl } from "@/const";
import { useState } from "react";

// ─── Building List View ─────────────────────────────────────────────
function BuildingList({ lang }: { lang: string }) {
  const isRtl = lang === "ar";
  const { data, isLoading } = trpc.finance.buildings.list.useQuery({});

  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
    </div>
  );

  if (!data?.items?.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
      <p>{lang === "ar" ? "لا توجد مباني مسجلة" : "No buildings registered"}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.items.map((b: any) => (
        <Link key={b.id} href={`/admin/buildings/${b.id}`}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-border/50 group">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{lang === "ar" ? b.buildingNameAr || b.buildingName : b.buildingName}</h3>
                    <p className="text-xs text-muted-foreground">{lang === "ar" ? b.cityAr || b.city : b.city}{b.district ? ` - ${lang === "ar" ? b.districtAr || b.district : b.district}` : ""}</p>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground ${isRtl ? "rotate-180" : ""}`} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Home className="h-3.5 w-3.5" />
                  <span>{b.totalUnits || 0} {lang === "ar" ? "وحدة" : "units"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={b.isActive ? "default" : "secondary"} className="text-xs">
                    {b.isActive ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "غير نشط" : "Inactive")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ─── Building Detail View with KPIs ─────────────────────────────────
function BuildingDetail({ buildingId, lang }: { buildingId: number; lang: string }) {
  const isRtl = lang === "ar";
  const { data: building, isLoading: loadingBuilding } = trpc.finance.buildings.getById.useQuery({ id: buildingId });
  const { data: kpis, isLoading: loadingKpis } = trpc.finance.buildings.kpis.useQuery({ buildingId });
  const { data: units, isLoading: loadingUnits } = trpc.finance.buildings.unitsWithFinance.useQuery({ buildingId });

  if (loadingBuilding || loadingKpis) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );

  if (!building) return <div className="text-center py-16 text-muted-foreground">{lang === "ar" ? "المبنى غير موجود" : "Building not found"}</div>;

  const kpiCards = kpis ? [
    { icon: Home, label: lang === "ar" ? "إجمالي الوحدات" : "Total Units", value: kpis.totalUnits, color: "text-blue-600" },
    { icon: Users, label: lang === "ar" ? "الوحدات المشغولة" : "Occupied Units", value: kpis.occupiedUnits, color: "text-emerald-600" },
    { icon: Percent, label: lang === "ar" ? "نسبة الإشغال" : "Occupancy Rate", value: `${kpis.occupancyRate}%`, color: "text-primary" },
    { icon: DollarSign, label: lang === "ar" ? "المحصل هذا الشهر" : "Collected MTD", value: `${kpis.collectedMTD.toLocaleString()} SAR`, color: "text-emerald-600" },
    { icon: CreditCard, label: lang === "ar" ? "الرصيد المعلق" : "Outstanding", value: `${kpis.outstandingBalance.toLocaleString()} SAR`, color: "text-amber-600" },
    { icon: AlertTriangle, label: lang === "ar" ? "متأخرات" : "Overdue", value: kpis.overdueCount, color: "text-red-600" },
    { icon: BarChart3, label: lang === "ar" ? "متوسط يومي" : "Avg Daily Rate", value: `${kpis.avgDailyRate.toLocaleString()} SAR`, color: "text-blue-600" },
    { icon: TrendingUp, label: lang === "ar" ? "العائد لكل وحدة" : "RevPAU", value: `${kpis.revPAU.toLocaleString()} SAR`, color: "text-purple-600" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Building Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/buildings">
          <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 hover:bg-primary/10">
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-heading font-bold">
            {lang === "ar" ? building.buildingNameAr || building.buildingName : building.buildingName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? building.cityAr || building.city : building.city}
            {building.district ? ` - ${lang === "ar" ? building.districtAr || building.district : building.district}` : ""}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Units Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">{lang === "ar" ? "الوحدات" : "Units"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUnits ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !units?.length ? (
            <div className="p-12 text-center text-muted-foreground">{lang === "ar" ? "لا توجد وحدات" : "No units"}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "الوحدة" : "Unit"}</th>
                    <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "الطابق" : "Floor"}</th>
                    <th className="px-4 py-3 text-center font-medium">{lang === "ar" ? "الحالة" : "Status"}</th>
                    <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "المستأجر" : "Tenant"}</th>
                    <th className="px-4 py-3 text-end font-medium">{lang === "ar" ? "الإيجار" : "Rent"}</th>
                    <th className="px-4 py-3 text-end font-medium">{lang === "ar" ? "محصل MTD" : "Collected MTD"}</th>
                    <th className="px-4 py-3 text-center font-medium">{lang === "ar" ? "متأخر" : "Overdue"}</th>
                    <th className="px-4 py-3 text-center font-medium">{lang === "ar" ? "تفاصيل" : "Details"}</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u: any) => (
                    <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">{u.unitNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.floor || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={u.unitStatus === "OCCUPIED" ? "default" : u.unitStatus === "AVAILABLE" ? "secondary" : "outline"} className="text-xs">
                          {u.unitStatus === "OCCUPIED" ? (lang === "ar" ? "مشغول" : "Occupied")
                            : u.unitStatus === "AVAILABLE" ? (lang === "ar" ? "متاح" : "Available")
                            : u.unitStatus === "MAINTENANCE" ? (lang === "ar" ? "صيانة" : "Maintenance")
                            : u.unitStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{u.lastGuestName || "—"}</td>
                      <td className="px-4 py-3 text-end font-mono">{u.monthlyBaseRentSAR ? `${parseFloat(u.monthlyBaseRentSAR).toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-end font-mono">{parseFloat(u.collectedMTD || "0").toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {u.overdueCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">{u.overdueCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/admin/units/${u.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <ChevronRight className={`h-3 w-3 ${isRtl ? "rotate-180" : ""}`} />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function AdminBuildings() {
  const { lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const isRtl = lang === "ar";
  const [, params] = useRoute("/admin/buildings/:id");
  const buildingId = params?.id ? parseInt(params.id) : null;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground mb-4">{lang === "ar" ? "يجب تسجيل الدخول كمسؤول" : "Admin access required"}</p>
          <a href={getLoginUrl()}><Button>{lang === "ar" ? "تسجيل الدخول" : "Login"}</Button></a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background">
      <SEOHead title="Buildings" titleAr="المباني" path="/admin/buildings" noindex />
      <Navbar />
      <div className="container py-8 flex-1 max-w-7xl">
        {!buildingId && (
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 hover:bg-primary/10">
                  <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  {lang === "ar" ? "نظرة عامة على المباني" : "Building Overview"}
                </h1>
              </div>
            </div>
          </div>
        )}
        {buildingId ? <BuildingDetail buildingId={buildingId} lang={lang} /> : <BuildingList lang={lang} />}
      </div>
      <Footer />
    </div>
  );
}
