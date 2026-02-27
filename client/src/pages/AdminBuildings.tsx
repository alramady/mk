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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Building2, ArrowLeft, Loader2, TrendingUp, Users, CreditCard,
  AlertTriangle, Home, ChevronRight, BarChart3, DollarSign, Percent,
  Wifi, Calendar, Link2, Plus, Pencil, Archive, RotateCcw, Eye
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { getLoginUrl } from "@/const";
import { useState, useCallback } from "react";
import { toast } from "sonner";

// ─── Google Maps URL Parser ─────────────────────────────────────────
function parseGoogleMapsUrl(url: string): { lat: string; lng: string } | null {
  try {
    // Pattern 1: @lat,lng in URL
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { lat: atMatch[1], lng: atMatch[2] };
    // Pattern 2: ?q=lat,lng or place/lat,lng
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) return { lat: qMatch[1], lng: qMatch[2] };
    // Pattern 3: /place/.../@lat,lng
    const placeMatch = url.match(/\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (placeMatch) return { lat: placeMatch[1], lng: placeMatch[2] };
    // Pattern 4: ll=lat,lng
    const llMatch = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llMatch) return { lat: llMatch[1], lng: llMatch[2] };
    // Pattern 5: Plus code like MPQ8+78H → won't have coords, skip
    return null;
  } catch { return null; }
}

