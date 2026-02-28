import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Settings2, TestTube, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Eye, EyeOff, Save, RefreshCw, Plug, Shield
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Healthy", labelAr: "يعمل", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  configured: { label: "Configured", labelAr: "مُهيأ", color: "bg-blue-100 text-blue-700", icon: Settings2 },
  not_configured: { label: "Not Configured", labelAr: "غير مُهيأ", color: "bg-gray-100 text-gray-600", icon: AlertTriangle },
  failing: { label: "Failing", labelAr: "فشل", color: "bg-red-100 text-red-700", icon: XCircle },
};

const INTEGRATION_ICONS: Record<string, string> = {
  beds24: "🏨",
  moyasar: "💳",
  email: "📧",
  maps: "🗺️",
  storage: "☁️",
};

export default function AdminIntegrations() {

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<number | null>(null);

  const { data: integrations, isLoading, refetch } = trpc.integration.list.useQuery();

  const updateMutation = trpc.integration.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث إعدادات التكامل");
      refetch();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const testMutation = trpc.integration.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      refetch();
      setTestingId(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setTestingId(null);
    },
  });

  const handleToggle = (id: number, currentEnabled: boolean) => {
    updateMutation.mutate({ id, isEnabled: !currentEnabled });
  };

  const handleStartEdit = (id: number, maskedConfig: Record<string, string>) => {
    setEditingId(id);
    // Initialize with masked values
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
      <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plug className="h-6 w-6" />
              إعدادات التكاملات
            </h1>
            <p className="text-muted-foreground mt-1">إدارة الاتصالات الخارجية وبوابات الدفع</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 ml-1" /> تحديث
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-4">
            <div className="text-2xl font-bold">{integrations?.length || 0}</div>
            <div className="text-xs text-muted-foreground">إجمالي التكاملات</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-green-600">
              {integrations?.filter(i => i.isEnabled).length || 0}
            </div>
            <div className="text-xs text-muted-foreground">مُفعّل</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-green-600">
              {integrations?.filter(i => i.status === "healthy").length || 0}
            </div>
            <div className="text-xs text-muted-foreground">يعمل بنجاح</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-red-600">
              {integrations?.filter(i => i.status === "failing").length || 0}
            </div>
            <div className="text-xs text-muted-foreground">فاشل</div>
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
                        <CardTitle className="text-lg">{integration.displayNameAr || integration.displayName}</CardTitle>
                        <CardDescription>{integration.displayName}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusConf.color}>
                        <StatusIcon className="h-3 w-3 ml-1" />
                        {statusConf.labelAr}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {integration.isEnabled ? "مُفعّل" : "مُعطّل"}
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
                        <span className="text-sm text-amber-600">الأسرار مُقنّعة. أدخل قيمة جديدة فقط إذا أردت تغييرها.</span>
                      </div>
                      {integration.configFields.map((field) => (
                        <div key={field.name}>
                          <Label className="text-sm">{field.labelAr} ({field.label})</Label>
                          <div className="flex gap-2">
                            <Input
                              type={field.isSecret && !showSecrets[field.name] ? "password" : "text"}
                              value={editConfig[field.name] || ""}
                              onChange={e => setEditConfig(prev => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.isSecret ? "****" : ""}
                              className="font-mono text-sm"
                            />
                            {field.isSecret && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowSecrets(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
                              >
                                {showSecrets[field.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <Button onClick={() => handleSaveConfig(integration.id)} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
                          حفظ
                        </Button>
                        <Button variant="outline" onClick={() => setEditingId(null)}>إلغاء</Button>
                      </div>
                    </div>
                  )}

                  {/* Last tested info */}
                  {integration.lastTestedAt && (
                    <div className="text-xs text-muted-foreground mb-3">
                      آخر اختبار: {new Date(integration.lastTestedAt).toLocaleString("ar-SA")}
                      {integration.lastError && (
                        <span className="text-red-500 mr-2">— {integration.lastError}</span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {!isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(integration.id, integration.maskedConfig || {})}
                      >
                        <Settings2 className="h-3 w-3 ml-1" /> تعديل الإعدادات
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(integration.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-3 w-3 animate-spin ml-1" />
                      ) : (
                        <TestTube className="h-3 w-3 ml-1" />
                      )}
                      اختبار الاتصال
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
