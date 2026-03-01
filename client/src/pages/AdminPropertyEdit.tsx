import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeImageUrl, BROKEN_IMAGE_PLACEHOLDER } from "@/lib/image-utils";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowRight, Save, Eye, EyeOff, Upload, X, Star, GripVertical,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Globe, Archive, MapPin,
  ExternalLink, Link2, Unlink, Navigation, Crosshair, Shield, Map
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PinPickerMap from "@/components/PinPickerMap";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  published: "منشور",
  archived: "مؤرشف",
  active: "نشط",
  inactive: "غير نشط",
  rejected: "مرفوض",
};

// ─── Sortable Photo Item ─────────────────────────────────────────────
function SortablePhoto({ id, url, index, onRemove, onSetCover }: {
  id: string; url: string; index: number;
  onRemove: () => void; onSetCover: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-lg overflow-hidden border aspect-square">
      <img src={normalizeImageUrl(url)} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = BROKEN_IMAGE_PLACEHOLDER; }} />
      {/* Drag handle */}
      <div
        {...attributes} {...listeners}
        className="absolute top-1 left-1 p-1 bg-black/50 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-white" />
      </div>
      {/* Cover badge */}
      {index === 0 && (
        <div className="absolute top-1 right-1">
          <Badge className="bg-amber-500 text-white text-xs gap-1">
            <Star className="h-3 w-3" /> غلاف
          </Badge>
        </div>
      )}
      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {index !== 0 && (
          <Button size="sm" variant="secondary" onClick={onSetCover} title="تعيين كغلاف">
            <Star className="h-3 w-3" />
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={onRemove} title="حذف">
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function AdminPropertyEdit() {
  const [, params] = useRoute("/admin/properties/:id/edit");
  const [, navigate] = useLocation();

  const isNew = params?.id === "new";
  const propertyId = isNew ? null : Number(params?.id);

  // Form state
  const [form, setForm] = useState({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    propertyType: "apartment" as string,
    city: "", cityAr: "", district: "", districtAr: "",
    address: "", addressAr: "",
    googleMapsUrl: "",
    latitude: "", longitude: "",
    locationSource: "" as string,
    locationVisibility: "APPROXIMATE" as string,
    placeId: "",
    geocodeProvider: "",
    bedrooms: 1, bathrooms: 1, sizeSqm: 0,
    monthlyRent: "", securityDeposit: "",
    pricingSource: "PROPERTY" as string,
    amenities: [] as string[],
    utilitiesIncluded: [] as string[],
    minStayMonths: 1, maxStayMonths: 12,
    photos: [] as string[],
  });

  const [geocoding, setGeocoding] = useState(false);
  const [showPinPicker, setShowPinPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkedUnitId, setLinkedUnitId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable photo IDs for dnd-kit (keyed by URL)
  const photoIds = useMemo(() => form.photos.map((url, i) => `photo-${i}-${url.slice(-20)}`), [form.photos]);

  // Sensors for drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Fetch property data if editing
  const { data: property, isLoading } = trpc.property.getById.useQuery(
    { id: propertyId! },
    { enabled: !!propertyId }
  );

  // Publish readiness
  const { data: readiness, refetch: refetchReadiness } = trpc.admin.publishReadiness.useQuery(
    { id: propertyId! },
    { enabled: !!propertyId }
  );

  // Available units for linking
  const { data: availableUnits } = trpc.finance.units.availableForLinking.useQuery(
    { propertyId: propertyId ?? undefined },
    { enabled: form.pricingSource === "UNIT" }
  );

  const utils = trpc.useUtils();

  // Mutations
  const adminCreate = trpc.admin.adminCreate.useMutation({
    onSuccess: (data) => {
      toast.success("تم إنشاء العقار كمسودة");
      navigate(`/admin/properties/${data.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });

  const adminUpdate = trpc.admin.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ التغييرات");
      utils.property.getById.invalidate({ id: propertyId! });
      refetchReadiness();
    },
    onError: (e) => toast.error(e.message),
  });

  const publishMutation = trpc.admin.publishProperty.useMutation({
    onSuccess: () => {
      toast.success("العقار الآن مرئي على الموقع ✅");
      utils.property.getById.invalidate({ id: propertyId! });
      refetchReadiness();
    },
    onError: (e) => toast.error(e.message),
  });

  const unpublishMutation = trpc.admin.unpublishProperty.useMutation({
    onSuccess: () => {
      toast.success("العقار الآن مسودة");
      utils.property.getById.invalidate({ id: propertyId! });
      refetchReadiness();
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = trpc.admin.archiveProperty.useMutation({
    onSuccess: () => {
      toast.success("العقار مؤرشف الآن");
      utils.property.getById.invalidate({ id: propertyId! });
      refetchReadiness();
    },
    onError: (e) => toast.error(e.message),
  });

  const linkUnitMutation = trpc.finance.units.linkToProperty.useMutation({
    onSuccess: () => {
      toast.success("تم ربط الوحدة بالعقار");
      utils.finance.units.availableForLinking.invalidate();
      refetchReadiness();
    },
    onError: (e) => toast.error(e.message),
  });

  // Photo upload
  const uploadPhoto = trpc.upload.propertyPhoto.useMutation();

  // Geocode mutation
  const geocodeMutation = trpc.maps.geocode.useMutation();

  // Load property data into form
  useEffect(() => {
    if (property) {
      setForm({
        titleEn: property.titleEn || "",
        titleAr: property.titleAr || "",
        descriptionEn: property.descriptionEn || "",
        descriptionAr: property.descriptionAr || "",
        propertyType: property.propertyType || "apartment",
        city: property.city || "",
        cityAr: property.cityAr || "",
        district: property.district || "",
        districtAr: property.districtAr || "",
        address: property.address || "",
        addressAr: property.addressAr || "",
        googleMapsUrl: (property as any).googleMapsUrl || "",
        latitude: property.latitude || "",
        longitude: property.longitude || "",
        locationSource: (property as any).locationSource || "",
        locationVisibility: (property as any).locationVisibility || "APPROXIMATE",
        placeId: (property as any).placeId || "",
        geocodeProvider: (property as any).geocodeProvider || "",
        bedrooms: property.bedrooms || 1,
        bathrooms: property.bathrooms || 1,
        sizeSqm: property.sizeSqm || 0,
        monthlyRent: property.monthlyRent || "",
        securityDeposit: property.securityDeposit || "",
        pricingSource: (property as any).pricingSource || "PROPERTY",
        amenities: (property.amenities as string[]) || [],
        utilitiesIncluded: (property.utilitiesIncluded as string[]) || [],
        minStayMonths: property.minStayMonths || 1,
        maxStayMonths: property.maxStayMonths || 12,
        photos: (property.photos as string[]) || [],
      });
    }
  }, [property]);

  // Find linked unit from available units
  useEffect(() => {
    if (availableUnits && propertyId) {
      const linked = (availableUnits as any[]).find((u: any) => u.propertyId === propertyId);
      setLinkedUnitId(linked?.id ?? null);
    }
  }, [availableUnits, propertyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sanitize enum fields: coerce empty/invalid strings to undefined so Zod .optional() accepts them
      const validLocationSources = ["MANUAL", "GEOCODE", "PIN"] as const;
      const validLocationVisibilities = ["EXACT", "APPROXIMATE", "HIDDEN"] as const;
      const sanitized = {
        ...form,
        pricingSource: (form.pricingSource || undefined) as "PROPERTY" | "UNIT" | undefined,
        locationSource: validLocationSources.includes(form.locationSource as any)
          ? (form.locationSource as "MANUAL" | "GEOCODE" | "PIN")
          : undefined,
        locationVisibility: validLocationVisibilities.includes(form.locationVisibility as any)
          ? (form.locationVisibility as "EXACT" | "APPROXIMATE" | "HIDDEN")
          : undefined,
        latitude: form.latitude || undefined,
        longitude: form.longitude || undefined,
        placeId: form.placeId || undefined,
        geocodeProvider: form.geocodeProvider || undefined,
      };
      if (isNew) {
        await adminCreate.mutateAsync(sanitized);
      } else {
        await adminUpdate.mutateAsync({
          id: propertyId!,
          ...sanitized,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishMutation.mutateAsync({ id: propertyId! });
    } finally {
      setPublishing(false);
    }
  };

  const handlePhotoUpload = useCallback(async (files: FileList) => {
    setUploading(true);
    const newPhotos = [...form.photos];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} أكبر من 5MB`);
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error(`${file.name} نوع غير مدعوم`);
        continue;
      }
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const result = await uploadPhoto.mutateAsync({
          propertyId: propertyId || 0,
          photo: base64,
          filename: file.name,
        });
        if (result.url) newPhotos.push(result.url);
      } catch (e: any) {
        toast.error(e.message);
      }
    }
    setForm(prev => ({ ...prev, photos: newPhotos }));
    setUploading(false);
  }, [form.photos, propertyId, uploadPhoto]);

  const removePhoto = (index: number) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const setCoverPhoto = (index: number) => {
    setForm(prev => {
      const photos = [...prev.photos];
      const [cover] = photos.splice(index, 1);
      photos.unshift(cover);
      return { ...prev, photos };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photoIds.indexOf(active.id as string);
    const newIndex = photoIds.indexOf(over.id as string);
    setForm(prev => ({ ...prev, photos: arrayMove(prev.photos, oldIndex, newIndex) }));
  };

  const handleLinkUnit = (unitId: number) => {
    if (!propertyId) return;
    linkUnitMutation.mutate({ unitId, propertyId });
    setLinkedUnitId(unitId);
  };

  const handleUnlinkUnit = () => {
    if (!linkedUnitId) return;
    linkUnitMutation.mutate({ unitId: linkedUnitId, propertyId: null as any });
    setLinkedUnitId(null);
  };

  if (isLoading && !isNew) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const currentStatus = property?.status || "draft";
  const linkedUnit = linkedUnitId ? (availableUnits as any[])?.find((u: any) => u.id === linkedUnitId) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">{isNew ? "إنشاء عقار جديد" : "تعديل العقار"}</h1>
            {!isNew && (
              <div className="flex items-center gap-2 mt-1">
                <Badge className={STATUS_COLORS[currentStatus]}>
                  {STATUS_LABELS[currentStatus] || currentStatus}
                </Badge>
                <span className="text-sm text-muted-foreground">#{propertyId}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Public Preview */}
            {!isNew && currentStatus === "published" && (
              <Button variant="outline" asChild>
                <a href={`/property/${propertyId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 ml-1" /> معاينة عامة
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/admin/properties")}>
              <ArrowRight className="h-4 w-4 ml-1" /> العودة
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
              حفظ
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>المعلومات الأساسية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>العنوان (عربي)</Label>
                    <Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Title (English)</Label>
                    <Input value={form.titleEn} onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الوصف (عربي)</Label>
                    <Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={3} />
                  </div>
                  <div>
                    <Label>Description (English)</Label>
                    <Textarea value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} rows={3} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>نوع العقار</Label>
                    <Select value={form.propertyType} onValueChange={v => setForm(p => ({ ...p, propertyType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apartment">شقة</SelectItem>
                        <SelectItem value="villa">فيلا</SelectItem>
                        <SelectItem value="studio">استوديو</SelectItem>
                        <SelectItem value="duplex">دوبلكس</SelectItem>
                        <SelectItem value="furnished_room">غرفة مفروشة</SelectItem>
                        <SelectItem value="compound">مجمع سكني</SelectItem>
                        <SelectItem value="hotel_apartment">شقة فندقية</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>مصدر التسعير</Label>
                    <Select value={form.pricingSource} onValueChange={v => setForm(p => ({ ...p, pricingSource: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROPERTY">تسعير العقار</SelectItem>
                        <SelectItem value="UNIT">تسعير الوحدة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Unit Linking (only when UNIT pricing) */}
            {form.pricingSource === "UNIT" && !isNew && (
              <Card className="border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-blue-500" />
                    ربط الوحدة
                  </CardTitle>
                  <CardDescription>
                    عند تسعير الوحدة، يجب ربط العقار بوحدة من المباني. السعر يأتي من الوحدة المرتبطة.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {linkedUnit ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div>
                        <p className="font-medium text-sm">
                          {linkedUnit.buildingNameAr || linkedUnit.buildingName} — وحدة {linkedUnit.unitNumber}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          الإيجار: {linkedUnit.monthlyBaseRentSAR || "—"} ر.س/شهر
                          {linkedUnit.floor != null && ` • الطابق ${linkedUnit.floor}`}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleUnlinkUnit} className="text-red-600">
                        <Unlink className="h-3.5 w-3.5 ml-1" /> فك الربط
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        لا توجد وحدة مرتبطة — يجب ربط وحدة قبل النشر
                      </p>
                      {availableUnits && (availableUnits as any[]).length > 0 ? (
                        <Select onValueChange={v => handleLinkUnit(Number(v))}>
                          <SelectTrigger><SelectValue placeholder="اختر وحدة للربط..." /></SelectTrigger>
                          <SelectContent>
                            {(availableUnits as any[]).map((u: any) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.buildingNameAr || u.buildingName} — وحدة {u.unitNumber}
                                {u.monthlyBaseRentSAR ? ` (${u.monthlyBaseRentSAR} ر.س)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-muted-foreground">لا توجد وحدات متاحة للربط. أنشئ وحدات من صفحة المباني أولاً.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5 text-[#3ECFC0]" />
                  الموقع والإحداثيات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>المدينة (عربي)</Label>
                    <Input value={form.cityAr} onChange={e => setForm(p => ({ ...p, cityAr: e.target.value }))} />
                  </div>
                  <div>
                    <Label>City (English)</Label>
                    <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الحي (عربي)</Label>
                    <Input value={form.districtAr} onChange={e => setForm(p => ({ ...p, districtAr: e.target.value }))} />
                  </div>
                  <div>
                    <Label>District (English)</Label>
                    <Input value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#3ECFC0]" />
                    رابط Google Maps
                  </Label>
                  <Input
                    value={form.googleMapsUrl}
                    onChange={e => setForm(p => ({ ...p, googleMapsUrl: e.target.value }))}
                    placeholder="الصق رابط الموقع من Google Maps"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    افتح Google Maps → اضغط مشاركة → انسخ الرابط
                  </p>
                </div>

                {/* Coordinates Section */}
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Crosshair className="h-4 w-4" />
                      الإحداثيات
                    </h4>
                    <Select
                      value={form.locationSource || "MANUAL"}
                      onValueChange={(val) => setForm(p => ({ ...p, locationSource: val }))}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="مصدر الموقع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANUAL">✏️ يدوي (Manual)</SelectItem>
                        <SelectItem value="GEOCODE">🔍 ترميز (Geocode)</SelectItem>
                        <SelectItem value="PIN">📍 دبوس (Pin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">خط العرض (Latitude)</Label>
                      <Input
                        value={form.latitude}
                        onChange={e => setForm(p => ({ ...p, latitude: e.target.value, locationSource: "MANUAL" }))}
                        placeholder="24.7136"
                        dir="ltr"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">خط الطول (Longitude)</Label>
                      <Input
                        value={form.longitude}
                        onChange={e => setForm(p => ({ ...p, longitude: e.target.value, locationSource: "MANUAL" }))}
                        placeholder="46.6753"
                        dir="ltr"
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Geocode Button */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={geocoding || (!form.city && !form.district && !form.address)}
                      onClick={async () => {
                        setGeocoding(true);
                        try {
                          const result = await geocodeMutation.mutateAsync({
                            city: form.city || form.cityAr,
                            district: form.district || form.districtAr,
                            address: form.address || form.addressAr,
                          });
                          if (result.success && result.result) {
                            setForm(p => ({
                              ...p,
                              latitude: String(result.result!.lat),
                              longitude: String(result.result!.lng),
                              locationSource: "GEOCODE",
                              placeId: result.result!.placeId || "",
                              geocodeProvider: result.result!.provider || "",
                            }));
                            toast.success(
                              result.result.fromCache
                                ? "تم استرجاع الإحداثيات من الذاكرة المؤقتة ✅"
                                : `تم الترميز الجغرافي بنجاح (${result.result.provider}) ✅`
                            );
                          } else {
                            toast.error(result.error || "فشل الترميز الجغرافي");
                          }
                        } catch (e: any) {
                          toast.error(e.message);
                        } finally {
                          setGeocoding(false);
                        }
                      }}
                    >
                      {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Navigation className="h-3.5 w-3.5 ml-1" />}
                      ترميز العنوان تلقائياً
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPinPicker(!showPinPicker)}
                    >
                      <MapPin className="h-3.5 w-3.5 ml-1" />
                      {showPinPicker ? "إخفاء الخريطة" : "تحديد بالدبوس 📍"}
                    </Button>
                  </div>

                  {/* Pin Picker Map */}
                  {showPinPicker && (
                    <div className="mt-2">
                      <PinPickerMap
                        lat={form.latitude ? parseFloat(form.latitude) : undefined}
                        lng={form.longitude ? parseFloat(form.longitude) : undefined}
                        onPinSet={(lat, lng) => {
                          setForm(p => ({
                            ...p,
                            latitude: lat.toFixed(7),
                            longitude: lng.toFixed(7),
                            locationSource: "PIN",
                          }));
                          toast.success("تم تحديد الموقع بالدبوس 📍");
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">انقر على الخريطة لتحديد الموقع الدقيق</p>
                    </div>
                  )}
                </div>

                {/* Location Visibility */}
                <div>
                  <Label className="flex items-center gap-1.5 mb-2">
                    <Shield className="h-3.5 w-3.5" />
                    خصوصية الموقع (للزوار)
                  </Label>
                  <Select
                    value={form.locationVisibility}
                    onValueChange={v => setForm(p => ({ ...p, locationVisibility: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXACT">📍 دقيق — يظهر الموقع الحقيقي</SelectItem>
                      <SelectItem value="APPROXIMATE">🔵 تقريبي — إزاحة عشوائية ~300م</SelectItem>
                      <SelectItem value="HIDDEN">🚫 مخفي — لا تظهر خريطة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Details & Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>التفاصيل والتسعير</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>غرف النوم</Label>
                    <Input type="number" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>الحمامات</Label>
                    <Input type="number" value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>المساحة (م²)</Label>
                    <Input type="number" value={form.sizeSqm} onChange={e => setForm(p => ({ ...p, sizeSqm: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الإيجار الشهري (ر.س)</Label>
                    <Input
                      value={form.monthlyRent}
                      onChange={e => setForm(p => ({ ...p, monthlyRent: e.target.value }))}
                      placeholder="0.00"
                      disabled={form.pricingSource === "UNIT"}
                    />
                    {form.pricingSource === "UNIT" && linkedUnit && (
                      <p className="text-xs text-blue-600 mt-1">
                        السعر من الوحدة: {linkedUnit.monthlyBaseRentSAR || "—"} ر.س/شهر
                      </p>
                    )}
                    {form.pricingSource === "UNIT" && !linkedUnit && (
                      <p className="text-xs text-amber-600 mt-1">اربط وحدة أولاً لتحديد السعر</p>
                    )}
                  </div>
                  <div>
                    <Label>مبلغ التأمين (ر.س)</Label>
                    <Input value={form.securityDeposit} onChange={e => setForm(p => ({ ...p, securityDeposit: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>أقل مدة إقامة (أشهر)</Label>
                    <Input type="number" value={form.minStayMonths} onChange={e => setForm(p => ({ ...p, minStayMonths: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>أقصى مدة إقامة (أشهر)</Label>
                    <Input type="number" value={form.maxStayMonths} onChange={e => setForm(p => ({ ...p, maxStayMonths: Number(e.target.value) }))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Photos with Drag & Drop */}
            <Card>
              <CardHeader>
                <CardTitle>الصور</CardTitle>
                <CardDescription>الصورة الأولى هي صورة الغلاف. اسحب لإعادة الترتيب.</CardDescription>
              </CardHeader>
              <CardContent>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={photoIds} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                      {form.photos.map((photo, i) => (
                        <SortablePhoto
                          key={photoIds[i]}
                          id={photoIds[i]}
                          url={photo}
                          index={i}
                          onRemove={() => removePhoto(i)}
                          onSetCover={() => setCoverPhoto(i)}
                        />
                      ))}
                      {/* Upload button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        {uploading ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 mb-1" />
                            <span className="text-xs">رفع صور</span>
                          </>
                        )}
                      </button>
                    </div>
                  </SortableContext>
                </DndContext>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => e.target.files && handlePhotoUpload(e.target.files)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Status & Actions */}
            {!isNew && (
              <Card>
                <CardHeader>
                  <CardTitle>الحالة والإجراءات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">الحالة الحالية:</span>
                    <Badge className={STATUS_COLORS[currentStatus]}>
                      {STATUS_LABELS[currentStatus] || currentStatus}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {currentStatus !== "published" && (
                      <Button
                        className="w-full"
                        onClick={handlePublish}
                        disabled={publishing || !readiness?.ready}
                      >
                        {publishing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Globe className="h-4 w-4 ml-1" />}
                        نشر على الموقع
                      </Button>
                    )}
                    {currentStatus === "published" && (
                      <>
                        <Button variant="outline" className="w-full" asChild>
                          <a href={`/property/${propertyId}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4 ml-1" /> معاينة عامة
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => unpublishMutation.mutate({ id: propertyId! })}
                        >
                          <EyeOff className="h-4 w-4 ml-1" /> إلغاء النشر
                        </Button>
                      </>
                    )}
                    {currentStatus !== "archived" && (
                      <Button
                        variant="outline"
                        className="w-full text-red-600 hover:text-red-700"
                        onClick={() => archiveMutation.mutate({ id: propertyId! })}
                      >
                        <Archive className="h-4 w-4 ml-1" /> أرشفة
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Publish Readiness Card */}
            {!isNew && readiness && (
              <Card className={readiness.ready ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {readiness.ready ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                    جاهزية النشر
                  </CardTitle>
                  <CardDescription>
                    مصدر التسعير: {readiness.pricingSource === "PROPERTY" ? "تسعير العقار" : "تسعير الوحدة"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {readiness.checks.map((check: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {check.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <span>{check.labelAr}</span>
                        {check.detail && (
                          <span className="text-xs text-muted-foreground mr-auto">{check.detail}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
