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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-7 w-7 text-[#3ECFC0]" />
              حالة قاعدة البيانات
            </h1>
            <p className="text-muted-foreground mt-1">
              مراقبة اتصال قاعدة البيانات والهجرات والبيئة النشطة
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
            تحديث
          </Button>
        </div>

        {/* Error State */}
        {isError && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="p-6 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-500" />
              <div>
                <p className="font-semibold text-red-500">فشل في جلب حالة قاعدة البيانات</p>
                <p className="text-sm text-muted-foreground">
                  تأكد من أنك مسجل دخول كمسؤول ولديك صلاحية manage_settings
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
                    {data.connected ? "قاعدة البيانات متصلة" : "قاعدة البيانات غير متصلة"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    آخر فحص: {new Date(data.checkedAt).toLocaleString("ar-SA")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant={data.environment === "production" ? "destructive" : data.environment === "staging" ? "secondary" : "outline"}>
                  {data.environment === "production" ? "إنتاج" : data.environment === "staging" ? "تجريبي" : "تطوير"}
                </Badge>
                {data.isPreviewDeploy && (
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                    <AlertTriangle className="h-3 w-3 ml-1" />
                    معاينة
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
                المضيف (Host)
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
                اسم قاعدة البيانات
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
                المنفذ (Port)
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
                إصدار MySQL
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
                عدد الجداول
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
                حالة الهجرات
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
                وقت تشغيل الخادم
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
                البيئة
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
                    {data?.environment === "production" ? "🔴 إنتاج (Production)" :
                     data?.environment === "staging" ? "🟡 تجريبي (Staging)" :
                     "🟢 تطوير (Development)"}
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
                آخر الهجرات المطبقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">#</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Hash</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">تاريخ التطبيق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentMigrations.map((m, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 px-3 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-mono">{m.hash}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {m.appliedAt !== "unknown" ? new Date(m.appliedAt).toLocaleString("ar-SA") : "—"}
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
              <p className="font-semibold text-amber-600 dark:text-amber-400">ملاحظة أمنية</p>
              <p className="text-muted-foreground mt-1">
                عنوان المضيف معروض بشكل مقنّع (masked) لأسباب أمنية. هذه الصفحة متاحة فقط
                للمسؤولين الذين يملكون صلاحية <code className="bg-muted px-1 rounded">manage_settings</code>.
                لا يتم عرض كلمات المرور أو سلاسل الاتصال الكاملة أبداً.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
