import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Upload, X, Loader2, ImagePlus } from "lucide-react";
import { useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export default function CreateProperty() {
  const { t, lang, dir } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [, editParams] = useRoute("/edit-property/:id");
  const isEdit = !!editParams?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { get: setting } = useSiteSettings();

  // Dynamic rental duration limits from CMS
  const platformMinMonths = parseInt(setting("rental.minMonths", "1")) || 1;
  const platformMaxMonths = parseInt(setting("rental.maxMonths", "12")) || 12;

  const [form, setForm] = useState({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    propertyType: "apartment" as const,
    city: "", cityAr: "", district: "", districtAr: "",
    address: "", addressAr: "",
    latitude: "", longitude: "",
    bedrooms: 1, bathrooms: 1, sizeSqm: 0,
    floor: 0, totalFloors: 0, yearBuilt: 2020,
    furnishedLevel: "unfurnished" as "unfurnished" | "semi_furnished" | "fully_furnished",
    monthlyRent: "", securityDeposit: "",
    amenities: [] as string[],
    utilitiesIncluded: [] as string[],
    houseRules: "", houseRulesAr: "",
    minStayMonths: platformMinMonths, maxStayMonths: platformMaxMonths,
    instantBook: false,
    photos: [] as string[],
  });
  const [uploading, setUploading] = useState(false);

  const createMut = trpc.property.create.useMutation({
    onSuccess: (data) => {
      toast.success(lang === "ar" ? "تم إضافة العقار بنجاح" : "Property listed successfully");
      setLocation(`/property/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadPhoto = trpc.property.uploadPhoto.useMutation();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        const result = await uploadPhoto.mutateAsync({
          base64, filename: file.name, contentType: file.type,
        });
        setForm(prev => ({ ...prev, photos: [...prev.photos, result.url] }));
      }
    } catch { toast.error(lang === "ar" ? "فشل رفع الصورة" : "Failed to upload photo"); }
    setUploading(false);
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = () => {
    if (!form.titleEn || !form.titleAr || !form.monthlyRent) {
      toast.error(lang === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }
    createMut.mutate({
      ...form,
      bedrooms: form.bedrooms || undefined,
      bathrooms: form.bathrooms || undefined,
      sizeSqm: form.sizeSqm || undefined,
      floor: form.floor || undefined,
      totalFloors: form.totalFloors || undefined,
      yearBuilt: form.yearBuilt || undefined,
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  const amenityOptions = ["WiFi", "Parking", "Gym", "Pool", "Security", "Elevator", "Balcony", "Garden", "Storage", "Maid Room", "Central AC", "Satellite/Cable"];
  const utilityOptions = ["Water", "Electricity", "Gas", "Internet", "Maintenance"];

  const toggleAmenity = (a: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a) ? prev.amenities.filter(x => x !== a) : [...prev.amenities, a],
    }));
  };
  const toggleUtility = (u: string) => {
    setForm(prev => ({
      ...prev,
      utilitiesIncluded: prev.utilitiesIncluded.includes(u) ? prev.utilitiesIncluded.filter(x => x !== u) : [...prev.utilitiesIncluded, u],
    }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-4">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <h1 className="text-2xl font-heading font-bold mb-6">
          {isEdit ? (lang === "ar" ? "تعديل العقار" : "Edit Property") : t("nav.listProperty")}
        </h1>

        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle>{lang === "ar" ? "المعلومات الأساسية" : "Basic Information"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{lang === "ar" ? "العنوان (عربي) *" : "Title (Arabic) *"}</Label>
                  <Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} dir="rtl" />
                </div>
                <div>
                  <Label>{lang === "ar" ? "العنوان (إنجليزي) *" : "Title (English) *"}</Label>
                  <Input value={form.titleEn} onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{lang === "ar" ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                  <Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} dir="rtl" rows={4} />
                </div>
                <div>
                  <Label>{lang === "ar" ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
                  <Textarea value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} dir="ltr" rows={4} />
                </div>
              </div>
              <div>
                <Label>{t("search.propertyType")}</Label>
                <Select value={form.propertyType} onValueChange={v => setForm(p => ({ ...p, propertyType: v as typeof form.propertyType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"].map(v => (
                      <SelectItem key={v} value={v}>{t(`type.${v}` as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader><CardTitle>{t("property.location")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{lang === "ar" ? "المدينة (عربي)" : "City (Arabic)"}</Label>
                  <Input value={form.cityAr} onChange={e => setForm(p => ({ ...p, cityAr: e.target.value }))} dir="rtl" />
                </div>
                <div>
                  <Label>{lang === "ar" ? "المدينة (إنجليزي)" : "City (English)"}</Label>
                  <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{lang === "ar" ? "الحي (عربي)" : "District (Arabic)"}</Label>
                  <Input value={form.districtAr} onChange={e => setForm(p => ({ ...p, districtAr: e.target.value }))} dir="rtl" />
                </div>
                <div>
                  <Label>{lang === "ar" ? "الحي (إنجليزي)" : "District (English)"}</Label>
                  <Input value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{lang === "ar" ? "خط العرض" : "Latitude"}</Label>
                  <Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <Label>{lang === "ar" ? "خط الطول" : "Longitude"}</Label>
                  <Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} dir="ltr" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader><CardTitle>{t("property.details")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><Label>{t("search.bedrooms")}</Label><Input type="number" min={0} value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: Number(e.target.value) }))} /></div>
                <div><Label>{t("search.bathrooms")}</Label><Input type="number" min={0} value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: Number(e.target.value) }))} /></div>
                <div><Label>{t("property.size")} ({t("property.sqm")})</Label><Input type="number" min={0} value={form.sizeSqm} onChange={e => setForm(p => ({ ...p, sizeSqm: Number(e.target.value) }))} /></div>
                <div><Label>{t("property.floor")}</Label><Input type="number" min={0} value={form.floor} onChange={e => setForm(p => ({ ...p, floor: Number(e.target.value) }))} /></div>
              </div>
              <div>
                <Label>{t("search.furnished")}</Label>
                <Select value={form.furnishedLevel} onValueChange={v => setForm(p => ({ ...p, furnishedLevel: v as "unfurnished" | "semi_furnished" | "fully_furnished" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unfurnished">{t("search.unfurnished")}</SelectItem>
                    <SelectItem value="semi_furnished">{t("search.semi_furnished")}</SelectItem>
                    <SelectItem value="fully_furnished">{t("search.fully_furnished")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader><CardTitle>{lang === "ar" ? "التسعير" : "Pricing"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{t("property.monthlyRent")} ({t("payment.sar")}) *</Label><Input type="number" value={form.monthlyRent} onChange={e => setForm(p => ({ ...p, monthlyRent: e.target.value }))} /></div>
                <div><Label>{t("property.securityDeposit")} ({t("payment.sar")})</Label><Input type="number" value={form.securityDeposit} onChange={e => setForm(p => ({ ...p, securityDeposit: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{lang === "ar" ? "الحد الأدنى للإقامة (أشهر)" : "Min Stay (months)"}</Label><Input type="number" min={platformMinMonths} max={platformMaxMonths} value={form.minStayMonths} onChange={e => setForm(p => ({ ...p, minStayMonths: Math.max(platformMinMonths, Math.min(platformMaxMonths, Number(e.target.value))) }))} /></div>
                <div><Label>{lang === "ar" ? "الحد الأقصى للإقامة (أشهر)" : "Max Stay (months)"}</Label><Input type="number" min={platformMinMonths} max={platformMaxMonths} value={form.maxStayMonths} onChange={e => setForm(p => ({ ...p, maxStayMonths: Math.max(platformMinMonths, Math.min(platformMaxMonths, Number(e.target.value))) }))} /></div>
                <p className="text-xs text-muted-foreground col-span-2">{lang === "ar" ? `المنصة تسمح بالتأجير من ${platformMinMonths} إلى ${platformMaxMonths} أشهر` : `Platform allows rentals from ${platformMinMonths} to ${platformMaxMonths} months`}</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.instantBook} onCheckedChange={v => setForm(p => ({ ...p, instantBook: v }))} />
                <Label>{lang === "ar" ? "الحجز الفوري" : "Instant Booking"}</Label>
              </div>
            </CardContent>
          </Card>

          {/* Amenities */}
          <Card>
            <CardHeader><CardTitle>{t("property.amenities")}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {amenityOptions.map(a => (
                  <Button key={a} variant={form.amenities.includes(a) ? "default" : "outline"} size="sm" onClick={() => toggleAmenity(a)}>
                    {a}
                  </Button>
                ))}
              </div>
              <Separator className="my-4" />
              <Label className="mb-2 block">{t("property.utilities")}</Label>
              <div className="flex flex-wrap gap-2">
                {utilityOptions.map(u => (
                  <Button key={u} variant={form.utilitiesIncluded.includes(u) ? "default" : "outline"} size="sm" onClick={() => toggleUtility(u)}>
                    {u}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader><CardTitle>{t("property.photos")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {form.photos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 end-1 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                  <span className="text-xs mt-1">{lang === "ar" ? "إضافة صورة" : "Add Photo"}</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setLocation("/")}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold">
              {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {isEdit ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
