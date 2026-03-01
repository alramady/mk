import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Home, ArrowLeft, Loader2, CreditCard, Calendar, DollarSign,
  AlertTriangle, Bed, Bath, Ruler, Building2, FileText, ExternalLink,
  Pencil, Archive, RotateCcw, Wifi, Link2, Unlink, Shield, Plus, ImageIcon
} from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { normalizeImageUrl, BROKEN_IMAGE_PLACEHOLDER } from "@/lib/image-utils";

const STATUS_COLORS: Record<string, string> = {
  DUE: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  REFUNDED: "bg-purple-100 text-purple-800 border-purple-200",
  VOID: "bg-gray-100 text-gray-800 border-gray-200",
};

// ─── Unit Form (Create/Edit) ────────────────────────────────────────
function UnitForm({ unit, buildingId, onSuccess, onCancel, lang }: {
  unit?: any; buildingId: number; onSuccess: () => void; onCancel: () => void; lang: string;
}) {
  const isRtl = lang === "ar";
  const isEdit = !!unit;
  const [form, setForm] = useState({
    unitNumber: unit?.unitNumber || "",
    floor: unit?.floor?.toString() || "",
    bedrooms: unit?.bedrooms?.toString() || "",
    bathrooms: unit?.bathrooms?.toString() || "",
    sizeSqm: unit?.sizeSqm?.toString() || "",
    unitStatus: unit?.unitStatus || "AVAILABLE",
    monthlyBaseRentSAR: unit?.monthlyBaseRentSAR || "",
    notes: unit?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [uniqueError, setUniqueError] = useState("");
  const createMutation = trpc.finance.units.create.useMutation();
  const updateMutation = trpc.finance.units.update.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitNumber.trim()) {
      toast.error(isRtl ? "رقم الوحدة مطلوب" : "Unit number is required");
      return;
    }
    // P0 Fix: Validate monthly rent is required and > 0
    const rentValue = parseFloat(form.monthlyBaseRentSAR);
    if (!form.monthlyBaseRentSAR || isNaN(rentValue) || rentValue <= 0) {
      toast.error(isRtl ? "الإيجار الشهري مطلوب ويجب أن يكون أكبر من صفر" : "Monthly rent is required and must be greater than 0");
      return;
    }
    setSaving(true);
    setUniqueError("");
    try {
      const payload: any = {
        unitNumber: form.unitNumber,
        unitStatus: form.unitStatus,
        ...(form.floor ? { floor: parseInt(form.floor) } : {}),
        ...(form.bedrooms ? { bedrooms: parseInt(form.bedrooms) } : {}),
        ...(form.bathrooms ? { bathrooms: parseInt(form.bathrooms) } : {}),
        ...(form.sizeSqm ? { sizeSqm: parseFloat(form.sizeSqm) } : {}),
        ...(form.monthlyBaseRentSAR ? { monthlyBaseRentSAR: form.monthlyBaseRentSAR } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      };
      if (isEdit) {
        await updateMutation.mutateAsync({ id: unit.id, ...payload });
        toast.success(isRtl ? "تم تحديث الوحدة" : "Unit updated");
      } else {
        await createMutation.mutateAsync({ buildingId, ...payload });
        toast.success(isRtl ? "تم إنشاء الوحدة" : "Unit created");
      }
      onSuccess();
    } catch (err: any) {
      if (err.message?.includes("already exists") || err.message?.includes("unique") || err.message?.includes("Duplicate")) {
        setUniqueError(isRtl ? "رقم الوحدة موجود مسبقاً في هذا المبنى" : "Unit number already exists in this building");
      } else {
        toast.error(err.message || "Error");
      }
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isRtl ? "رقم الوحدة" : "Unit Number"} *</Label>
          <Input value={form.unitNumber} onChange={e => { set("unitNumber", e.target.value); setUniqueError(""); }} required placeholder="e.g. 101, A-1" />
          {uniqueError && <p className="text-xs text-destructive">{uniqueError}</p>}
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "حالة الوحدة" : "Unit Status"}</Label>
          <Select value={form.unitStatus} onValueChange={v => set("unitStatus", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">{isRtl ? "متاح" : "Available"}</SelectItem>
              <SelectItem value="BLOCKED">{isRtl ? "محجوب" : "Blocked"}</SelectItem>
              <SelectItem value="MAINTENANCE">{isRtl ? "صيانة" : "Maintenance"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            {isRtl ? "الإيجار الشهري (SAR)" : "Monthly Rent (SAR)"} <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="1"
            required
            value={form.monthlyBaseRentSAR}
            onChange={e => set("monthlyBaseRentSAR", e.target.value)}
            placeholder="5000"
            className={!form.monthlyBaseRentSAR || parseFloat(form.monthlyBaseRentSAR) <= 0 ? "border-amber-400 focus-visible:ring-amber-400" : ""}
          />
          {(!form.monthlyBaseRentSAR || parseFloat(form.monthlyBaseRentSAR) <= 0) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {isRtl ? "مطلوب لتفعيل الدفع والحجز" : "Required for payment & booking to work"}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "الطابق" : "Floor"}</Label>
          <Input type="number" value={form.floor} onChange={e => set("floor", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "غرف النوم" : "Bedrooms"}</Label>
          <Input type="number" value={form.bedrooms} onChange={e => set("bedrooms", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "الحمامات" : "Bathrooms"}</Label>
          <Input type="number" value={form.bathrooms} onChange={e => set("bathrooms", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "المساحة (م²)" : "Size (sqm)"}</Label>
          <Input type="number" step="0.1" value={form.sizeSqm} onChange={e => set("sizeSqm", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{isRtl ? "ملاحظات" : "Notes"}</Label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
      </div>
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{isRtl ? "إلغاء" : "Cancel"}</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEdit ? (isRtl ? "حفظ التعديلات" : "Save Changes") : (isRtl ? "إنشاء الوحدة" : "Create Unit")}
        </Button>
      </div>
    </form>
  );
}

// ─── Beds24 Mapping Section ─────────────────────────────────────────
function Beds24MappingSection({ unitId, lang }: { unitId: number; lang: string }) {
  const isRtl = lang === "ar";
  const utils = trpc.useUtils();
  const { data: mapping, isLoading } = trpc.finance.beds24.byUnit.useQuery({ unitId });
  const [linkOpen, setLinkOpen] = useState(false);
  const [form, setForm] = useState({
    connectionType: "API" as "API" | "ICAL",
    beds24PropertyId: "",
    beds24RoomId: "",
    icalImportUrl: "",
    icalExportUrl: "",
    beds24ApiKey: "",
  });
  const [saving, setSaving] = useState(false);
  const upsertMutation = trpc.finance.beds24.upsert.useMutation();
  const deleteMutation = trpc.finance.beds24.delete.useMutation();

  useEffect(() => {
    if (mapping) {
      setForm({
        connectionType: mapping.connectionType || "API",
        beds24PropertyId: mapping.beds24PropertyId || "",
        beds24RoomId: mapping.beds24RoomId || "",
        icalImportUrl: mapping.icalImportUrl || "",
        icalExportUrl: mapping.icalExportUrl || "",
        beds24ApiKey: mapping.beds24ApiKey || "",
      });
    }
  }, [mapping]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertMutation.mutateAsync({
        unitId,
        connectionType: form.connectionType,
        beds24PropertyId: form.beds24PropertyId || undefined,
        beds24RoomId: form.beds24RoomId || undefined,
        icalImportUrl: form.icalImportUrl || undefined,
        icalExportUrl: form.icalExportUrl || undefined,
        beds24ApiKey: form.beds24ApiKey || undefined,
        sourceOfTruth: "BEDS24",
      });
      toast.success(isRtl ? "تم ربط الوحدة بـ Beds24" : "Unit linked to Beds24");
      setLinkOpen(false);
      utils.finance.beds24.byUnit.invalidate({ unitId });
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!mapping) return;
    try {
      await deleteMutation.mutateAsync({ id: mapping.id });
      toast.success(isRtl ? "تم فك الربط" : "Beds24 mapping removed");
      utils.finance.beds24.byUnit.invalidate({ unitId });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{isRtl ? "ربط Beds24" : "Beds24 Connection"}</CardTitle>
          </div>
          {mapping ? (
            <div className="flex gap-2">
              <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" />{isRtl ? "تعديل" : "Edit"}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{isRtl ? "تعديل ربط Beds24" : "Edit Beds24 Mapping"}</DialogTitle>
                    <DialogDescription>{isRtl ? "هذا الربط للقراءة فقط — لا يكتب إلى Beds24" : "Read-only mapping — no writes to Beds24"}</DialogDescription>
                  </DialogHeader>
                  <Beds24Form form={form} set={set} lang={lang} saving={saving} onSave={handleSave} onCancel={() => setLinkOpen(false)} />
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                    <Unlink className="h-3.5 w-3.5 mr-1" />{isRtl ? "فك الربط" : "Unlink"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{isRtl ? "فك ربط Beds24؟" : "Unlink Beds24?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isRtl ? "سيتم إزالة الربط. الإشغال سيصبح محلي." : "Mapping will be removed. Occupancy source becomes local."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnlink} className="bg-destructive text-destructive-foreground">
                      {isRtl ? "فك الربط" : "Unlink"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Link2 className="h-3.5 w-3.5 mr-1" />{isRtl ? "ربط بـ Beds24" : "Link to Beds24"}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{isRtl ? "ربط الوحدة بـ Beds24" : "Link Unit to Beds24"}</DialogTitle>
                  <DialogDescription>{isRtl ? "هذا الربط للقراءة فقط — لا يكتب إلى Beds24" : "Read-only mapping — no writes to Beds24"}</DialogDescription>
                </DialogHeader>
                <Beds24Form form={form} set={set} lang={lang} saving={saving} onSave={handleSave} onCancel={() => setLinkOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {mapping ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className={`gap-1 ${mapping.connectionType === 'API' ? 'border-blue-300 text-blue-600' : 'border-amber-300 text-amber-600'}`}>
                {mapping.connectionType === 'API' ? <Wifi className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                {mapping.connectionType}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                {isRtl ? "مصدر الحقيقة: Beds24" : "Source: Beds24"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {mapping.beds24PropertyId && (
                <div><span className="text-muted-foreground">{isRtl ? "معرف العقار:" : "Property ID:"}</span> <span className="font-mono ml-1">{mapping.beds24PropertyId}</span></div>
              )}
              {mapping.beds24RoomId && (
                <div><span className="text-muted-foreground">{isRtl ? "معرف الغرفة:" : "Room ID:"}</span> <span className="font-mono ml-1">{mapping.beds24RoomId}</span></div>
              )}
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {isRtl ? "الربط للقراءة فقط — لا يتم إرسال أي بيانات إلى Beds24" : "Read-only mapping — no data is sent to Beds24"}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Wifi className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p>{isRtl ? "غير مربوطة بـ Beds24 — الإشغال محلي" : "Not linked to Beds24 — occupancy is local"}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Beds24Form({ form, set, lang, saving, onSave, onCancel }: {
  form: any; set: (k: string, v: string) => void; lang: string; saving: boolean;
  onSave: () => void; onCancel: () => void;
}) {
  const isRtl = lang === "ar";
  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="space-y-2">
        <Label>{isRtl ? "نوع الاتصال" : "Connection Type"}</Label>
        <Select value={form.connectionType} onValueChange={v => set("connectionType", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="API">API</SelectItem>
            <SelectItem value="ICAL">iCal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.connectionType === "API" ? (
        <>
          <div className="space-y-2">
            <Label>Beds24 Property ID</Label>
            <Input value={form.beds24PropertyId} onChange={e => set("beds24PropertyId", e.target.value)} placeholder="e.g. 12345" />
          </div>
          <div className="space-y-2">
            <Label>Beds24 Room ID</Label>
            <Input value={form.beds24RoomId} onChange={e => set("beds24RoomId", e.target.value)} placeholder="e.g. 67890" />
          </div>
          <div className="space-y-2">
            <Label>API Key ({isRtl ? "اختياري" : "optional"})</Label>
            <Input type="password" value={form.beds24ApiKey} onChange={e => set("beds24ApiKey", e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label>iCal Import URL</Label>
            <Input value={form.icalImportUrl} onChange={e => set("icalImportUrl", e.target.value)} placeholder="https://beds24.com/ical/..." />
          </div>
          <div className="space-y-2">
            <Label>iCal Export URL ({isRtl ? "اختياري" : "optional"})</Label>
            <Input value={form.icalExportUrl} onChange={e => set("icalExportUrl", e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Beds24 Property ID ({isRtl ? "اختياري" : "optional"})</Label>
            <Input value={form.beds24PropertyId} onChange={e => set("beds24PropertyId", e.target.value)} />
          </div>
        </>
      )}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{isRtl ? "إلغاء" : "Cancel"}</Button>
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isRtl ? "حفظ الربط" : "Save Mapping"}
        </Button>
      </div>
    </div>
  );
}

// ─── New Unit Page ──────────────────────────────────────────────────
function NewUnit({ buildingId, lang }: { buildingId: number; lang: string }) {
  const isRtl = lang === "ar";
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/buildings/${buildingId}`}>
          <Button variant="outline" size="icon" className="rounded-xl h-10 w-10">
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
        </Link>
        <h2 className="text-xl font-heading font-bold">{isRtl ? "إضافة وحدة جديدة" : "Add New Unit"}</h2>
      </div>
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <UnitForm
            buildingId={buildingId}
            lang={lang}
            onSuccess={() => navigate(`/admin/buildings/${buildingId}`)}
            onCancel={() => navigate(`/admin/buildings/${buildingId}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Unit Detail View (existing + CRUD + Beds24) ────────────────────
function UnitDetail({ unitId, lang }: { unitId: number; lang: string }) {
  const isRtl = lang === "ar";
  const [editOpen, setEditOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.finance.units.financeDetails.useQuery(
    { unitId },
    { enabled: unitId > 0 }
  );
  const archiveMutation = trpc.finance.units.archive.useMutation();
  const restoreMutation = trpc.finance.units.restore.useMutation();

  const handleUpdated = useCallback(() => {
    setEditOpen(false);
    utils.finance.units.financeDetails.invalidate({ unitId });
  }, [utils, unitId]);

  const handleArchive = async () => {
    try {
      const result = await archiveMutation.mutateAsync({ id: unitId });
      if (result.success) {
        toast.success(isRtl ? "تم أرشفة الوحدة" : "Unit archived");
      } else {
        toast.error(result.reason || "Cannot archive");
      }
      utils.finance.units.financeDetails.invalidate({ unitId });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreMutation.mutateAsync({ id: unitId });
      toast.success(isRtl ? "تم استعادة الوحدة" : "Unit restored");
      utils.finance.units.financeDetails.invalidate({ unitId });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      <Skeleton className="h-64" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-16 text-muted-foreground">
      <Home className="h-12 w-12 mx-auto mb-4 opacity-30" />
      <p>{isRtl ? "الوحدة غير موجودة" : "Unit not found"}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with CRUD actions */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 hover:bg-primary/10"
            onClick={() => window.history.back()}>
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-heading font-bold flex items-center gap-3">
                {data.unit.coverImageUrl ? (
                  <img
                    src={normalizeImageUrl(data.unit.coverImageUrl)}
                    alt={`Unit ${data.unit.unitNumber}`}
                    className="w-14 h-12 rounded-xl object-cover border border-border/30"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = BROKEN_IMAGE_PLACEHOLDER; }}
                  />
                ) : (
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                )}
                {isRtl ? `وحدة ${data.unit.unitNumber}` : `Unit ${data.unit.unitNumber}`}
              </h1>
              {data.unit.isArchived && <Badge variant="secondary">{isRtl ? "مؤرشف" : "Archived"}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {isRtl ? data.unit.buildingNameAr || data.unit.buildingName : data.unit.buildingName}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />{isRtl ? "تعديل" : "Edit"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isRtl ? "تعديل الوحدة" : "Edit Unit"}</DialogTitle>
                <DialogDescription>{isRtl ? "عدّل بيانات الوحدة" : "Update unit details"}</DialogDescription>
              </DialogHeader>
              <UnitForm unit={data.unit} buildingId={data.unit.buildingId} lang={lang} onSuccess={handleUpdated} onCancel={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
          {data.unit.isArchived ? (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw className="h-4 w-4 mr-1" />{isRtl ? "استعادة" : "Restore"}
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Archive className="h-4 w-4 mr-1" />{isRtl ? "أرشفة" : "Archive"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isRtl ? "أرشفة الوحدة؟" : "Archive Unit?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isRtl ? "سيتم أرشفة الوحدة. لا يمكن أرشفتها إذا كانت مرتبطة بحجوزات نشطة أو فواتير معلقة." : "The unit will be archived. Cannot archive if linked to active bookings or outstanding invoices."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isRtl ? "أرشفة" : "Archive"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Unit Details + Finance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unit Info Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {isRtl ? "تفاصيل الوحدة" : "Unit Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">{isRtl ? "رقم الوحدة:" : "Unit #:"}</span>
              <span className="font-mono font-medium">{data.unit.unitNumber}</span>
              <span className="text-muted-foreground">{isRtl ? "الطابق:" : "Floor:"}</span>
              <span>{data.unit.floor || "—"}</span>
              <span className="text-muted-foreground">{isRtl ? "الحالة:" : "Status:"}</span>
              <Badge variant={data.unit.unitStatus === "AVAILABLE" ? "secondary" : data.unit.unitStatus === "BLOCKED" ? "outline" : "destructive"} className="w-fit text-xs">
                {data.unit.unitStatus === "AVAILABLE" ? (isRtl ? "متاح" : "Available")
                  : data.unit.unitStatus === "BLOCKED" ? (isRtl ? "محجوب" : "Blocked")
                  : data.unit.unitStatus === "MAINTENANCE" ? (isRtl ? "صيانة" : "Maintenance")
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
              {isRtl ? "ملخص مالي" : "Finance Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">{isRtl ? "الإيجار الشهري:" : "Monthly Rent:"}</span>
              <span className="font-semibold">
                {data.unit.monthlyBaseRentSAR ? `${parseFloat(data.unit.monthlyBaseRentSAR).toLocaleString()} SAR` : "—"}
              </span>
              <span className="text-muted-foreground">{isRtl ? "الرصيد المعلق:" : "Outstanding:"}</span>
              <span className={`font-semibold ${data.outstandingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {data.outstandingBalance.toLocaleString()} SAR
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Beds24 Mapping Section */}
      <Beds24MappingSection unitId={unitId} lang={lang} />

      {/* Occupancy Timeline */}
      {data.occupancyTimeline?.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {isRtl ? "جدول الإشغال (آخر 90 يوم)" : "Occupancy Timeline (Last 90 Days)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {data.occupancyTimeline.map((day: any, i: number) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm ${day.occupied ? "bg-primary" : day.source === "UNKNOWN" ? "bg-amber-300" : "bg-muted"}`}
                  title={`${day.date}: ${day.occupied ? (isRtl ? "مشغول" : "Occupied") : day.source === "UNKNOWN" ? (isRtl ? "غير معروف" : "Unknown") : (isRtl ? "متاح" : "Available")} (${day.source})`}
                />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-primary" /> {isRtl ? "مشغول" : "Occupied"}</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted" /> {isRtl ? "متاح" : "Available"}</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-300" /> {isRtl ? "غير معروف" : "Unknown"}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Ledger */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {isRtl ? "سجل المدفوعات" : "Payment Ledger"}
            {data.ledger?.length > 0 && (
              <Badge variant="secondary" className="text-xs">{data.ledger.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data.ledger?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{isRtl ? "لا توجد سجلات" : "No records"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-medium">{isRtl ? "التاريخ" : "Date"}</th>
                    <th className="px-4 py-3 text-start font-medium">{isRtl ? "الفاتورة" : "Invoice"}</th>
                    <th className="px-4 py-3 text-start font-medium">{isRtl ? "النوع" : "Type"}</th>
                    <th className="px-4 py-3 text-end font-medium">{isRtl ? "المبلغ" : "Amount"}</th>
                    <th className="px-4 py-3 text-center font-medium">{isRtl ? "الحالة" : "Status"}</th>
                    <th className="px-4 py-3 text-start font-medium">{isRtl ? "الطريقة" : "Method"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.map((entry: any) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString(isRtl ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
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
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function AdminUnitFinance() {
  const { lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const isRtl = lang === "ar";
  const [, params] = useRoute("/admin/units/:id");
  const unitId = params?.id === "new" ? 0 : (params?.id ? parseInt(params.id) : 0);
  const isNew = params?.id === "new";

  // Get buildingId from URL search params for new unit
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const buildingIdParam = parseInt(searchParams.get("buildingId") || "0");

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
<div className="container py-20 text-center">
          <p className="text-muted-foreground mb-4">{isRtl ? "يجب تسجيل الدخول كمسؤول" : "Admin access required"}</p>
          <a href={getLoginUrl()}><Button>{isRtl ? "تسجيل الدخول" : "Login"}</Button></a>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background">
      <SEOHead title={isNew ? "New Unit" : "Unit Finance"} titleAr={isNew ? "وحدة جديدة" : "مالية الوحدة"} path="/admin/units" noindex />
<div className="container py-8 flex-1 max-w-6xl">
        {isNew && buildingIdParam ? (
          <NewUnit buildingId={buildingIdParam} lang={lang} />
        ) : unitId ? (
          <UnitDetail unitId={unitId} lang={lang} />
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Home className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{isRtl ? "اختر وحدة من صفحة المبنى" : "Select a unit from the building page"}</p>
            <Link href="/admin/buildings">
              <Button variant="outline" className="mt-4">{isRtl ? "عرض المباني" : "View Buildings"}</Button>
            </Link>
          </div>
        )}
      </div>
</div>
    </DashboardLayout>
  );
}