// ─── Building Form (Create/Edit) ────────────────────────────────────
function BuildingForm({ building, onSuccess, onCancel, lang }: {
  building?: any; onSuccess: () => void; onCancel: () => void; lang: string;
}) {
  const isRtl = lang === "ar";
  const isEdit = !!building;
  const [form, setForm] = useState({
    buildingName: building?.buildingName || "",
    buildingNameAr: building?.buildingNameAr || "",
    address: building?.address || "",
    addressAr: building?.addressAr || "",
    city: building?.city || "",
    cityAr: building?.cityAr || "",
    district: building?.district || "",
    districtAr: building?.districtAr || "",
    latitude: building?.latitude || "",
    longitude: building?.longitude || "",
    notes: building?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [mapsUrl, setMapsUrl] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const createMutation = trpc.finance.buildings.create.useMutation();
  const updateMutation = trpc.finance.buildings.update.useMutation();
  const geocodeMutation = trpc.finance.geocode.reverse.useQuery(
    { lat: form.latitude, lng: form.longitude },
    { enabled: false }
  );

  // Handle Google Maps URL paste
  const handleMapsUrlPaste = useCallback(async (url: string) => {
    setMapsUrl(url);
    const coords = parseGoogleMapsUrl(url);
    if (!coords) {
      toast.error(isRtl ? "لم يتم التعرف على الإحداثيات من الرابط" : "Could not extract coordinates from URL");
      return;
    }
    setGeocoding(true);
    setForm(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }));
    try {
      const res = await fetch(`/api/trpc/finance.geocode.reverse?input=${encodeURIComponent(JSON.stringify({ lat: coords.lat, lng: coords.lng }))}`, {
        credentials: "include",
      });
      const data = await res.json();
      const result = data?.result?.data;
      if (result) {
        setForm(prev => ({
          ...prev,
          city: result.city || prev.city,
          cityAr: result.cityAr || prev.cityAr,
          district: result.district || prev.district,
          districtAr: result.districtAr || prev.districtAr,
          address: result.address || prev.address,
          addressAr: result.addressAr || prev.addressAr,
          latitude: result.latitude || prev.latitude,
          longitude: result.longitude || prev.longitude,
        }));
        toast.success(isRtl ? "تم تعبئة العنوان تلقائياً من الخريطة" : "Address auto-filled from map");
      }
    } catch (err) {
      toast.error(isRtl ? "فشل في جلب بيانات العنوان" : "Failed to fetch address data");
    } finally {
      setGeocoding(false);
    }
  }, [isRtl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.buildingName.trim()) {
      toast.error(isRtl ? "اسم المبنى مطلوب" : "Building name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: building.id, ...form });
        toast.success(isRtl ? "تم تحديث المبنى" : "Building updated");
      } else {
        await createMutation.mutateAsync(form);
        toast.success(isRtl ? "تم إنشاء المبنى" : "Building created");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Google Maps URL - Auto-fill */}
      <div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
        <Label className="flex items-center gap-2 text-primary font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          {isRtl ? "رابط خرائط قوقل (لصق تلقائي)" : "Google Maps URL (auto-fill)"}
        </Label>
        <div className="flex gap-2">
          <Input
            value={mapsUrl}
            onChange={e => setMapsUrl(e.target.value)}
            onPaste={e => {
              const pasted = e.clipboardData.getData("text");
              if (pasted.includes("google") || pasted.includes("maps") || pasted.includes("goo.gl")) {
                e.preventDefault();
                handleMapsUrlPaste(pasted);
              }
            }}
            placeholder={isRtl ? "الصق رابط خرائط قوقل هنا..." : "Paste Google Maps URL here..."}
            className="flex-1"
            dir="ltr"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={geocoding || !mapsUrl}
            onClick={() => handleMapsUrlPaste(mapsUrl)}
          >
            {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRtl ? "تعبئة" : "Fill")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isRtl
            ? "الصق رابط خرائط قوقل وسيتم تعبئة المدينة والحي والعنوان والإحداثيات تلقائياً بالعربي والإنجليزي"
            : "Paste a Google Maps link to auto-fill city, district, address & coordinates in both Arabic & English"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isRtl ? "اسم المبنى" : "Building Name"} *</Label>
          <Input value={form.buildingName} onChange={e => set("buildingName", e.target.value)} required placeholder={isRtl ? "مثال: برج السلام" : "e.g. Al Salam Tower"} />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "اسم المبنى بالعربي" : "Building Name (Arabic)"}</Label>
          <Input value={form.buildingNameAr} onChange={e => set("buildingNameAr", e.target.value)} dir="rtl" placeholder="برج السلام" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "المدينة" : "City"}</Label>
          <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Riyadh" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "المدينة بالعربي" : "City (Arabic)"}</Label>
          <Input value={form.cityAr} onChange={e => set("cityAr", e.target.value)} dir="rtl" placeholder="الرياض" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "الحي" : "District"}</Label>
          <Input value={form.district} onChange={e => set("district", e.target.value)} placeholder="Al Olaya" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "الحي بالعربي" : "District (Arabic)"}</Label>
          <Input value={form.districtAr} onChange={e => set("districtAr", e.target.value)} dir="rtl" placeholder="العليا" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "العنوان" : "Address"}</Label>
          <Input value={form.address} onChange={e => set("address", e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "العنوان بالعربي" : "Address (Arabic)"}</Label>
          <Input value={form.addressAr} onChange={e => set("addressAr", e.target.value)} dir="rtl" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "خط العرض" : "Latitude"}</Label>
          <Input value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="24.7136" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label>{isRtl ? "خط الطول" : "Longitude"}</Label>
          <Input value={form.longitude} onChange={e => set("longitude", e.target.value)} placeholder="46.6753" dir="ltr" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{isRtl ? "ملاحظات" : "Notes"}</Label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
      </div>
      <div className={`flex gap-3 ${isRtl ? "justify-start" : "justify-end"}`}>
        <Button type="button" variant="outline" onClick={onCancel}>{isRtl ? "إلغاء" : "Cancel"}</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className={`h-4 w-4 animate-spin ${isRtl ? "ml-2" : "mr-2"}`} />}
          {isEdit ? (isRtl ? "حفظ التعديلات" : "Save Changes") : (isRtl ? "إنشاء المبنى" : "Create Building")}
        </Button>
      </div>
    </form>
  );
}

