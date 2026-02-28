import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SendWhatsAppDialog } from "./AdminWhatsApp";
import {
  Search, Loader2, Eye, Phone, Mail, MapPin, BedDouble, Bath, Ruler, MessageCircle as MessageCircleWA,
  ChevronLeft, ChevronRight, Inbox, ArrowUpRight, CheckCircle, XCircle,
  MessageSquare, Clock, Building2
} from "lucide-react";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-200",
  contacted: "bg-amber-500/10 text-amber-600 border-amber-200",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  rejected: "bg-red-500/10 text-red-600 border-red-200",
};
const statusLabels: Record<string, string> = {
  new: "جديد", contacted: "تم التواصل", approved: "مقبول", rejected: "مرفوض",
};
const statusIcons: Record<string, any> = {
  new: Clock, contacted: MessageSquare, approved: CheckCircle, rejected: XCircle,
};
const propertyTypeLabels: Record<string, string> = {
  apartment: "شقة", villa: "فيلا", studio: "استوديو", duplex: "دوبلكس",
  furnished_room: "غرفة مفروشة", compound: "مجمع سكني", hotel_apartment: "شقة فندقية",
};

export default function AdminSubmissions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const [convertId, setConvertId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.submission.list.useQuery({
    limit: 20, offset: page * 20,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });

  const { data: counts } = trpc.submission.counts.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">طلبات إضافة عقار</h1>
          <p className="text-muted-foreground text-sm mt-1">مراجعة وإدارة طلبات تسجيل العقارات من الملاك</p>
        </div>

        {/* Pipeline Stepper */}
        {counts && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                {[
                  { key: "new", label: "جديد", labelEn: "NEW", value: counts.new, icon: Clock, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", accent: "bg-blue-500" },
                  { key: "contacted", label: "تم التواصل", labelEn: "CONTACTED", value: counts.contacted, icon: MessageSquare, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", accent: "bg-amber-500" },
                  { key: "approved", label: "مقبول", labelEn: "APPROVED", value: counts.approved, icon: CheckCircle, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", accent: "bg-emerald-500" },
                  { key: "rejected", label: "مرفوض", labelEn: "REJECTED", value: counts.rejected, icon: XCircle, bg: "bg-red-50", border: "border-red-200", text: "text-red-700", accent: "bg-red-500" },
                ].map((step, i, arr) => {
                  const Icon = step.icon;
                  const isActive = statusFilter === step.key;
                  return (
                    <button
                      key={step.key}
                      onClick={() => { setStatusFilter(isActive ? "all" : step.key); setPage(0); }}
                      className={`flex-1 relative px-4 py-4 flex flex-col items-center gap-1.5 transition-all
                        ${isActive ? step.bg + " ring-2 ring-inset ring-current " + step.text : "hover:bg-muted/50"}
                        ${i < arr.length - 1 ? "border-e" : ""}`}
                    >
                      {/* Top accent bar */}
                      <div className={`absolute top-0 inset-x-0 h-1 ${isActive ? step.accent : "bg-transparent"} transition-colors`} />
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive ? step.accent + " text-white" : "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`text-2xl font-bold ${isActive ? step.text : "text-foreground"}`}>{step.value}</span>
                      <span className="text-xs text-muted-foreground">{step.label}</span>
                      {/* Arrow connector */}
                      {i < arr.length - 1 && i < 2 && (
                        <div className="absolute end-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                          <ChevronLeft className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Total bar */}
              <div className="border-t px-4 py-2 flex items-center justify-between bg-muted/30">
                <span className="text-xs text-muted-foreground">إجمالي الطلبات: <strong className="text-foreground">{counts.total}</strong></span>
                {statusFilter !== "all" && (
                  <button onClick={() => { setStatusFilter("all"); setPage(0); }} className="text-xs text-blue-600 hover:underline">
                    عرض الكل
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="ps-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="new">جديد</SelectItem>
              <SelectItem value="contacted">تم التواصل</SelectItem>
              <SelectItem value="approved">مقبول</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Submissions List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : !data?.items?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">لا توجد طلبات</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.items.map((sub: any) => {
              const StatusIcon = statusIcons[sub.status] || Clock;
              return (
                <Card key={sub.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedId(sub.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{sub.ownerNameAr || sub.ownerName}</h3>
                          <Badge variant="outline" className={statusColors[sub.status] || ""}>
                            <StatusIcon className="h-3 w-3 me-1" />
                            {statusLabels[sub.status] || sub.status}
                          </Badge>
                          {sub.convertedPropertyId && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                              <ArrowUpRight className="h-3 w-3 me-1" /> تم التحويل #{sub.convertedPropertyId}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {sub.phone}</span>
                          {sub.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {sub.email}</span>}
                          {sub.cityAr && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {sub.cityAr}</span>}
                          {sub.propertyType && <span>{propertyTypeLabels[sub.propertyType] || sub.propertyType}</span>}
                          {sub.desiredMonthlyRent && <span className="font-medium text-foreground">{sub.desiredMonthlyRent} ر.س</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(sub.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(sub.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronRight className="h-4 w-4" /> السابق
            </Button>
            <span className="text-sm text-muted-foreground">صفحة {page + 1} من {Math.ceil(data.total / 20)}</span>
            <Button size="sm" variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(p => p + 1)}>
              التالي <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Detail Dialog */}
        <SubmissionDetailDialog
          id={selectedId}
          open={selectedId !== null}
          onClose={() => setSelectedId(null)}
          onRefresh={refetch}
          onConvert={(id) => { setConvertId(id); setSelectedId(null); setShowConvert(true); }}
        />

        {/* Convert Dialog */}
        {showConvert && convertId && (
          <ConvertDialog
            submissionId={convertId}
            open={showConvert}
            onClose={() => { setShowConvert(false); setConvertId(null); }}
            onSuccess={() => { refetch(); setShowConvert(false); setConvertId(null); }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function SubmissionDetailDialog({ id, open, onClose, onRefresh, onConvert }: {
  id: number | null; open: boolean; onClose: () => void; onRefresh: () => void; onConvert: (id: number) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");

  const { data, isLoading } = trpc.submission.getById.useQuery(
    { id: id! },
    { enabled: !!id && open }
  );

  const updateStatus = trpc.submission.updateStatus.useMutation();

  const handleStatusChange = async (status: "new" | "contacted" | "approved" | "rejected") => {
    if (!id) return;
    setUpdating(true);
    try {
      await updateStatus.mutateAsync({ id, status, internalNotes: notes || undefined });
      toast.success("تم تحديث الحالة");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ");
    }
    setUpdating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تفاصيل الطلب #{id}</DialogTitle>
          <DialogDescription>مراجعة بيانات طلب تسجيل العقار</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : data ? (
          <div className="space-y-6 py-4">
            {/* Owner Info */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">بيانات المالك</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">الاسم:</span> <strong>{data.ownerNameAr || data.ownerName}</strong></div>
                <div><span className="text-muted-foreground">الهاتف:</span> <strong dir="ltr">{data.phone}</strong></div>
                {data.email && <div><span className="text-muted-foreground">البريد:</span> <strong>{data.email}</strong></div>}
              </div>
            </div>

            {/* Property Info */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">بيانات العقار</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {data.propertyType && <div><span className="text-muted-foreground">النوع:</span> <strong>{propertyTypeLabels[data.propertyType] || data.propertyType}</strong></div>}
                {data.cityAr && <div><span className="text-muted-foreground">المدينة:</span> <strong>{data.cityAr}</strong></div>}
                {data.districtAr && <div><span className="text-muted-foreground">الحي:</span> <strong>{data.districtAr}</strong></div>}
                {data.bedrooms && <div><span className="text-muted-foreground">غرف النوم:</span> <strong>{data.bedrooms}</strong></div>}
                {data.bathrooms && <div><span className="text-muted-foreground">الحمامات:</span> <strong>{data.bathrooms}</strong></div>}
                {data.sizeSqm && <div><span className="text-muted-foreground">المساحة:</span> <strong>{data.sizeSqm} م²</strong></div>}
                {data.furnishedLevel && <div><span className="text-muted-foreground">التأثيث:</span> <strong>{data.furnishedLevel === "fully_furnished" ? "مفروش" : data.furnishedLevel === "semi_furnished" ? "مفروش جزئياً" : "غير مفروش"}</strong></div>}
                {data.desiredMonthlyRent && <div><span className="text-muted-foreground">الإيجار المطلوب:</span> <strong>{data.desiredMonthlyRent} ر.س</strong></div>}
              </div>
              {(data.notes || data.notesAr) && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <span className="text-muted-foreground">ملاحظات:</span> {data.notesAr || data.notes}
                </div>
              )}
            </div>

            {/* Photos */}
            {data.photos && data.photos.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">الصور ({data.photos.length})</h3>
                <div className="flex flex-wrap gap-3">
                  {data.photos.map((photo: any, i: number) => {
                    // Normalize URLs: strip old domain prefix, keep /uploads/... relative
                    const fixUrl = (u: string) => {
                      if (!u) return u;
                      if (u.startsWith("/uploads/")) return u;
                      if (u.includes("/uploads/")) return "/uploads/" + u.split("/uploads/").pop();
                      return u;
                    };
                    const imgUrl = fixUrl(photo.thumbnailUrl || photo.url);
                    const fullUrl = fixUrl(photo.url);
                    return (
                      <a key={i} href={fullUrl} target="_blank" rel="noopener" className="w-28 h-28 rounded-lg overflow-hidden border hover:ring-2 ring-[#3ECFC0] transition-all">
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Internal Notes */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">ملاحظات داخلية</h3>
              <Textarea
                value={notes || data.internalNotes || ""}
                onChange={e => setNotes(e.target.value)}
                placeholder="أضف ملاحظات داخلية..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("contacted")} disabled={updating}>
                <MessageSquare className="h-3.5 w-3.5 me-1" /> تم التواصل
              </Button>
              <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleStatusChange("approved")} disabled={updating}>
                <CheckCircle className="h-3.5 w-3.5 me-1" /> قبول
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusChange("rejected")} disabled={updating}>
                <XCircle className="h-3.5 w-3.5 me-1" /> رفض
              </Button>
              {!data.convertedPropertyId && (
                <Button size="sm" className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] ms-auto" onClick={() => onConvert(data.id)}>
                  <Building2 className="h-3.5 w-3.5 me-1" /> تحويل إلى عقار
                </Button>
              )}
              <SendWhatsAppDialog
                trigger={
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">
                    <MessageCircleWA className="h-3.5 w-3.5 me-1" /> واتساب
                  </Button>
                }
                defaultPhone={data.phone || ""}
                defaultName={data.name || ""}
              />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({ submissionId, open, onClose, onSuccess }: {
  submissionId: number; open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    monthlyRent: "", status: "draft" as "draft" | "pending",
  });

  const { data } = trpc.submission.getById.useQuery({ id: submissionId }, { enabled: open });
  const convert = trpc.submission.convertToProperty.useMutation();

  // Pre-fill from submission
  const [prefilled, setPrefilled] = useState(false);
  if (data && !prefilled) {
    setForm({
      titleEn: `${data.propertyType || "Property"} in ${data.city || ""}`.trim(),
      titleAr: `${propertyTypeLabels[data.propertyType || ""] || "عقار"} في ${data.cityAr || ""}`.trim(),
      descriptionEn: data.notes || "",
      descriptionAr: data.notesAr || "",
      monthlyRent: String(data.desiredMonthlyRent || ""),
      status: "draft",
    });
    setPrefilled(true);
  }

  const handleConvert = async () => {
    if (!form.titleAr || !form.titleEn || !form.monthlyRent) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setSaving(true);
    try {
      const result = await convert.mutateAsync({ submissionId, ...form });
      toast.success(`تم إنشاء العقار #${result.propertyId} بنجاح`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تحويل الطلب إلى عقار</DialogTitle>
          <DialogDescription>سيتم إنشاء عقار جديد من بيانات هذا الطلب</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div><Label>العنوان (عربي) *</Label><Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} dir="rtl" /></div>
          <div><Label>Title (English) *</Label><Input value={form.titleEn} onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))} dir="ltr" /></div>
          <div><Label>الوصف (عربي)</Label><Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={2} dir="rtl" /></div>
          <div><Label>Description</Label><Textarea value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} rows={2} dir="ltr" /></div>
          <div><Label>الإيجار الشهري (ر.س) *</Label><Input value={form.monthlyRent} onChange={e => setForm(p => ({ ...p, monthlyRent: e.target.value }))} /></div>
          <div>
            <Label>الحالة الأولية</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleConvert} disabled={saving} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            تحويل إلى عقار
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
