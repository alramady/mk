import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, TrendingUp, Users, Building2, Calendar, CreditCard,
  Loader2, Shield, ArrowLeft, Activity, PieChart as PieChartIcon,
  Home, Wrench, AlertTriangle, DollarSign, Eye, Clock,
  ChevronUp, ChevronDown, MapPin, Percent, FileText
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import { useMemo, useState } from "react";

const COLORS = ["#3ECFC0", "#C9A96E", "#0B1E2D", "#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6"];
const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#3ECFC0",
  active: "#10b981",
  completed: "#6366f1",
  cancelled: "#f43f5e",
  rejected: "#ef4444",
};

// Animated counter component
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span className="tabular-nums font-bold">
      {value.toLocaleString()}{suffix}
    </span>
  );
}

// Empty state component
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground/60 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

export default function AdminAnalytics() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [timeRange, setTimeRange] = useState(12);

  const analytics = trpc.admin.analytics.useQuery(
    { months: timeRange },
    { enabled: isAuthenticated && user?.role === "admin" }
  );
  const stats = trpc.admin.stats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const isRtl = lang === "ar";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
<div className="container py-20 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-heading font-bold mb-2">{lang === "ar" ? "غير مصرح" : "Unauthorized"}</h2>
        </div>
</div>
    );
  }

  const data = analytics.data;

  const formatMonth = (month: string) => {
    if (!month) return "";
    const [y, m] = month.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", year: "2-digit" });
  };

  const typeLabels: Record<string, { ar: string; en: string }> = {
    apartment: { ar: "شقة", en: "Apartment" },
    villa: { ar: "فيلا", en: "Villa" },
    studio: { ar: "استوديو", en: "Studio" },
    duplex: { ar: "دوبلكس", en: "Duplex" },
    furnished_room: { ar: "غرفة مفروشة", en: "Furnished Room" },
    compound: { ar: "مجمع سكني", en: "Compound" },
    hotel_apartment: { ar: "شقة فندقية", en: "Hotel Apartment" },
  };

  const statusLabels: Record<string, { ar: string; en: string }> = {
    pending: { ar: "قيد الانتظار", en: "Pending" },
    approved: { ar: "معتمد", en: "Approved" },
    active: { ar: "نشط", en: "Active" },
    completed: { ar: "مكتمل", en: "Completed" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
    rejected: { ar: "مرفوض", en: "Rejected" },
    open: { ar: "مفتوح", en: "Open" },
    assigned: { ar: "معين", en: "Assigned" },
    in_progress: { ar: "قيد التنفيذ", en: "In Progress" },
    resolved: { ar: "تم الحل", en: "Resolved" },
    closed: { ar: "مغلق", en: "Closed" },
  };

  const urgencyLabels: Record<string, { ar: string; en: string }> = {
    low: { ar: "منخفض", en: "Low" },
    medium: { ar: "متوسط", en: "Medium" },
    high: { ar: "عالي", en: "High" },
    critical: { ar: "حرج", en: "Critical" },
  };

  const urgencyColors: Record<string, string> = {
    low: "#10b981",
    medium: "#f59e0b",
    high: "#f97316",
    critical: "#ef4444",
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-sm">
        <p className="font-semibold mb-2 text-foreground">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</span>
          </p>
        ))}
      </div>
    );
  };

  // KPI card data
  const kpiCards = [
    {
      icon: Users,
      value: stats.data?.userCount ?? 0,
      label: lang === "ar" ? "إجمالي المستخدمين" : "Total Users",
      color: "#3ECFC0",
      bgClass: "from-[#3ECFC0]/15 via-[#3ECFC0]/5 to-transparent",
    },
    {
      icon: Building2,
      value: stats.data?.activeProperties ?? 0,
      label: lang === "ar" ? "عقارات نشطة" : "Active Properties",
      color: "#C9A96E",
      bgClass: "from-[#C9A96E]/15 via-[#C9A96E]/5 to-transparent",
    },
    {
      icon: Calendar,
      value: stats.data?.activeBookings ?? 0,
      label: lang === "ar" ? `حجوزات نشطة (${stats.data?.approvedBookings ?? 0} بانتظار الدفع)` : `Active Bookings (${stats.data?.approvedBookings ?? 0} awaiting payment)`,
      color: "#6366f1",
      bgClass: "from-[#6366f1]/15 via-[#6366f1]/5 to-transparent",
    },
    {
      icon: DollarSign,
      value: Number(stats.data?.totalRevenue ?? 0),
      label: lang === "ar" ? "إجمالي الإيرادات (ر.س)" : "Total Revenue (SAR)",
      color: "#10b981",
      bgClass: "from-[#10b981]/15 via-[#10b981]/5 to-transparent",
      suffix: "",
    },
  ];

  const secondaryKpis = [
    {
      icon: Percent,
      value: stats.data?.occupancyRate ?? data?.occupancy?.occupancyRate ?? 0,
      label: lang === "ar" ? `نسبة الإشغال (${stats.data?.bookedDays ?? 0} يوم محجوز)` : `Occupancy (${stats.data?.bookedDays ?? 0} booked days)`,
      color: "#3ECFC0",
      suffix: "%",
    },
    {
      icon: Clock,
      value: stats.data?.pendingProperties ?? 0,
      label: lang === "ar" ? "بانتظار الموافقة" : "Pending",
      color: "#f59e0b",
    },
    {
      icon: FileText,
      value: stats.data?.bookingCount ?? 0,
      label: lang === "ar" ? "إجمالي الحجوزات" : "Total Bookings",
      color: "#6366f1",
    },
    {
      icon: Home,
      value: stats.data?.propertyCount ?? 0,
      label: lang === "ar" ? "إجمالي العقارات" : "Total Properties",
      color: "#C9A96E",
    },
  ];

  return (
    <DashboardLayout>
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background">
      <SEOHead title="Analytics" titleAr="التحليلات" path="/admin/analytics" noindex />
<div className="container py-8 flex-1 max-w-7xl">
        {/* Header */}
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
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                {lang === "ar" ? "لوحة التحليلات" : "Analytics Dashboard"}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 ms-14">
                {lang === "ar" ? "تحليلات شاملة لأداء المنصة" : "Comprehensive platform performance analytics"}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 bg-muted/60 p-1 rounded-xl">
            {[3, 6, 12].map((m) => (
              <Button
                key={m}
                variant={timeRange === m ? "default" : "ghost"}
                size="sm"
                className={`rounded-lg px-4 text-xs font-medium transition-all ${
                  timeRange === m ? "shadow-sm" : "hover:bg-background/60"
                }`}
                onClick={() => setTimeRange(m)}
              >
                {m} {lang === "ar" ? "شهر" : "mo"}
              </Button>
            ))}
          </div>
        </div>

        {analytics.isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1,2].map(i => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Primary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {kpiCards.map((kpi, i) => (
                <Card key={i} className={`border-0 shadow-sm rounded-2xl bg-gradient-to-br ${kpi.bgClass} overflow-hidden relative group hover:shadow-md transition-all duration-300`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${kpi.color}20` }}>
                        <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tracking-tight mb-1">
                      <AnimatedNumber value={kpi.value} suffix={kpi.suffix} />
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  </CardContent>
                  {/* Decorative corner */}
                  <div className="absolute -top-6 -end-6 w-20 h-20 rounded-full opacity-[0.07]" style={{ backgroundColor: kpi.color }} />
                </Card>
              ))}
            </div>

            {/* Secondary KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {secondaryKpis.map((kpi, i) => (
                <Card key={i} className="border border-border/40 shadow-none rounded-2xl hover:border-border/80 transition-all duration-300">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${kpi.color}15` }}>
                      <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                    </div>
                    <div>
                      <p className="text-xl font-bold tabular-nums" style={{ color: kpi.color }}>
                        {kpi.value.toLocaleString()}{kpi.suffix || ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Row 1: Bookings & Revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#3ECFC0]/10">
                      <Calendar className="h-3.5 w-3.5 text-[#3ECFC0]" />
                    </div>
                    {lang === "ar" ? "الحجوزات الشهرية" : "Monthly Bookings"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.bookingsByMonth) && data.bookingsByMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.bookingsByMonth.map((d: any) => ({ ...d, monthLabel: formatMonth(d.month) }))} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="activeCount" name={lang === "ar" ? "نشط" : "Active"} fill="#10b981" radius={[6,6,0,0]} />
                        <Bar dataKey="completedCount" name={lang === "ar" ? "مكتمل" : "Completed"} fill="#6366f1" radius={[6,6,0,0]} />
                        <Bar dataKey="pendingCount" name={lang === "ar" ? "قيد الانتظار" : "Pending"} fill="#f59e0b" radius={[6,6,0,0]} />
                        <Bar dataKey="cancelledCount" name={lang === "ar" ? "ملغي" : "Cancelled"} fill="#f43f5e" radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState icon={Calendar} text={lang === "ar" ? "لا توجد بيانات حجوزات" : "No booking data"} />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#C9A96E]/10">
                      <TrendingUp className="h-3.5 w-3.5 text-[#C9A96E]" />
                    </div>
                    {lang === "ar" ? "الإيرادات الشهرية (ر.س)" : "Monthly Revenue (SAR)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.revenueByMonth) && data.revenueByMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={data.revenueByMonth.map((d: any) => ({ ...d, monthLabel: formatMonth(d.month), revenue: Number(d.revenue) }))}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C9A96E" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="revenue" name={lang === "ar" ? "الإيرادات" : "Revenue"} stroke="#C9A96E" fill="url(#revenueGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "#C9A96E", strokeWidth: 2, stroke: "var(--background)" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState icon={TrendingUp} text={lang === "ar" ? "لا توجد بيانات إيرادات" : "No revenue data"} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2: Users & Booking Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#6366f1]/10">
                      <Users className="h-3.5 w-3.5 text-[#6366f1]" />
                    </div>
                    {lang === "ar" ? "تسجيلات المستخدمين" : "User Registrations"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.userRegistrations) && data.userRegistrations.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={data.userRegistrations.map((d: any) => ({ ...d, monthLabel: formatMonth(d.month) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Line type="monotone" dataKey="count" name={lang === "ar" ? "الإجمالي" : "Total"} stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "var(--background)" }} />
                        <Line type="monotone" dataKey="tenantCount" name={lang === "ar" ? "مستأجرين" : "Tenants"} stroke="#3ECFC0" strokeWidth={2} dot={{ r: 3, fill: "#3ECFC0", strokeWidth: 2, stroke: "var(--background)" }} />
                        <Line type="monotone" dataKey="landlordCount" name={lang === "ar" ? "ملاك" : "Landlords"} stroke="#C9A96E" strokeWidth={2} dot={{ r: 3, fill: "#C9A96E", strokeWidth: 2, stroke: "var(--background)" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState icon={Users} text={lang === "ar" ? "لا توجد بيانات تسجيل" : "No registration data"} />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#f59e0b]/10">
                      <PieChartIcon className="h-3.5 w-3.5 text-[#f59e0b]" />
                    </div>
                    {lang === "ar" ? "توزيع حالات الحجوزات" : "Booking Status Distribution"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.bookingStatusDist) && data.bookingStatusDist.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={260}>
                        <PieChart>
                          <Pie
                            data={data.bookingStatusDist.map((d: any) => ({
                              name: statusLabels[d.status]?.[lang] ?? d.status,
                              value: Number(d.count),
                            }))}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={90}
                            paddingAngle={4}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {data.bookingStatusDist.map((_: any, i: number) => (
                              <Cell key={i} fill={STATUS_COLORS[data.bookingStatusDist[i].status] ?? COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2.5">
                        {data.bookingStatusDist.map((d: any, i: number) => {
                          const total = data.bookingStatusDist.reduce((s: number, x: any) => s + Number(x.count), 0);
                          const pct = total > 0 ? Math.round((Number(d.count) / total) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-2.5">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[d.status] ?? COLORS[i % COLORS.length] }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="truncate text-muted-foreground">{statusLabels[d.status]?.[lang] ?? d.status}</span>
                                  <span className="font-semibold ms-2">{pct}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[d.status] ?? COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={PieChartIcon} text={lang === "ar" ? "لا توجد بيانات" : "No data"} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 3: Properties by Type & City */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#3ECFC0]/10">
                      <Building2 className="h-3.5 w-3.5 text-[#3ECFC0]" />
                    </div>
                    {lang === "ar" ? "العقارات حسب النوع" : "Properties by Type"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.propertiesByType) && data.propertiesByType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.propertiesByType.map((d: any) => ({
                        name: typeLabels[d.propertyType]?.[lang] ?? d.propertyType,
                        count: Number(d.count),
                      }))} layout="vertical" barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={90} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                        <Bar dataKey="count" name={lang === "ar" ? "العدد" : "Count"} fill="#3ECFC0" radius={[0,6,6,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState icon={Building2} text={lang === "ar" ? "لا توجد بيانات" : "No data"} />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#C9A96E]/10">
                      <MapPin className="h-3.5 w-3.5 text-[#C9A96E]" />
                    </div>
                    {lang === "ar" ? "العقارات حسب المدينة" : "Properties by City"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.propertiesByCity) && data.propertiesByCity.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={260}>
                        <PieChart>
                          <Pie
                            data={data.propertiesByCity.map((d: any) => ({
                              name: lang === "ar" ? (d.cityAr || d.city) : d.city,
                              value: Number(d.count),
                            }))}
                            cx="50%" cy="50%"
                            outerRadius={90}
                            innerRadius={50}
                            paddingAngle={4}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {data.propertiesByCity.map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-3">
                        {data.propertiesByCity.map((d: any, i: number) => {
                          const total = data.propertiesByCity.reduce((s: number, x: any) => s + Number(x.count), 0);
                          const pct = total > 0 ? Math.round((Number(d.count) / total) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-2.5">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{lang === "ar" ? (d.cityAr || d.city) : d.city}</span>
                                  <span className="font-semibold ms-2">{Number(d.count)} ({pct}%)</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={MapPin} text={lang === "ar" ? "لا توجد بيانات" : "No data"} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 4: Services & Maintenance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#6366f1]/10">
                      <Wrench className="h-3.5 w-3.5 text-[#6366f1]" />
                    </div>
                    {lang === "ar" ? "طلبات الخدمات" : "Service Requests"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.serviceRequests) && data.serviceRequests.length > 0 ? (
                    <div className="space-y-3">
                      {data.serviceRequests.map((sr: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors">
                          <Badge
                            className="text-xs font-medium px-3 py-1"
                            style={{
                              backgroundColor: `${STATUS_COLORS[sr.status] ?? "#94a3b8"}20`,
                              color: STATUS_COLORS[sr.status] ?? "#94a3b8",
                              borderColor: `${STATUS_COLORS[sr.status] ?? "#94a3b8"}30`,
                            }}
                          >
                            {statusLabels[sr.status]?.[lang] ?? sr.status}
                          </Badge>
                          <div className="text-end">
                            <p className="font-bold text-lg tabular-nums">{Number(sr.count)}</p>
                            <p className="text-xs text-muted-foreground">{Number(sr.totalValue).toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Wrench} text={lang === "ar" ? "لا توجد طلبات خدمات" : "No service requests"} />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/40 shadow-none rounded-2xl">
                <CardHeader className="pb-2 px-6 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-[#f43f5e]/10">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#f43f5e]" />
                    </div>
                    {lang === "ar" ? "طوارئ الصيانة" : "Emergency Maintenance"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {Array.isArray(data?.maintenanceSummary) && data.maintenanceSummary.length > 0 ? (
                    <div className="space-y-3">
                      {data.maintenanceSummary.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors">
                          <div className="flex items-center gap-3">
                            <Badge
                              className="text-xs font-medium px-3 py-1"
                              style={{
                                backgroundColor: `${STATUS_COLORS[m.status] ?? "#94a3b8"}20`,
                                color: STATUS_COLORS[m.status] ?? "#94a3b8",
                                borderColor: `${STATUS_COLORS[m.status] ?? "#94a3b8"}30`,
                              }}
                            >
                              {statusLabels[m.status]?.[lang] ?? m.status}
                            </Badge>
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-md"
                              style={{
                                backgroundColor: `${urgencyColors[m.urgency] ?? "#94a3b8"}15`,
                                color: urgencyColors[m.urgency] ?? "#94a3b8",
                              }}
                            >
                              {urgencyLabels[m.urgency]?.[lang] ?? m.urgency}
                            </span>
                          </div>
                          <p className="font-bold text-lg tabular-nums">{Number(m.count)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={AlertTriangle} text={lang === "ar" ? "لا توجد بلاغات صيانة" : "No maintenance reports"} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Properties Table */}
            <Card className="border border-border/40 shadow-none rounded-2xl mb-6">
              <CardHeader className="pb-3 px-6 pt-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <div className="p-1.5 rounded-lg bg-[#10b981]/10">
                    <TrendingUp className="h-3.5 w-3.5 text-[#10b981]" />
                  </div>
                  {lang === "ar" ? "أفضل العقارات أداءً" : "Top Performing Properties"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {Array.isArray(data?.topProperties) && data.topProperties.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-border/30">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-start p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "العقار" : "Property"}</th>
                          <th className="text-start p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "المدينة" : "City"}</th>
                          <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "الإيجار" : "Rent"}</th>
                          <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "الحجوزات" : "Bookings"}</th>
                          <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "المشاهدات" : "Views"}</th>
                          <th className="text-end p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "الإيرادات" : "Revenue"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProperties.map((p: any, i: number) => (
                          <tr key={i} className="border-t border-border/20 hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <Link href={`/property/${p.id}`} className="text-primary hover:underline font-medium text-sm">
                                {lang === "ar" ? p.titleAr : p.titleEn}
                              </Link>
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                                <MapPin className="h-3 w-3" />
                                {lang === "ar" ? (p.cityAr || p.city) : p.city}
                              </span>
                            </td>
                            <td className="p-3 text-center font-medium tabular-nums">{Number(p.monthlyRent).toLocaleString()} <span className="text-muted-foreground text-xs">{lang === "ar" ? "ر.س" : "SAR"}</span></td>
                            <td className="p-3 text-center tabular-nums">{Number(p.bookingCount)}</td>
                            <td className="p-3 text-center tabular-nums">{Number(p.viewCount ?? 0).toLocaleString()}</td>
                            <td className="p-3 text-end">
                              <span className="font-bold tabular-nums text-[#10b981]">{Number(p.totalRevenue).toLocaleString()}</span>
                              <span className="text-muted-foreground text-xs ms-1">{lang === "ar" ? "ر.س" : "SAR"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Building2} text={lang === "ar" ? "لا توجد بيانات عقارات" : "No property data"} />
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border border-border/40 shadow-none rounded-2xl mb-6">
              <CardHeader className="pb-3 px-6 pt-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <div className="p-1.5 rounded-lg bg-[#8b5cf6]/10">
                    <Activity className="h-3.5 w-3.5 text-[#8b5cf6]" />
                  </div>
                  {lang === "ar" ? "النشاط الأخير" : "Recent Activity"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {Array.isArray(data?.recentActivity) && data.recentActivity.length > 0 ? (
                  <div className="space-y-1">
                    {data.recentActivity.map((a: any, i: number) => {
                      const typeConfig: Record<string, { icon: any; color: string; label: { ar: string; en: string } }> = {
                        booking: { icon: Calendar, color: "#3ECFC0", label: { ar: "حجز", en: "Booking" } },
                        payment: { icon: CreditCard, color: "#C9A96E", label: { ar: "دفعة", en: "Payment" } },
                        user: { icon: Users, color: "#6366f1", label: { ar: "مستخدم", en: "User" } },
                        property: { icon: Building2, color: "#10b981", label: { ar: "عقار", en: "Property" } },
                      };
                      const config = typeConfig[a.type] ?? { icon: Activity, color: "#94a3b8", label: { ar: a.type, en: a.type } };
                      const IconComp = config.icon;
                      return (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors group">
                          <div className="p-2 rounded-lg flex-shrink-0 transition-colors" style={{ backgroundColor: `${config.color}10` }}>
                            <IconComp className="h-4 w-4" style={{ color: config.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {config.label[lang]} #{a.id}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0 h-5 font-medium"
                                style={{
                                  borderColor: `${STATUS_COLORS[a.detail] ?? "#94a3b8"}40`,
                                  color: STATUS_COLORS[a.detail] ?? "var(--muted-foreground)",
                                }}
                              >
                                {statusLabels[a.detail]?.[lang] ?? a.detail}
                              </Badge>
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                            {new Date(a.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={Activity} text={lang === "ar" ? "لا يوجد نشاط حديث" : "No recent activity"} />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
</div>
    </DashboardLayout>
  );
}