// ─── Building List View ─────────────────────────────────────────────
function BuildingList({ lang }: { lang: string }) {
  const isRtl = lang === "ar";
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.finance.buildings.list.useQuery({ includeArchived: showArchived });

  const handleCreated = useCallback(() => {
    setCreateOpen(false);
    utils.finance.buildings.list.invalidate();
  }, [utils]);

  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant={showArchived ? "secondary" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
          <Archive className="h-4 w-4 mr-1" />
          {isRtl ? "عرض المؤرشفة" : "Show Archived"}
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />{isRtl ? "إضافة مبنى" : "Add Building"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isRtl ? "إنشاء مبنى جديد" : "Create New Building"}</DialogTitle>
              <DialogDescription>{isRtl ? "أدخل بيانات المبنى" : "Enter building details"}</DialogDescription>
            </DialogHeader>
            <BuildingForm lang={lang} onSuccess={handleCreated} onCancel={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {!data?.items?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{isRtl ? "لا توجد مباني مسجلة" : "No buildings registered"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((b: any) => (
            <Link key={b.id} href={`/admin/buildings/${b.id}`}>
              <Card className={`cursor-pointer hover:shadow-md transition-shadow border-border/50 group ${b.isArchived ? "opacity-60" : ""}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{isRtl ? b.buildingNameAr || b.buildingName : b.buildingName}</h3>
                        <p className="text-xs text-muted-foreground">
                          {isRtl ? b.cityAr || b.city : b.city}
                          {b.district ? ` - ${isRtl ? b.districtAr || b.district : b.district}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {b.isArchived && <Badge variant="secondary" className="text-xs">{isRtl ? "مؤرشف" : "Archived"}</Badge>}
                      <ChevronRight className={`h-4 w-4 text-muted-foreground ${isRtl ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Home className="h-3.5 w-3.5" />
                      <span>{b.totalUnits || 0} {isRtl ? "وحدة" : "units"}</span>
                    </div>
                    <Badge variant={b.isActive ? "default" : "secondary"} className="text-xs w-fit">
                      {b.isActive ? (isRtl ? "نشط" : "Active") : (isRtl ? "غير نشط" : "Inactive")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Building Detail View ───────────────────────────────────────────
function BuildingDetail({ buildingId, lang }: { buildingId: number; lang: string }) {
  const isRtl = lang === "ar";
  const [editOpen, setEditOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: building, isLoading: loadingBuilding } = trpc.finance.buildings.getById.useQuery({ id: buildingId });
  const { data: kpis, isLoading: loadingKpis } = trpc.finance.buildings.kpis.useQuery({ buildingId });
  const { data: units, isLoading: loadingUnits } = trpc.finance.buildings.unitsWithFinance.useQuery({ buildingId });
  const archiveMutation = trpc.finance.buildings.archive.useMutation();
  const restoreMutation = trpc.finance.buildings.restore.useMutation();

  const handleUpdated = useCallback(() => {
    setEditOpen(false);
    utils.finance.buildings.getById.invalidate({ id: buildingId });
    utils.finance.buildings.list.invalidate();
  }, [utils, buildingId]);

  const handleArchive = async () => {
    try {
      const result = await archiveMutation.mutateAsync({ id: buildingId });
      if (result.success) {
        toast.success(isRtl ? "تم أرشفة المبنى" : "Building archived");
      } else {
        toast.error(result.reason || "Cannot archive");
      }
      utils.finance.buildings.getById.invalidate({ id: buildingId });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreMutation.mutateAsync({ id: buildingId });
      toast.success(isRtl ? "تم استعادة المبنى" : "Building restored");
      utils.finance.buildings.getById.invalidate({ id: buildingId });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loadingBuilding || loadingKpis) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );

  if (!building) return (
    <div className="text-center py-16 text-muted-foreground">
      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
      <p>{isRtl ? "المبنى غير موجود" : "Building not found"}</p>
    </div>
  );

  const kpiCards = kpis ? [
    { icon: Home, label: isRtl ? "إجمالي الوحدات" : "Total Units", value: `${kpis.totalUnits} (${kpis.availableUnits} ${isRtl ? "متاح" : "avail"})`, color: "text-blue-600" },
    { icon: Percent, label: isRtl ? "نسبة الإشغال" : "Occupancy Rate", value: `${kpis.occupancyRate}%${kpis.unknownUnits > 0 ? ` (${kpis.unknownUnits} ?)` : ""}`, color: "text-primary" },
    { icon: DollarSign, label: isRtl ? "المحصل هذا الشهر" : "Collected MTD", value: `${kpis.collectedMTD.toLocaleString()} SAR`, color: "text-emerald-600" },
    { icon: AlertTriangle, label: isRtl ? "الرصيد المعلق" : "Outstanding", value: `${kpis.outstandingBalance.toLocaleString()} SAR`, color: "text-amber-600" },
    { icon: DollarSign, label: isRtl ? "الإيجار السنوي المحتمل" : "PAR", value: `${kpis.potentialAnnualRent.toLocaleString()} SAR`, color: "text-blue-600" },
    { icon: TrendingUp, label: isRtl ? "الإيجار السنوي الفعلي" : "EAR", value: `${kpis.effectiveAnnualRent.toLocaleString()} SAR`, color: "text-purple-600" },
    { icon: BarChart3, label: isRtl ? "معدل سنوي" : "Run-Rate", value: `${kpis.annualizedRunRate.toLocaleString()} SAR`, color: "text-blue-600" },
    { icon: TrendingUp, label: isRtl ? "العائد لكل وحدة" : "RevPAU", value: `${kpis.revPAU.toLocaleString()} SAR`, color: "text-purple-600" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/admin/buildings">
            <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 hover:bg-primary/10">
              <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-heading font-bold">{isRtl ? building.buildingNameAr || building.buildingName : building.buildingName}</h2>
              {building.isArchived && <Badge variant="secondary">{isRtl ? "مؤرشف" : "Archived"}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {isRtl ? building.cityAr || building.city : building.city}
              {building.district ? ` - ${isRtl ? building.districtAr || building.district : building.district}` : ""}
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
                <DialogTitle>{isRtl ? "تعديل المبنى" : "Edit Building"}</DialogTitle>
                <DialogDescription>{isRtl ? "عدّل بيانات المبنى" : "Update building details"}</DialogDescription>
              </DialogHeader>
              <BuildingForm building={building} lang={lang} onSuccess={handleUpdated} onCancel={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
          {building.isArchived ? (
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
                  <AlertDialogTitle>{isRtl ? "أرشفة المبنى؟" : "Archive Building?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isRtl
                      ? "سيتم أرشفة المبنى. يجب أرشفة جميع الوحدات أولاً. يمكن استعادته لاحقاً."
                      : "The building will be archived. All units must be archived first. It can be restored later."}
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

      {/* KPI Cards */}
      {kpiCards.length > 0 && (
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
      )}

      {/* Units Table */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">{isRtl ? "الوحدات" : "Units"} ({units?.length || 0})</CardTitle>
          <Link href={`/admin/units/new?buildingId=${buildingId}`}>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />{isRtl ? "إضافة وحدة" : "Add Unit"}</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUnits ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !units?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <Home className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>{isRtl ? "لا توجد وحدات" : "No units yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-medium">{isRtl ? "الوحدة" : "Unit"}</th>
                    <th className="px-4 py-3 text-start font-medium">{isRtl ? "الطابق" : "Floor"}</th>
                    <th className="px-4 py-3 text-center font-medium">{isRtl ? "الحالة" : "Status"}</th>
                    <th className="px-4 py-3 text-end font-medium">{isRtl ? "الإيجار" : "Rent"}</th>
                    <th className="px-4 py-3 text-end font-medium">{isRtl ? "محصل MTD" : "Collected MTD"}</th>
                    <th className="px-4 py-3 text-center font-medium">{isRtl ? "متأخر" : "Overdue"}</th>
                    <th className="px-4 py-3 text-center font-medium">Beds24</th>
                    <th className="px-4 py-3 text-center font-medium">{isRtl ? "تفاصيل" : "Details"}</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u: any) => (
                    <tr key={u.id} className={`border-b hover:bg-muted/30 transition-colors ${u.isArchived ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-mono font-medium">
                        {u.unitNumber}
                        {u.isArchived && <Badge variant="secondary" className="text-xs ml-2">{isRtl ? "مؤرشف" : "Archived"}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.floor || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={u.unitStatus === "AVAILABLE" ? "secondary" : u.unitStatus === "BLOCKED" ? "outline" : "destructive"} className="text-xs">
                          {u.unitStatus === "AVAILABLE" ? (isRtl ? "متاح" : "Available")
                            : u.unitStatus === "BLOCKED" ? (isRtl ? "محجوب" : "Blocked")
                            : u.unitStatus === "MAINTENANCE" ? (isRtl ? "صيانة" : "Maintenance")
                            : u.unitStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-end font-mono">{u.monthlyBaseRentSAR ? `${parseFloat(u.monthlyBaseRentSAR).toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-end font-mono">{parseFloat(u.collectedMTD || "0").toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {u.overdueCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">{u.overdueCount}</Badge>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.beds24ConnectionType ? (
                          <Badge variant="outline" className={`text-xs gap-1 ${u.beds24ConnectionType === 'API' ? 'border-blue-300 text-blue-600' : 'border-amber-300 text-amber-600'}`}>
                            {u.beds24ConnectionType === 'API' ? <Wifi className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                            {u.beds24ConnectionType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">{isRtl ? "محلي" : "Local"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/admin/units/${u.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <Eye className="h-3.5 w-3.5" />
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
          <p className="text-muted-foreground mb-4">{isRtl ? "يجب تسجيل الدخول كمسؤول" : "Admin access required"}</p>
          <a href={getLoginUrl()}><Button>{isRtl ? "تسجيل الدخول" : "Login"}</Button></a>
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
                  {isRtl ? "إدارة المباني" : "Buildings Management"}
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
