import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { normalizeImageUrl, BROKEN_IMAGE_PLACEHOLDER } from "@/lib/image-utils";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Search, Loader2, ImagePlus, X, Eye, Pencil, Trash2,
  Building2, MapPin, BedDouble, Bath, Ruler, ChevronLeft, ChevronRight
} from "lucide-react";

// Thumbnail using CSS background-image to avoid img onError issues
function AdminPropertyThumbnail({ coverImageUrl, photos }: { coverImageUrl?: string; photos?: string[] | null }) {
  const imgUrl = coverImageUrl || (Array.isArray(photos) && photos.length > 0 ? normalizeImageUrl(photos[0]) : "");

  if (!imgUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Building2 className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full bg-cover bg-center bg-muted"
      style={{ backgroundImage: `url(${imgUrl})` }}
    />
  );
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  pending: "bg-amber-500/10 text-amber-600 border-amber-200",
  draft: "bg-slate-500/10 text-slate-600 border-slate-200",
  inactive: "bg-red-500/10 text-red-600 border-red-200",
  rejected: "bg-red-500/10 text-red-600 border-red-200",
};
const statusLabels: Record<string, string> = {
  active: "نشط", pending: "قيد المراجعة", draft: "مسودة", inactive: "غير نشط", rejected: "مرفوض",
};
const propertyTypeLabels: Record<string, string> = {
  apartment: "شقة", villa: "فيلا", studio: "استوديو", duplex: "دوبلكس",
  furnished_room: "غرفة مفروشة", compound: "مجمع سكني", hotel_apartment: "شقة فندقية",
};

