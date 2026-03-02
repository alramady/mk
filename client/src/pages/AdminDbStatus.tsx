import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database, Server, Shield, Clock, RefreshCw, CheckCircle2,
  XCircle, AlertTriangle, HardDrive, Layers, GitBranch
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "< 1m";
}

export default function AdminDbStatus() {
  const { lang, t } = useI18n();
  const isAr = lang === "ar";
  const locale = isAr ? "ar-SA" : "en-US";
  const textAlign = isAr ? "text-right" : "text-left";

  const [refetchKey, setRefetchKey] = useState(0);
  const dbStatus = trpc.admin.dbStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleRefresh = () => {
    setRefetchKey(k => k + 1);
    dbStatus.refetch();
  };

  const data = dbStatus.data;
  const isLoading = dbStatus.isLoading;
  const isError = dbStatus.isError;

  const txt = {
    title: isAr ? "حالة قاعدة البيانات" : "Database Status",
    subtitle: isAr
      ? "مراقبة اتصال قاعدة البيانات والهجرات والبيئة النشطة"
      : "Monitor database connection, migrations, and active environment",
    refresh: isAr ? "تحديث" : "Refresh",
    fetchError: isAr ? "فشل في جلب حالة قاعدة البيانات" : "Failed to fetch database status",
    fetchErrorHint: isAr
      ? "تأكد من أنك مسجل دخول كمسؤول ولديك صلاحية manage_settings"
      : "Make sure you are logged in as an admin with manage_settings permission",
    connected: isAr ? "قاعدة البيانات متصلة" : "Database Connected",
    disconnected: isAr ? "قاعدة البيانات غير متصلة" : "Database Disconnected",
    lastCheck: isAr ? "آخر فحص" : "Last checked",
    envProduction: isAr ? "إنتاج" : "Production",
    envStaging: isAr ? "تجريبي" : "Staging",
    envDevelopment: isAr ? "تطوير" : "Development",
    preview: isAr ? "معاينة" : "Preview",
    host: isAr ? "المضيف (Host)" : "Host",
    dbName: isAr ? "اسم قاعدة البيانات" : "Database Name",
    port: isAr ? "المنفذ (Port)" : "Port",
    mysqlVersion: isAr ? "إصدار MySQL" : "MySQL Version",
    tableCount: isAr ? "عدد الجداول" : "Table Count",
    migrationStatus: isAr ? "حالة الهجرات" : "Migration Status",
    serverUptime: isAr ? "وقت تشغيل الخادم" : "Server Uptime",
    environment: isAr ? "البيئة" : "Environment",
    envBadgeProduction: isAr ? "🔴 إنتاج (Production)" : "🔴 Production",
    envBadgeStaging: isAr ? "🟡 تجريبي (Staging)" : "🟡 Staging",
    envBadgeDevelopment: isAr ? "🟢 تطوير (Development)" : "🟢 Development",
    recentMigrations: isAr ? "آخر الهجرات المطبقة" : "Recent Applied Migrations",
    colNumber: "#",
    colHash: "Hash",
    colAppliedAt: isAr ? "تاريخ التطبيق" : "Applied At",
    securityTitle: isAr ? "ملاحظة أمنية" : "Security Notice",
    securityBody: isAr
      ? "عنوان المضيف معروض بشكل مقنّع (masked) لأسباب أمنية. هذه الصفحة متاحة فقط للمسؤولين الذين يملكون صلاحية manage_settings. لا يتم عرض كلمات المرور أو سلاسل الاتصال الكاملة أبداً."
      : "The host address is masked for security reasons. This page is only accessible to admins with manage_settings permission. Passwords and full connection strings are never displayed.",
  };

  const envLabel = (env: string | undefined) => {
    if (env === "production") return txt.envProduction;
    if (env === "staging") return txt.envStaging;
    return txt.envDevelopment;
  };

  const envBadgeLabel = (env: string | undefined) => {
    if (env === "production") return txt.envBadgeProduction;
    if (env === "staging") return txt.envBadgeStaging;
    return txt.envBadgeDevelopment;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-7 w-7 text-[#3ECFC0]" />
              {txt.title}
            </h1>
            <p className="text-muted-foreground mt-1">
              {txt.subtitle}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {txt.refresh}
          </Button>
        </div>

        {/* Error State */}
        {isError && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="p-6 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-500" />
              <div>
                <p className="font-semibold text-red-500">{txt.fetchError}</p>
                <p className="text-sm text-muted-foreground">
                  {txt.fetchErrorHint}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Status Banner */}
        {!isLoading && data && (
          <Card className={`border-2 ${data.connected ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {data.connected ? (
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-green-500" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <XCircle className="h-7 w-7 text-red-500" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold">
                    {data.connected ? txt.connected : txt.disconnected}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {txt.lastCheck}: {new Date(data.checkedAt).toLocaleString(locale)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant={data.environment === "production" ? "destructive" : data.environment === "staging" ? "secondary" : "outline"}>
                  {envLabel(data.environment)}
                </Badge>
                {data.isPreviewDeploy && (
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                    <AlertTriangle className="h-3 w-3 ml-1" />
                    {txt.preview}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* DB Host */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Server className="h-4 w-4" />
                {txt.host}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xl font-mono font-bold">{data?.host ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          {/* DB Name */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {txt.dbName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xl font-mono font-bold">{data?.database ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          {/* DB Port */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {txt.port}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xl font-mono font-bold">{data?.port ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          {/* MySQL Version */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                {txt.mysqlVersion}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xl font-mono font-bold">{data?.mysqlVersion ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          {/* Table Count */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {txt.tableCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xl font-mono font-bold">{data?.tableCount ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          {/* Migration Version */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                {txt.migrationStatus}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xl font-mono font-bold">{data?.migrationVersion ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          {/* Server Uptime */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {txt.serverUptime}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <p className="text-xl font-mono font-bold">
                  {formatUptime(data?.serverUptimeSeconds ?? 0)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Environment */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {txt.environment}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={data?.environment === "production" ? "destructive" : "secondary"}
                    className="text-base px-3 py-1"
                  >
                    {envBadgeLabel(data?.environment)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Migrations Table */}
        {data?.recentMigrations && data.recentMigrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-[#3ECFC0]" />
                {txt.recentMigrations}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`${textAlign} py-2 px-3 font-medium text-muted-foreground`}>{txt.colNumber}</th>
                      <th className={`${textAlign} py-2 px-3 font-medium text-muted-foreground`}>{txt.colHash}</th>
                      <th className={`${textAlign} py-2 px-3 font-medium text-muted-foreground`}>{txt.colAppliedAt}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentMigrations.map((m, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 px-3 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-mono">{m.hash}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {m.appliedAt !== "unknown" ? new Date(m.appliedAt).toLocaleString(locale) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Notice */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-amber-600 dark:text-amber-400">{txt.securityTitle}</p>
              <p className="text-muted-foreground mt-1">
                {txt.securityBody}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
