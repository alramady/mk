import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, ImagePlus, X, CheckCircle, Building2,
  Phone, Mail, MapPin, BedDouble, Bath, Ruler, Send
} from "lucide-react";

const propertyTypes = [
  { value: "apartment", labelAr: "شقة", labelEn: "Apartment" },
  { value: "villa", labelAr: "فيلا", labelEn: "Villa" },
  { value: "studio", labelAr: "استوديو", labelEn: "Studio" },
  { value: "duplex", labelAr: "دوبلكس", labelEn: "Duplex" },
  { value: "furnished_room", labelAr: "غرفة مفروشة", labelEn: "Furnished Room" },
  { value: "compound", labelAr: "مجمع سكني", labelEn: "Compound" },
  { value: "hotel_apartment", labelAr: "شقة فندقية", labelEn: "Hotel Apartment" },
];

const furnishLevels = [
  { value: "unfurnished", labelAr: "غير مفروش", labelEn: "Unfurnished" },
  { value: "semi_furnished", labelAr: "مفروش جزئياً", labelEn: "Semi Furnished" },
  { value: "fully_furnished", labelAr: "مفروش بالكامل", labelEn: "Fully Furnished" },
];

export default function SubmitProperty() {
  const { t, lang, dir } = useI18n();
  const isAr = lang === "ar";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    ownerName: "", ownerNameAr: "",
    phone: "", email: "",
    city: "", cityAr: "",
    district: "", districtAr: "",
    address: "", addressAr: "",
    propertyType: "" as string,
    bedrooms: "", bathrooms: "", sizeSqm: "",
    furnishedLevel: "" as string,
    desiredMonthlyRent: "",
    notes: "", notesAr: "",
    photos: [] as string[],
  });

  const uploadPhoto = trpc.submission.uploadPhoto.useMutation();
  const createSubmission = trpc.submission.create.useMutation();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (form.photos.length + files.length > 10) {
      toast.error(isAr ? "الحد الأقصى 10 صور" : "Maximum 10 photos");
      return;
    }
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
      toast.success(isAr ? "تم رفع الصور" : "Photos uploaded");
    } catch {
      toast.error(isAr ? "فشل رفع الصورة" : "Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    // Validation
    const name = form.ownerNameAr || form.ownerName;
    if (!name || !form.phone) {
      toast.error(isAr ? "يرجى إدخال الاسم ورقم الهاتف" : "Please enter name and phone");
      return;
    }
    if (form.phone.length < 5) {
      toast.error(isAr ? "رقم الهاتف غير صحيح" : "Invalid phone number");
      return;
    }

    setSaving(true);
    try {
      await createSubmission.mutateAsync({
        ownerName: form.ownerName || form.ownerNameAr,
        ownerNameAr: form.ownerNameAr || undefined,
        phone: form.phone,
        email: form.email || undefined,
        city: form.city || undefined,
        cityAr: form.cityAr || undefined,
        district: form.district || undefined,
        districtAr: form.districtAr || undefined,
        address: form.address || undefined,
        addressAr: form.addressAr || undefined,
        propertyType: form.propertyType ? form.propertyType as any : undefined,
        bedrooms: form.bedrooms ? +form.bedrooms : undefined,
        bathrooms: form.bathrooms ? +form.bathrooms : undefined,
        sizeSqm: form.sizeSqm ? +form.sizeSqm : undefined,
        furnishedLevel: form.furnishedLevel ? form.furnishedLevel as any : undefined,
        desiredMonthlyRent: form.desiredMonthlyRent || undefined,
        notes: form.notes || undefined,
        notesAr: form.notesAr || undefined,
        photos: form.photos.length > 0 ? form.photos : undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      if (err?.message?.includes("Too many")) {
        toast.error(isAr ? "لقد أرسلت طلبات كثيرة. يرجى المحاولة لاحقاً" : "Too many submissions. Please try later.");
      } else {
        toast.error(err?.message || (isAr ? "حدث خطأ" : "An error occurred"));
      }
    }
    setSaving(false);
  };

  if (submitted) {
    return (
      <>
        <SEOHead title={isAr ? "تم إرسال الطلب | المفتاح الشهري" : "Submission Received | Monthly Key"} />
        <Navbar />
        <div className="min-h-[70vh] flex items-center justify-center px-4" dir={dir}>
          <Card className="max-w-md w-full text-center">
            <CardContent className="py-12 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold">
                {isAr ? "تم إرسال طلبك بنجاح!" : "Submission Received!"}
              </h2>
              <p className="text-muted-foreground">
                {isAr
                  ? "شكراً لك! سيتواصل معك فريقنا قريباً لمناقشة تفاصيل العقار."
                  : "Thank you! Our team will contact you soon to discuss your property details."}
              </p>
              <Button onClick={() => window.location.href = "/"} variant="outline" className="mt-4">
                {isAr ? "العودة للرئيسية" : "Back to Home"}
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={isAr ? "سجّل عقارك | المفتاح الشهري" : "List Your Property | Monthly Key"}
        description={isAr ? "سجّل عقارك معنا واحصل على مستأجرين موثوقين" : "List your property with us and get reliable tenants"}
      />
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" dir={dir}>
        {/* Hero Section */}
        <div className="bg-[#0B1E2D] text-white py-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-[#3ECFC0]" />
            <h1 className="text-3xl font-bold mb-3">
              {isAr ? "سجّل عقارك معنا" : "List Your Property With Us"}
            </h1>
            <p className="text-white/70 text-lg">
              {isAr
                ? "أدخل بيانات عقارك وسيتواصل معك فريقنا لإتمام عملية التسجيل"
                : "Enter your property details and our team will contact you to complete the listing"}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-2xl mx-auto px-4 -mt-8 pb-16">
          <Card className="shadow-xl border-0">
            <CardContent className="p-6 sm:p-8 space-y-8">
              {/* Owner Info */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#3ECFC0]" />
                  {isAr ? "بيانات التواصل" : "Contact Information"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{isAr ? "الاسم الكامل *" : "Full Name *"}</Label>
                    <Input
                      value={isAr ? form.ownerNameAr : form.ownerName}
                      onChange={e => setForm(p => isAr ? { ...p, ownerNameAr: e.target.value } : { ...p, ownerName: e.target.value })}
                      placeholder={isAr ? "محمد أحمد" : "John Doe"}
                    />
                  </div>
                  <div>
                    <Label>{isAr ? "رقم الهاتف *" : "Phone Number *"}</Label>
                    <Input
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+966 5XX XXX XXXX"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <Label>{isAr ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}</Label>
                  <Input
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    dir="ltr"
                    type="email"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#3ECFC0]" />
                  {isAr ? "الموقع" : "Location"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{isAr ? "المدينة" : "City"}</Label>
                    <Input
                      value={isAr ? form.cityAr : form.city}
                      onChange={e => setForm(p => isAr ? { ...p, cityAr: e.target.value } : { ...p, city: e.target.value })}
                      placeholder={isAr ? "الرياض" : "Riyadh"}
                    />
                  </div>
                  <div>
                    <Label>{isAr ? "الحي" : "District"}</Label>
                    <Input
                      value={isAr ? form.districtAr : form.district}
                      onChange={e => setForm(p => isAr ? { ...p, districtAr: e.target.value } : { ...p, district: e.target.value })}
                      placeholder={isAr ? "حي النرجس" : "Al Narjis"}
                    />
                  </div>
                </div>
                <div>
                  <Label>{isAr ? "العنوان التفصيلي" : "Detailed Address"}</Label>
                  <Input
                    value={isAr ? form.addressAr : form.address}
                    onChange={e => setForm(p => isAr ? { ...p, addressAr: e.target.value } : { ...p, address: e.target.value })}
                    placeholder={isAr ? "شارع الملك فهد، بجوار..." : "King Fahd Road, near..."}
                  />
                </div>
              </div>

              {/* Property Details */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#3ECFC0]" />
                  {isAr ? "تفاصيل العقار" : "Property Details"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{isAr ? "نوع العقار" : "Property Type"}</Label>
                    <Select value={form.propertyType} onValueChange={v => setForm(p => ({ ...p, propertyType: v }))}>
                      <SelectTrigger><SelectValue placeholder={isAr ? "اختر النوع" : "Select type"} /></SelectTrigger>
                      <SelectContent>
                        {propertyTypes.map(pt => (
                          <SelectItem key={pt.value} value={pt.value}>{isAr ? pt.labelAr : pt.labelEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{isAr ? "مستوى التأثيث" : "Furnishing Level"}</Label>
                    <Select value={form.furnishedLevel} onValueChange={v => setForm(p => ({ ...p, furnishedLevel: v }))}>
                      <SelectTrigger><SelectValue placeholder={isAr ? "اختر" : "Select"} /></SelectTrigger>
                      <SelectContent>
                        {furnishLevels.map(fl => (
                          <SelectItem key={fl.value} value={fl.value}>{isAr ? fl.labelAr : fl.labelEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {isAr ? "غرف النوم" : "Bedrooms"}</Label>
                    <Input type="number" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: e.target.value }))} min={0} placeholder="2" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {isAr ? "الحمامات" : "Bathrooms"}</Label>
                    <Input type="number" value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: e.target.value }))} min={0} placeholder="1" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {isAr ? "المساحة (م²)" : "Size (sqm)"}</Label>
                    <Input type="number" value={form.sizeSqm} onChange={e => setForm(p => ({ ...p, sizeSqm: e.target.value }))} min={0} placeholder="120" />
                  </div>
                </div>
                <div>
                  <Label>{isAr ? "الإيجار الشهري المطلوب (ر.س)" : "Desired Monthly Rent (SAR)"}</Label>
                  <Input
                    value={form.desiredMonthlyRent}
                    onChange={e => setForm(p => ({ ...p, desiredMonthlyRent: e.target.value }))}
                    placeholder="3000"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-[#3ECFC0]" />
                  {isAr ? "صور العقار (اختياري)" : "Property Photos (optional)"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isAr ? "أضف حتى 10 صور لعقارك" : "Add up to 10 photos of your property"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {form.photos.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i)} className="absolute top-1 end-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {form.photos.length < 10 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-[#3ECFC0] hover:text-[#3ECFC0] transition-colors"
                    >
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                      <span className="text-[10px] mt-0.5">{uploading ? (isAr ? "جاري..." : "...") : (isAr ? "رفع" : "Upload")}</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-4">
                <h3 className="font-semibold">{isAr ? "ملاحظات إضافية" : "Additional Notes"}</h3>
                <Textarea
                  value={isAr ? form.notesAr : form.notes}
                  onChange={e => setForm(p => isAr ? { ...p, notesAr: e.target.value } : { ...p, notes: e.target.value })}
                  placeholder={isAr ? "أي معلومات إضافية تود مشاركتها..." : "Any additional information you'd like to share..."}
                  rows={4}
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={saving}
                size="lg"
                className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] text-lg h-12"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin me-2" />
                ) : (
                  <Send className="h-5 w-5 me-2" />
                )}
                {isAr ? "إرسال الطلب" : "Submit Request"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                {isAr
                  ? "بإرسال هذا الطلب، أنت توافق على أن يتواصل معك فريقنا بخصوص عقارك"
                  : "By submitting, you agree to be contacted by our team regarding your property"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}
