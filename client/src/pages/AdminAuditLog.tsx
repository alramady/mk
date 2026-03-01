import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import {
  FileText, ChevronLeft, ChevronRight, Filter,
  Building2, Home, CreditCard, Settings2, MessageCircle,
  Plus, Pencil, Archive, RotateCcw, Trash2, Link, Unlink,
  Send, CheckCircle, XCircle, ToggleLeft, ToggleRight
} from "lucide-react";

const ACTION_ICONS: Record<string, typeof Plus> = {
  CREATE: Plus, UPDATE: Pencil, ARCHIVE: Archive, RESTORE: RotateCcw,
  DELETE: Trash2, LINK_BEDS24: Link, UNLINK_BEDS24: Unlink,
  PUBLISH: CheckCircle, UNPUBLISH: XCircle, CONVERT: RotateCcw,
  TEST: Settings2, ENABLE: ToggleRight, DISABLE: ToggleLeft, SEND: Send,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700", UPDATE: "bg-blue-100 text-blue-700",
  ARCHIVE: "bg-yellow-100 text-yellow-700", RESTORE: "bg-purple-100 text-purple-700",
  DELETE: "bg-red-100 text-red-700", PUBLISH: "bg-green-100 text-green-700",
  UNPUBLISH: "bg-orange-100 text-orange-700", ENABLE: "bg-green-100 text-green-700",
  DISABLE: "bg-gray-100 text-gray-600", TEST: "bg-cyan-100 text-cyan-700",
  SEND: "bg-indigo-100 text-indigo-700",
};

const ENTITY_ICONS: Record<string, typeof Building2> = {
  BUILDING: Building2, UNIT: Home, PROPERTY: Home, INTEGRATION: Settings2,
  WHATSAPP_MESSAGE: MessageCircle, WHATSAPP_TEMPLATE: MessageCircle,
  LEDGER: CreditCard, PAYMENT_METHOD: CreditCard,
};

export default function AdminAuditLog() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const limit = 30;

  const { data, isLoading } = trpc.audit.list.useQuery({
    page,
    limit,
    entityType: entityType || undefined,
    action: action || undefined,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(date);
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">
              {isAr ? "سجل المراجعة" : "Audit Log"}
            </h1>
          </div>
          <Badge variant="outline" className="text-sm">
            {isAr ? `${data?.total ?? 0} سجل` : `${data?.total ?? 0} entries`}
          </Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={entityType} onValueChange={(v) => { setEntityType(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={isAr ? "نوع الكيان" : "Entity Type"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="BUILDING">{isAr ? "مبنى" : "Building"}</SelectItem>
                  <SelectItem value="UNIT">{isAr ? "وحدة" : "Unit"}</SelectItem>
                  <SelectItem value="PROPERTY">{isAr ? "عقار" : "Property"}</SelectItem>
                  <SelectItem value="INTEGRATION">{isAr ? "تكامل" : "Integration"}</SelectItem>
                  <SelectItem value="LEDGER">{isAr ? "دفتر" : "Ledger"}</SelectItem>
                  <SelectItem value="WHATSAPP_MESSAGE">{isAr ? "رسالة واتساب" : "WhatsApp Message"}</SelectItem>
                  <SelectItem value="SUBMISSION">{isAr ? "طلب" : "Submission"}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={action} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={isAr ? "الإجراء" : "Action"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="CREATE">{isAr ? "إنشاء" : "Create"}</SelectItem>
                  <SelectItem value="UPDATE">{isAr ? "تحديث" : "Update"}</SelectItem>
                  <SelectItem value="DELETE">{isAr ? "حذف" : "Delete"}</SelectItem>
                  <SelectItem value="ARCHIVE">{isAr ? "أرشفة" : "Archive"}</SelectItem>
                  <SelectItem value="PUBLISH">{isAr ? "نشر" : "Publish"}</SelectItem>
                  <SelectItem value="ENABLE">{isAr ? "تفعيل" : "Enable"}</SelectItem>
                  <SelectItem value="DISABLE">{isAr ? "تعطيل" : "Disable"}</SelectItem>
                  <SelectItem value="TEST">{isAr ? "اختبار" : "Test"}</SelectItem>
                  <SelectItem value="SEND">{isAr ? "إرسال" : "Send"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isAr ? "سجلات النشاط" : "Activity Records"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {isAr ? "جاري التحميل..." : "Loading..."}
              </div>
            ) : !data?.items?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                {isAr ? "لا توجد سجلات" : "No audit entries found"}
              </div>
            ) : (
              <div className="space-y-2">
                {data.items.map((entry: any) => {
                  const ActionIcon = ACTION_ICONS[entry.action] || Pencil;
                  const EntityIcon = ENTITY_ICONS[entry.entityType] || FileText;
                  const actionColor = ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-600";
                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex-shrink-0 mt-1">
                        <EntityIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${actionColor} text-xs`}>
                            <ActionIcon className="h-3 w-3 me-1" />
                            {entry.action}
                          </Badge>
                          <span className="text-sm font-medium">{entry.entityType}</span>
                          {entry.entityLabel && (
                            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                              — {entry.entityLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{entry.userName || (isAr ? "نظام" : "System")}</span>
                          <span>•</span>
                          <span>{formatDate(entry.createdAt)}</span>
                          {entry.ipAddress && (
                            <>
                              <span>•</span>
                              <span>{entry.ipAddress}</span>
                            </>
                          )}
                        </div>
                        {entry.changes && Object.keys(entry.changes).length > 0 && (
                          <div className="mt-2 text-xs bg-muted/50 rounded p-2 font-mono">
                            {Object.entries(entry.changes as Record<string, { old: unknown; new: unknown }>).map(([key, val]) => (
                              <div key={key}>
                                <span className="text-muted-foreground">{key}:</span>{" "}
                                <span className="text-red-500 line-through">{String(val?.old ?? "—")}</span>{" → "}
                                <span className="text-green-600">{String(val?.new ?? "—")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {isAr ? `${page} من ${totalPages}` : `${page} of ${totalPages}`}
                </span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
