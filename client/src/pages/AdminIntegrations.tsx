import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings2, TestTube, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Eye, EyeOff, Save, RefreshCw, Plug, Shield,
  ArrowDownToLine, ArrowUpFromLine, GitCompare, Clock, Activity,
  FileText, ChevronDown, ChevronUp
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Healthy", labelAr: "يعمل", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  configured: { label: "Configured", labelAr: "مُهيأ", color: "bg-blue-100 text-blue-700", icon: Settings2 },
  not_configured: { label: "Not Configured", labelAr: "غير مُهيأ", color: "bg-gray-100 text-gray-600", icon: AlertTriangle },
  failing: { label: "Failing", labelAr: "فاشل", color: "bg-red-100 text-red-700", icon: XCircle },
};

const INTEGRATION_ICONS: Record<string, string> = {
  beds24: "🏨",
  moyasar: "💳",
  email: "📧",
  maps: "🗺️",
  storage: "☁️",
};

const LOG_STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

export default function AdminIntegrations() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("settings");
  const [showLogDetails, setShowLogDetails] = useState<number | null>(null);

  const { data: integrations, isLoading, refetch } = trpc.integration.list.useQuery();

  // Beds24 sync mutations
  const syncInboundMut = trpc.finance.beds24.syncInbound.useMutation({
    onSuccess: (r: any) => toast.success(isAr ? `تمت المزامنة: ${r?.imported ?? 0} حجز جديد` : `Synced: ${r?.imported ?? 0} new bookings`),
    onError: (e) => toast.error(e.message),
  });
  const reconcileMut = trpc.finance.beds24.reconcile.useMutation({
    onSuccess: (r: any) => toast.success(isAr ? `المطابقة: ${r?.mismatches ?? 0} اختلاف` : `Reconciled: ${r?.mismatches ?? 0} mismatches`),
    onError: (e) => toast.error(e.message),
  });

  // Integration logs query
  const logsQuery = trpc.finance.integrationLogs.list.useQuery({ limit: 50 }, { enabled: activeTab === "logs" });

  const updateMutation = trpc.integration.update.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تم تحديث إعدادات التكامل" : "Integration settings updated");
      refetch();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const testMutation = trpc.integration.test.useMutation({
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      refetch();
      setTestingId(null);
    },
    onError: (e) => { toast.error(e.message); setTestingId(null); },
  });

  const handleToggle = (id: number, currentEnabled: boolean) => {
    updateMutation.mutate({ id, isEnabled: !currentEnabled });
  };
  const handleStartEdit = (id: number, maskedConfig: Record<string, string>) => {
    setEditingId(id);
    setEditConfig({ ...maskedConfig });
    setShowSecrets({});
  };
  const handleSaveConfig = (id: number) => {
    updateMutation.mutate({ id, config: editConfig });
  };
  const handleTest = (id: number) => {
    setTestingId(id);
    testMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto" dir={isAr ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plug className="h-6 w-6" />
              {isAr ? "إعدادات التكاملات" : "Integration Settings"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAr ? "إدارة الاتصالات الخارجية وبوابات الدفع" : "Manage external connections and payment gateways"}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> {isAr ? "تحديث" : "Refresh"}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings" className="flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              {isAr ? "الإعدادات" : "Settings"}
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              {isAr ? "المزامنة" : "Sync"}
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {isAr ? "السجلات" : "Logs"}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Settings (existing integration cards) ── */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center p-4">
                <div className="text-2xl font-bold">{integrations?.length || 0}</div>
                <div className="text-xs text-muted-foreground">{isAr ? "إجمالي التكاملات" : "Total Integrations"}</div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-2xl font-bold text-green-600">
                  {integrations?.filter(i => i.isEnabled).length || 0}
                </div>
                <div className="text-xs text-muted-foreground">{isAr ? "مُفعّل" : "Enabled"}</div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-2xl font-bold text-green-600">
                  {integrations?.filter(i => i.status === "healthy").length || 0}
                </div>
                <div className="text-xs text-muted-foreground">{isAr ? "يعمل بنجاح" : "Healthy"}</div>
              </Card>
              <Card className="text-center p-4">
                <div className="text-2xl font-bold text-red-600">
                  {integrations?.filter(i => i.status === "failing").length || 0}
                </div>
                <div className="text-xs text-muted-foreground">{isAr ? "فاشل" : "Failing"}</div>
              </Card>
            </div>

            {/* Integration cards */}
            <div className="space-y-4">
              {integrations?.map((integration) => {
                const statusConf = STATUS_CONFIG[integration.status || "not_configured"] || STATUS_CONFIG.not_configured;
                const StatusIcon = statusConf.icon;
                const isEditing = editingId === integration.id;
                const isTesting = testingId === integration.id;

                return (
                  <Card key={integration.id} className={`transition-all ${integration.isEnabled ? "border-l-4 border-l-green-500" : "opacity-80"}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{INTEGRATION_ICONS[integration.integrationKey] || "🔌"}</span>
                          <div>
                            <CardTitle className="text-lg">{isAr ? (integration.displayNameAr || integration.displayName) : integration.displayName}</CardTitle>
                            <CardDescription>{isAr ? integration.displayName : (integration.displayNameAr || "")}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={statusConf.color}>
                            <StatusIcon className="h-3 w-3 mx-1" />
                            {isAr ? statusConf.labelAr : statusConf.label}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {integration.isEnabled ? (isAr ? "مُفعّل" : "Enabled") : (isAr ? "مُعطّل" : "Disabled")}
                            </span>
                            <Switch
                              checked={integration.isEnabled || false}
                              onCheckedChange={() => handleToggle(integration.id, integration.isEnabled || false)}
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Masked config display */}
                      {!isEditing && integration.maskedConfig && Object.keys(integration.maskedConfig).length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3 mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(integration.maskedConfig).map(([key, val]) => (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground min-w-[120px]">{key}:</span>
                                <code className="bg-background px-2 py-0.5 rounded text-xs font-mono">{val || "—"}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Edit mode */}
                      {isEditing && integration.configFields && (
                        <div className="border rounded-lg p-4 mb-4 space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-amber-600">
                              {isAr ? "الأسرار مُقنّعة. أدخل قيمة جديدة فقط إذا أردت تغييرها." : "Secrets are masked. Enter a new value only to change it."}
                            </span>
                          </div>
                          {integration.configFields.map((field) => (
                            <div key={field.name}>
                              <Label className="text-sm">{isAr ? field.labelAr : field.label} ({isAr ? field.label : field.labelAr})</Label>
                              <div className="flex gap-2">
                                <Input
                                  type={field.isSecret && !showSecrets[field.name] ? "password" : "text"}
                                  value={editConfig[field.name] || ""}
                                  onChange={e => setEditConfig(prev => ({ ...prev, [field.name]: e.target.value }))}
                                  placeholder={field.isSecret ? "****" : ""}
                                  className="font-mono text-sm"
                                />
                                {field.isSecret && (
                                  <Button variant="ghost" size="icon" onClick={() => setShowSecrets(prev => ({ ...prev, [field.name]: !prev[field.name] }))}>
                                    {showSecrets[field.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-2">
                            <Button onClick={() => handleSaveConfig(integration.id)} disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              {isAr ? "حفظ" : "Save"}
                            </Button>
                            <Button variant="outline" onClick={() => setEditingId(null)}>{isAr ? "إلغاء" : "Cancel"}</Button>
                          </div>
                        </div>
                      )}

                      {/* Last tested info */}
                      {integration.lastTestedAt && (
                        <div className="text-xs text-muted-foreground mb-3">
                          {isAr ? "آخر اختبار:" : "Last tested:"} {new Date(integration.lastTestedAt).toLocaleString(isAr ? "ar-SA" : "en-US")}
                          {integration.lastError && (
                            <span className="text-red-500 mx-2">— {integration.lastError}</span>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {!isEditing && (
                          <Button variant="outline" size="sm" onClick={() => handleStartEdit(integration.id, integration.maskedConfig || {})}>
                            <Settings2 className="h-3 w-3" /> {isAr ? "تعديل الإعدادات" : "Edit Settings"}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleTest(integration.id)} disabled={isTesting}>
                          {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <TestTube className="h-3 w-3" />}
                          {isAr ? "اختبار الاتصال" : "Test Connection"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Tab 2: Sync Operations ── */}
          <TabsContent value="sync" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Inbound Sync */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownToLine className="h-4 w-4 text-blue-500" />
                    {isAr ? "مزامنة واردة" : "Inbound Sync"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isAr ? "استيراد حجوزات Beds24 → MonthlyKey" : "Import Beds24 bookings → MonthlyKey"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    {isAr
                      ? "يجلب الحجوزات الجديدة والمعدّلة من Beds24 ويحوّلها إلى حجوزات MK مع حظر التوفر."
                      : "Fetches new/modified bookings from Beds24 and converts them to MK bookings with availability blocks."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => syncInboundMut.mutate({})}
                      disabled={syncInboundMut.isPending}
                    >
                      {syncInboundMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                      {isAr ? "مزامنة الآن" : "Sync Now"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncInboundMut.mutate({ fullSync: true })}
                      disabled={syncInboundMut.isPending}
                    >
                      {isAr ? "مزامنة كاملة" : "Full Sync"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Outbound Sync */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpFromLine className="h-4 w-4 text-green-500" />
                    {isAr ? "مزامنة صادرة" : "Outbound Sync"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isAr ? "دفع حجوزات MonthlyKey → Beds24" : "Push MK bookings → Beds24"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    {isAr
                      ? "تتم تلقائياً عند تأكيد الدفع أو إلغاء الحجز. لا حاجة لتشغيل يدوي."
                      : "Runs automatically on payment confirmation or booking cancellation. No manual trigger needed."}
                  </p>
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3 mx-1" />
                    {isAr ? "تلقائي" : "Automatic"}
                  </Badge>
                </CardContent>
              </Card>

              {/* Reconciliation */}
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-amber-500" />
                    {isAr ? "المطابقة" : "Reconciliation"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isAr ? "مقارنة Beds24 ↔ MonthlyKey" : "Compare Beds24 ↔ MonthlyKey"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    {isAr
                      ? "يقارن الحجوزات بين النظامين ويكتشف الاختلافات (حجوزات مفقودة، تواريخ مختلفة)."
                      : "Compares bookings between systems and detects mismatches (missing, date differences)."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reconcileMut.mutate({})}
                    disabled={reconcileMut.isPending}
                  >
                    {reconcileMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCompare className="h-3.5 w-3.5" />}
                    {isAr ? "تشغيل المطابقة" : "Run Reconciliation"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sync info card */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  {isAr ? "كيف تعمل المزامنة" : "How Sync Works"}
                </h3>
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>{isAr ? "• مصدر الحقيقة: Beds24 هو المصدر الرئيسي للوحدات المربوطة عبر API." : "• Source of truth: Beds24 is primary for API-linked units."}</p>
                  <p>{isAr ? "• الحجوزات المحلية (MK) تُدفع إلى Beds24 تلقائياً عند التأكيد." : "• Local (MK) bookings are pushed to Beds24 automatically on confirmation."}</p>
                  <p>{isAr ? "• الإيرادات تُحسب فقط من حجوزات MK (source=LOCAL)." : "• Revenue is calculated only from MK bookings (source=LOCAL)."}</p>
                  <p>{isAr ? "• الإشغال يشمل جميع المصادر (LOCAL + BEDS24 + ICAL)." : "• Occupancy includes all sources (LOCAL + BEDS24 + ICAL)."}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 3: Integration Logs ── */}
          <TabsContent value="logs" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {isAr ? "سجل عمليات المزامنة" : "Sync Operation Logs"}
              </h2>
              <Button variant="outline" size="sm" onClick={() => logsQuery.refetch()}>
                <RefreshCw className="h-3.5 w-3.5" /> {isAr ? "تحديث" : "Refresh"}
              </Button>
            </div>

            {logsQuery.isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !logsQuery.data || (Array.isArray(logsQuery.data) && logsQuery.data.length === 0) ? (
              <Card className="text-center p-8">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-muted-foreground text-sm">
                  {isAr ? "لا توجد سجلات مزامنة بعد" : "No sync logs yet"}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {(Array.isArray(logsQuery.data) ? logsQuery.data : []).map((log: any) => (
                  <Card key={log.id} className="transition-all hover:shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {log.direction === "INBOUND" && <ArrowDownToLine className="h-4 w-4 text-blue-500" />}
                          {log.direction === "OUTBOUND" && <ArrowUpFromLine className="h-4 w-4 text-green-500" />}
                          {log.direction === "RECONCILE" && <GitCompare className="h-4 w-4 text-amber-500" />}
                          <div>
                            <span className="text-sm font-medium">{log.direction}</span>
                            {log.entityType && <span className="text-xs text-muted-foreground mx-1">· {log.entityType}</span>}
                          </div>
                          <Badge className={LOG_STATUS_COLORS[log.status] || "bg-gray-100 text-gray-600"}>
                            {log.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(log.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setShowLogDetails(showLogDetails === log.id ? null : log.id)}
                          >
                            {showLogDetails === log.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                      {log.message && <p className="text-xs text-muted-foreground mt-1">{log.message}</p>}
                      {showLogDetails === log.id && log.payload && (
                        <pre className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto max-h-40">
                          {typeof log.payload === "string" ? log.payload : JSON.stringify(log.payload, null, 2)}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
