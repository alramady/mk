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
  Home, ArrowLeft, Loader2, CreditCard, Calendar, DollarSign,
  AlertTriangle, Bed, Bath, Ruler, Building2, FileText, ExternalLink
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { getLoginUrl } from "@/const";

const STATUS_COLORS: Record<string, string> = {
  DUE: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  REFUNDED: "bg-purple-100 text-purple-800 border-purple-200",
  VOID: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function AdminUnitFinance() {
  const { lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const isRtl = lang === "ar";
  const [, params] = useRoute("/admin/units/:id");
  const unitId = params?.id ? parseInt(params.id) : 0;

  const { data, isLoading } = trpc.finance.units.financeDetails.useQuery(
    { unitId },
    { enabled: unitId > 0 }
  );

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
      <SEOHead title="Unit Finance" titleAr="مالية الوحدة" path={`/admin/units/${unitId}`} noindex />
      <Navbar />
      <div className="container py-8 flex-1 max-w-5xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-2 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            <Skeleton className="h-64" />
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-muted-foreground">
            <Home className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{lang === "ar" ? "الوحدة غير موجودة" : "Unit not found"}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 hover:bg-primary/10"
                onClick={() => window.history.back()}>
                <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
              <div>
                <h1 className="text-2xl font-heading font-bold flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  {lang === "ar" ? `وحدة ${data.unit.unitNumber}` : `Unit ${data.unit.unitNumber}`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? data.unit.buildingNameAr || data.unit.buildingName : data.unit.buildingName}
                </p>
              </div>
            </div>

            {/* Unit Details + Finance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Unit Info Card */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {lang === "ar" ? "تفاصيل الوحدة" : "Unit Details"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">{lang === "ar" ? "رقم الوحدة:" : "Unit #:"}</span>
                    <span className="font-mono font-medium">{data.unit.unitNumber}</span>
                    <span className="text-muted-foreground">{lang === "ar" ? "الطابق:" : "Floor:"}</span>
                    <span>{data.unit.floor || "—"}</span>
                    <span className="text-muted-foreground">{lang === "ar" ? "الحالة:" : "Status:"}</span>
                    <Badge variant={data.unit.unitStatus === "OCCUPIED" ? "default" : "secondary"} className="w-fit text-xs">
                      {data.unit.unitStatus === "OCCUPIED" ? (lang === "ar" ? "مشغول" : "Occupied")
                        : data.unit.unitStatus === "AVAILABLE" ? (lang === "ar" ? "متاح" : "Available")
                        : data.unit.unitStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t">
                    {data.unit.bedrooms && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Bed className="h-3.5 w-3.5" /><span>{data.unit.bedrooms}</span>
                      </div>
                    )}
                    {data.unit.bathrooms && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Bath className="h-3.5 w-3.5" /><span>{data.unit.bathrooms}</span>
                      </div>
                    )}
                    {data.unit.sizeSqm && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Ruler className="h-3.5 w-3.5" /><span>{data.unit.sizeSqm} m²</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Finance Summary Card */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    {lang === "ar" ? "ملخص مالي" : "Finance Summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">{lang === "ar" ? "الإيجار الشهري:" : "Monthly Rent:"}</span>
                    <span className="font-semibold">
                      {data.unit.monthlyBaseRentSAR ? `${parseFloat(data.unit.monthlyBaseRentSAR).toLocaleString()} SAR` : "—"}
                    </span>
                    <span className="text-muted-foreground">{lang === "ar" ? "الرصيد المعلق:" : "Outstanding:"}</span>
                    <span className={`font-semibold ${data.outstandingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {data.outstandingBalance.toLocaleString()} SAR
                    </span>
                  </div>
                  {data.beds24Mapping && (
                    <div className="pt-2 border-t">
                      <Badge variant="outline" className="text-xs gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Beds24: {data.beds24Mapping.beds24PropertyId}
                        {data.beds24Mapping.sourceOfTruth === "BEDS24" && (
                          <span className="text-amber-600 font-medium"> (Source of Truth)</span>
                        )}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Occupancy Timeline */}
            {data.occupancyTimeline?.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    {lang === "ar" ? "جدول الإشغال (آخر 90 يوم)" : "Occupancy Timeline (Last 90 Days)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {data.occupancyTimeline.map((day: any, i: number) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm ${day.occupied ? "bg-primary" : "bg-muted"}`}
                        title={`${day.date}: ${day.occupied ? (lang === "ar" ? "مشغول" : "Occupied") : (lang === "ar" ? "متاح" : "Available")} (${day.source})`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-primary" /> {lang === "ar" ? "مشغول" : "Occupied"}</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted" /> {lang === "ar" ? "متاح" : "Available"}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Ledger */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {lang === "ar" ? "سجل المدفوعات" : "Payment Ledger"}
                  {data.ledger?.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{data.ledger.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data.ledger?.length ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{lang === "ar" ? "لا توجد سجلات" : "No records"}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "التاريخ" : "Date"}</th>
                          <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "الفاتورة" : "Invoice"}</th>
                          <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "النوع" : "Type"}</th>
                          <th className="px-4 py-3 text-end font-medium">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                          <th className="px-4 py-3 text-center font-medium">{lang === "ar" ? "الحالة" : "Status"}</th>
                          <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "الطريقة" : "Method"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ledger.map((entry: any) => (
                          <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                              {new Date(entry.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{entry.invoiceNumber}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">{entry.type}</Badge>
                            </td>
                            <td className="px-4 py-3 text-end font-mono font-semibold">
                              {entry.direction === "OUT" ? "-" : ""}{parseFloat(entry.amount).toLocaleString()} <span className="text-xs text-muted-foreground">{entry.currency}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[entry.status] || "bg-gray-100 text-gray-800"}`}>
                                {entry.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{entry.paymentMethod || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
