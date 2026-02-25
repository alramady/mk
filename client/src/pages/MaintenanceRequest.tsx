import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, Wrench, Upload, X, ImagePlus } from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { normalizeMediaUrl } from "@/lib/utils";
import { SafeMediaThumb } from "@/components/SafeMediaThumb";
import { toast } from "sonner";

export default function MaintenanceRequest() {
  const { t, lang, dir } = useI18n();
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    propertyId: 0,
    title: "",
    description: "",
    category: "other" as "plumbing" | "electrical" | "hvac" | "appliance" | "structural" | "pest_control" | "cleaning" | "other",
    priority: "medium" as "low" | "medium" | "high" | "emergency",
    photos: [] as string[],
  });
  const [uploading, setUploading] = useState(false);

  const bookings = trpc.booking.myBookings.useQuery(undefined, { enabled: isAuthenticated });
  const uploadPhoto = trpc.property.uploadPhoto.useMutation();

  const createRequest = trpc.maintenance.create.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم إرسال طلب الصيانة بنجاح" : "Maintenance request submitted");
      setLocation("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const activeBookings = bookings.data?.filter(b => b.status === "active" || b.status === "approved") || [];

  const handleSubmit = () => {
    if (!form.propertyId || !form.title || !form.description) {
      toast.error(lang === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    createRequest.mutate(form);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Maintenance Request" titleAr="طلب صيانة" path="/maintenance-request" noindex={true} />
      <Navbar />
      <div className="container py-6 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} className="mb-4">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold">{t("maintenance.newRequest")}</h1>
            <p className="text-muted-foreground text-sm">{lang === "ar" ? "أرسل طلب صيانة للمالك" : "Submit a maintenance request to your landlord"}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            {/* Property Selection */}
            <div>
              <Label>{lang === "ar" ? "العقار *" : "Property *"}</Label>
              <Select value={form.propertyId ? String(form.propertyId) : ""} onValueChange={v => setForm(p => ({ ...p, propertyId: Number(v) }))}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === "ar" ? "اختر العقار" : "Select property"} />
                </SelectTrigger>
                <SelectContent>
                  {activeBookings.map(b => (
                    <SelectItem key={b.propertyId} value={String(b.propertyId)}>
                      {lang === "ar" ? `عقار #${b.propertyId}` : `Property #${b.propertyId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeBookings.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">{lang === "ar" ? "لا توجد حجوزات نشطة" : "No active bookings"}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <Label>{lang === "ar" ? "عنوان المشكلة *" : "Issue Title *"}</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={lang === "ar" ? "مثال: تسريب مياه في المطبخ" : "e.g., Kitchen water leak"} />
            </div>

            {/* Description */}
            <div>
              <Label>{lang === "ar" ? "وصف المشكلة *" : "Issue Description *"}</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} placeholder={lang === "ar" ? "صف المشكلة بالتفصيل..." : "Describe the issue in detail..."} />
            </div>

            {/* Category */}
            <div>
              <Label>{lang === "ar" ? "التصنيف" : "Category"}</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as typeof form.category }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plumbing">{t("maintenance.plumbing")}</SelectItem>
                  <SelectItem value="electrical">{t("maintenance.electrical")}</SelectItem>
                  <SelectItem value="hvac">{t("maintenance.hvac")}</SelectItem>
                  <SelectItem value="appliance">{t("maintenance.appliance")}</SelectItem>
                  <SelectItem value="structural">{t("maintenance.structural")}</SelectItem>
                  <SelectItem value="pest_control">{t("maintenance.pest_control")}</SelectItem>
                  <SelectItem value="cleaning">{lang === "ar" ? "تنظيف" : "Cleaning"}</SelectItem>
                  <SelectItem value="other">{lang === "ar" ? "أخرى" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label>{lang === "ar" ? "الأولوية" : "Priority"}</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v as typeof form.priority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("maintenance.low")}</SelectItem>
                  <SelectItem value="medium">{t("maintenance.medium")}</SelectItem>
                  <SelectItem value="high">{t("maintenance.high")}</SelectItem>
                  <SelectItem value="emergency">{t("maintenance.emergency")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Photos */}
            <div>
              <Label>{lang === "ar" ? "صور (اختياري)" : "Photos (optional)"}</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {form.photos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                    <SafeMediaThumb
                      src={url}
                      alt={`${lang === 'ar' ? '\u0635\u0648\u0631\u0629' : 'Photo'} ${i + 1}`}
                      wrapperClassName="relative block w-full h-full overflow-hidden bg-muted"
                    />
                    <button
                      onClick={() => setForm(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))}
                      className="absolute top-1 end-1 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
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
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setLocation("/dashboard")}>{t("common.cancel")}</Button>
              <Button className="flex-1 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 font-semibold" onClick={handleSubmit} disabled={createRequest.isPending}>
                {createRequest.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {t("common.submit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