export default function AdminProperties() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.admin.properties.useQuery({
    limit: 20, offset: page * 20, status: statusFilter !== "all" ? statusFilter : undefined, search: search || undefined,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">إدارة العقارات</h1>
            <p className="text-muted-foreground text-sm mt-1">إنشاء وتعديل وإدارة العقارات</p>
          </div>
          <Button onClick={() => { setEditId(null); setShowCreate(true); }} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
            <Plus className="h-4 w-4 me-2" /> إضافة عقار جديد
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالعنوان أو المدينة..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="ps-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="pending">قيد المراجعة</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Properties List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : !data?.items?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">لا توجد عقارات</p>
              <Button variant="outline" className="mt-4" onClick={() => { setEditId(null); setShowCreate(true); }}>
                <Plus className="h-4 w-4 me-2" /> إضافة عقار
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.items.map((prop: any) => (
              <Card key={prop.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                      <AdminPropertyThumbnail
                        coverImageUrl={prop.coverImageUrl}
                        photos={prop.photos}
                      />
                      {/* DEBUG: show photo data status */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-white p-0.5 leading-tight">
                        c:{prop.coverImageUrl ? '✓' : '✗'} p:{Array.isArray(prop.photos) ? prop.photos.length : 'null'}
                      </div>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold truncate">{prop.titleAr || prop.titleEn}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{prop.cityAr || prop.city} - {prop.districtAr || prop.district}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={statusColors[prop.status] || ""}>
                          {statusLabels[prop.status] || prop.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {prop.bedrooms}</span>
                        <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {prop.bathrooms}</span>
                        <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {prop.sizeSqm} م²</span>
                        <span className="font-medium text-foreground">{prop.monthlyRent} ر.س/شهر</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => window.open(`/property/${prop.id}`, "_blank")}>
                          <Eye className="h-3.5 w-3.5 me-1" /> عرض
                        </Button>
                        <Link href={`/admin/properties/${prop.id}/edit`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-3.5 w-3.5 me-1" /> تعديل
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronRight className="h-4 w-4" /> السابق
            </Button>
            <span className="text-sm text-muted-foreground">
              صفحة {page + 1} من {Math.ceil(data.total / 20)}
            </span>
            <Button size="sm" variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(p => p + 1)}>
              التالي <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <PropertyFormDialog
          open={showCreate}
          onClose={() => { setShowCreate(false); setEditId(null); }}
          editId={editId}
          onSuccess={() => { refetch(); setShowCreate(false); setEditId(null); }}
        />
      </div>
    </DashboardLayout>
  );
}

function PropertyFormDialog({ open, onClose, editId, onSuccess }: {
  open: boolean; onClose: () => void; editId: number | null; onSuccess: () => void;
}) {
  const isEdit = editId !== null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    propertyType: "apartment" as const,
    status: "draft" as "draft" | "pending" | "active" | "inactive" | "rejected",
    city: "", cityAr: "", district: "", districtAr: "",
    address: "", addressAr: "",
    latitude: "", longitude: "",
    bedrooms: 1, bathrooms: 1, sizeSqm: 0,
    floor: 0, totalFloors: 0, yearBuilt: 2024,
    furnishedLevel: "unfurnished" as "unfurnished" | "semi_furnished" | "fully_furnished",
    monthlyRent: "", securityDeposit: "",
    amenities: [] as string[], utilitiesIncluded: [] as string[],
    houseRules: "", houseRulesAr: "",
    minStayMonths: 1, maxStayMonths: 12,
    instantBook: false,
    photos: [] as string[],
    videoUrl: "",
  });

  // Load property data for edit
  const { data: editData } = trpc.submission.adminGetProperty.useQuery(
    { id: editId! },
    { enabled: isEdit && open }
  );

  // Populate form when edit data loads
  const [populated, setPopulated] = useState(false);
  if (isEdit && editData && !populated) {
    setForm({
      titleEn: editData.titleEn || "", titleAr: editData.titleAr || "",
      descriptionEn: editData.descriptionEn || "", descriptionAr: editData.descriptionAr || "",
      propertyType: editData.propertyType || "apartment",
      status: editData.status || "draft",
      city: editData.city || "", cityAr: editData.cityAr || "",
      district: editData.district || "", districtAr: editData.districtAr || "",
      address: editData.address || "", addressAr: editData.addressAr || "",
      latitude: editData.latitude || "", longitude: editData.longitude || "",
      bedrooms: editData.bedrooms || 1, bathrooms: editData.bathrooms || 1,
      sizeSqm: editData.sizeSqm || 0,
      floor: editData.floor || 0, totalFloors: editData.totalFloors || 0,
      yearBuilt: editData.yearBuilt || 2024,
      furnishedLevel: editData.furnishedLevel || "unfurnished",
      monthlyRent: editData.monthlyRent || "", securityDeposit: editData.securityDeposit || "",
      amenities: editData.amenities || [], utilitiesIncluded: editData.utilitiesIncluded || [],
      houseRules: editData.houseRules || "", houseRulesAr: editData.houseRulesAr || "",
      minStayMonths: editData.minStayMonths || 1, maxStayMonths: editData.maxStayMonths || 12,
      instantBook: editData.instantBook || false,
      photos: editData.photos || [],
      videoUrl: editData.videoUrl || "",
    });
    setPopulated(true);
  }

  const uploadPhoto = trpc.submission.adminUploadPropertyPhoto.useMutation();
  const createProperty = trpc.submission.adminCreateProperty.useMutation();
  const updateProperty = trpc.submission.adminUpdateProperty.useMutation();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        const result = await uploadPhoto.mutateAsync({ base64, filename: file.name, contentType: file.type });
        setForm(prev => ({ ...prev, photos: [...prev.photos, result.url] }));
      }
      toast.success("تم رفع الصور بنجاح");
    } catch {
      toast.error("فشل رفع الصورة");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (!form.titleAr || !form.monthlyRent) {
      toast.error("يرجى ملء العنوان والإيجار الشهري على الأقل");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateProperty.mutateAsync({ id: editId!, ...form });
        toast.success("تم تحديث العقار بنجاح");
      } else {
        await createProperty.mutateAsync(form);
        toast.success("تم إنشاء العقار بنجاح");
      }
      onSuccess();
      // Reset
      setPopulated(false);
      setForm({
        titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
        propertyType: "apartment", status: "draft",
        city: "", cityAr: "", district: "", districtAr: "",
        address: "", addressAr: "", latitude: "", longitude: "",
        bedrooms: 1, bathrooms: 1, sizeSqm: 0, floor: 0, totalFloors: 0, yearBuilt: 2024,
        furnishedLevel: "unfurnished", monthlyRent: "", securityDeposit: "",
        amenities: [], utilitiesIncluded: [], houseRules: "", houseRulesAr: "",
        minStayMonths: 1, maxStayMonths: 12, instantBook: false, photos: [], videoUrl: "",
      });
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ");
    }
    setSaving(false);
  };

  const handleClose = () => {
    setPopulated(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل العقار" : "إضافة عقار جديد"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "قم بتعديل بيانات العقار" : "أدخل بيانات العقار الجديد"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">المعلومات الأساسية</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>العنوان (عربي) *</Label><Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} placeholder="شقة فاخرة..." dir="rtl" /></div>
              <div><Label>Title (English) *</Label><Input value={form.titleEn} onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))} placeholder="Luxury apartment..." dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الوصف (عربي)</Label><Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={3} dir="rtl" /></div>
              <div><Label>Description (English)</Label><Textarea value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} rows={3} dir="ltr" /></div>
            </div>
          </div>

          {/* Type & Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>نوع العقار</Label>
              <Select value={form.propertyType} onValueChange={v => setForm(p => ({ ...p, propertyType: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(propertyTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>التأثيث</Label>
              <Select value={form.furnishedLevel} onValueChange={v => setForm(p => ({ ...p, furnishedLevel: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unfurnished">غير مفروش</SelectItem>
                  <SelectItem value="semi_furnished">مفروش جزئياً</SelectItem>
                  <SelectItem value="fully_furnished">مفروش بالكامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">الموقع</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>المدينة (عربي)</Label><Input value={form.cityAr} onChange={e => setForm(p => ({ ...p, cityAr: e.target.value }))} dir="rtl" /></div>
              <div><Label>City (English)</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الحي (عربي)</Label><Input value={form.districtAr} onChange={e => setForm(p => ({ ...p, districtAr: e.target.value }))} dir="rtl" /></div>
              <div><Label>District (English)</Label><Input value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>العنوان (عربي)</Label><Input value={form.addressAr} onChange={e => setForm(p => ({ ...p, addressAr: e.target.value }))} dir="rtl" /></div>
              <div><Label>Address (English)</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} dir="ltr" /></div>
            </div>
          </div>

          {/* Specs */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">المواصفات</h3>
            <div className="grid grid-cols-4 gap-3">
              <div><Label>غرف النوم</Label><Input type="number" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: +e.target.value }))} min={0} /></div>
              <div><Label>الحمامات</Label><Input type="number" value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: +e.target.value }))} min={0} /></div>
              <div><Label>المساحة (م²)</Label><Input type="number" value={form.sizeSqm} onChange={e => setForm(p => ({ ...p, sizeSqm: +e.target.value }))} min={0} /></div>
              <div><Label>سنة البناء</Label><Input type="number" value={form.yearBuilt} onChange={e => setForm(p => ({ ...p, yearBuilt: +e.target.value }))} /></div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">التسعير</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الإيجار الشهري (ر.س) *</Label><Input value={form.monthlyRent} onChange={e => setForm(p => ({ ...p, monthlyRent: e.target.value }))} placeholder="3000" /></div>
              <div><Label>مبلغ التأمين (ر.س)</Label><Input value={form.securityDeposit} onChange={e => setForm(p => ({ ...p, securityDeposit: e.target.value }))} placeholder="3000" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.instantBook} onCheckedChange={v => setForm(p => ({ ...p, instantBook: v }))} />
              <Label>حجز فوري</Label>
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">الصور</h3>
            <div className="flex flex-wrap gap-3">
              {form.photos.map((url, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border group">
                  <img src={normalizeImageUrl(url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = BROKEN_IMAGE_PLACEHOLDER; }} />
                  <button onClick={() => removePhoto(i)} className="absolute top-1 end-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-[#3ECFC0] hover:text-[#3ECFC0] transition-colors"
              >
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                <span className="text-xs mt-1">{uploading ? "جاري..." : "رفع"}</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {isEdit ? "حفظ التعديلات" : "إنشاء العقار"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
