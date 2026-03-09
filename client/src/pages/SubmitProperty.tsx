import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Loader2, ImagePlus, X, CheckCircle, Building2,
  Phone, Mail, MapPin, BedDouble, Bath, Ruler, Send,
  Save, ChevronLeft, ChevronRight, Shield, User, Camera
} from "lucide-react";

/* ─── Constants ─── */
const DRAFT_KEY = "mk_submit_property_draft";

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

const stepsMeta = [
  { id: 1, Icon: User, labelAr: "بيانات التواصل", labelEn: "Contact Info" },
  { id: 2, Icon: MapPin, labelAr: "الموقع", labelEn: "Location" },
  { id: 3, Icon: Building2, labelAr: "تفاصيل العقار", labelEn: "Property Details" },
  { id: 4, Icon: Camera, labelAr: "الصور والملاحظات", labelEn: "Photos & Notes" },
  { id: 5, Icon: Shield, labelAr: "الموافقة والإرسال", labelEn: "Agreement & Submit" },
];

/* ─── Default Privacy Agreement (fallback if CMS empty) ─── */
const defaultAgreementAr = `## اتفاقية الخصوصية وشروط تقديم العقار

بتقديم هذا الطلب، أنت توافق على الشروط التالية:

### 1. جمع البيانات واستخدامها
- نقوم بجمع بياناتك الشخصية (الاسم، رقم الهاتف، البريد الإلكتروني) لغرض التواصل معك بخصوص عقارك فقط.
- لن نشارك بياناتك مع أي طرف ثالث دون موافقتك المسبقة.

### 2. صور العقار
- الصور المرفوعة ستُستخدم حصرياً لأغراض تقييم العقار وعرضه على المنصة بعد موافقتك.
- يحق لك طلب حذف الصور في أي وقت.

### 3. التواصل
- سيتواصل معك فريقنا عبر الهاتف أو البريد الإلكتروني المُقدم لمناقشة تفاصيل العقار.
- يمكنك إلغاء الاشتراك في التواصل في أي وقت.

### 4. حماية البيانات
- نلتزم بنظام حماية البيانات الشخصية الصادر بالمرسوم الملكي رقم (م/19) وتاريخ 9/2/1443هـ.
- بياناتك محمية بتشفير عالي المستوى ولا يمكن الوصول إليها إلا من قبل الموظفين المخولين.

### 5. حقوقك
- يحق لك الاطلاع على بياناتك الشخصية وتصحيحها أو حذفها.
- يحق لك سحب موافقتك في أي وقت عبر التواصل معنا.

### 6. مدة الاحتفاظ بالبيانات
- نحتفظ ببياناتك لمدة لا تتجاوز 12 شهراً من تاريخ التقديم ما لم يتم التعاقد.
- في حال التعاقد، تُحفظ البيانات طوال مدة العقد وفقاً للأنظمة المعمول بها.`;

const defaultAgreementEn = `## Privacy Agreement & Property Submission Terms

By submitting this request, you agree to the following terms:

### 1. Data Collection & Use
- We collect your personal information (name, phone number, email) solely for the purpose of contacting you regarding your property.
- We will not share your data with any third party without your prior consent.

### 2. Property Photos
- Uploaded photos will be used exclusively for property evaluation and listing on the platform after your approval.
- You may request deletion of photos at any time.

### 3. Communication
- Our team will contact you via the phone number or email provided to discuss property details.
- You can opt out of communications at any time.

### 4. Data Protection
- We comply with the Saudi Personal Data Protection Law (Royal Decree No. M/19).
- Your data is protected with high-level encryption and is only accessible by authorized personnel.

### 5. Your Rights
- You have the right to access, correct, or delete your personal data.
- You may withdraw your consent at any time by contacting us.

### 6. Data Retention
- We retain your data for no more than 12 months from the submission date unless a contract is established.
- In case of a contract, data is retained for the duration of the contract in accordance with applicable regulations.`;

/* ─── Simple Markdown to HTML ─── */
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/^\- (.+)$/gm, '<li class="ms-4 mb-1 list-disc">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

/* ─── Component ─── */
export default function SubmitProperty() {
  const { t, lang, dir } = useI18n();
  const isAr = lang === "ar";
  const { get: s } = useSiteSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  /* ─── Form State ─── */
  const [form, setForm] = useState({
    ownerName: "", ownerNameAr: "",
    phone: "", email: "",
    city: "", cityAr: "",
    district: "", districtAr: "",
    address: "", addressAr: "",
    googleMapsUrl: "",
    propertyType: "" as string,
    bedrooms: "", bathrooms: "", sizeSqm: "",
    furnishedLevel: "" as string,
    desiredMonthlyRent: "",
    notes: "", notesAr: "",
    photos: [] as string[],
  });

  /* ─── Privacy Agreement from CMS ─── */
  const cmsAgreementAr = s("submitProperty.agreementAr");
  const cmsAgreementEn = s("submitProperty.agreementEn");
  const agreementContent = isAr
    ? (cmsAgreementAr || defaultAgreementAr)
    : (cmsAgreementEn || defaultAgreementEn);

  /* ─── Draft: Load on mount ─── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && (parsed.phone || parsed.ownerName || parsed.ownerNameAr)) {
          setHasDraft(true);
          setShowDraftPrompt(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm(prev => ({ ...prev, ...parsed, photos: parsed.photos || [] }));
        toast.success(isAr ? "تم استعادة المسودة بنجاح" : "Draft restored successfully");
      }
    } catch { /* ignore */ }
    setShowDraftPrompt(false);
  }, [isAr]);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      toast.success(isAr ? "تم حفظ المسودة" : "Draft saved");
    } catch { /* ignore */ }
  }, [form, isAr]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  }, []);

  /* ─── tRPC ─── */
  const uploadPhoto = trpc.submission.uploadPhoto.useMutation();
  const createSubmission = trpc.submission.create.useMutation();

  /* ─── Photo Upload (same logic as before) ─── */
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

  /* ─── Step Validation ─── */
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: {
        const name = isAr ? form.ownerNameAr : form.ownerName;
        if (!name || name.trim().length < 2) {
          toast.error(isAr ? "يرجى إدخال الاسم الكامل" : "Please enter your full name");
          return false;
        }
        if (!form.phone || form.phone.length < 5) {
          toast.error(isAr ? "يرجى إدخال رقم هاتف صحيح" : "Please enter a valid phone number");
          return false;
        }
        return true;
      }
      case 2: {
        const city = isAr ? form.cityAr : form.city;
        if (!city || city.trim().length < 2) {
          toast.error(isAr ? "يرجى إدخال المدينة" : "Please enter the city");
          return false;
        }
        return true;
      }
      case 3: {
        if (!form.propertyType) {
          toast.error(isAr ? "يرجى اختيار نوع العقار" : "Please select property type");
          return false;
        }
        return true;
      }
      case 4:
        return true;
      case 5:
        if (!agreedToTerms) {
          toast.error(isAr ? "يجب الموافقة على شروط الخصوصية للمتابعة" : "You must agree to the privacy terms to continue");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const goPrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    if (!agreedToTerms) {
      toast.error(isAr ? "يجب الموافقة على شروط الخصوصية للمتابعة" : "You must agree to the privacy terms to continue");
      return;
    }
    // Re-validate all steps
    for (let i = 1; i <= 4; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        return;
      }
    }

    setSaving(true);
    try {
      await createSubmission.mutateAsync({
        ownerName: isAr ? (form.ownerNameAr || form.ownerName) : (form.ownerName || form.ownerNameAr),
        ownerNameAr: isAr ? form.ownerNameAr : undefined,
        phone: form.phone,
        email: form.email || undefined,
        city: isAr ? undefined : (form.city || undefined),
        cityAr: isAr ? (form.cityAr || undefined) : undefined,
        district: isAr ? undefined : (form.district || undefined),
        districtAr: isAr ? (form.districtAr || undefined) : undefined,
        address: isAr ? undefined : (form.address || undefined),
        addressAr: isAr ? (form.addressAr || undefined) : undefined,
        googleMapsUrl: form.googleMapsUrl || undefined,
        propertyType: form.propertyType ? form.propertyType as any : undefined,
        bedrooms: form.bedrooms ? +form.bedrooms : undefined,
        bathrooms: form.bathrooms ? +form.bathrooms : undefined,
        sizeSqm: form.sizeSqm ? +form.sizeSqm : undefined,
        furnishedLevel: form.furnishedLevel ? form.furnishedLevel as any : undefined,
        desiredMonthlyRent: form.desiredMonthlyRent || undefined,
        notes: isAr ? undefined : (form.notes || undefined),
        notesAr: isAr ? (form.notesAr || undefined) : undefined,
        photos: form.photos.length > 0 ? form.photos : undefined,
      });
      clearDraft();
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

  /* ─── Success Screen ─── */
  if (submitted) {
    return (
      <>
        <SEOHead title={isAr ? "تم إرسال الطلب | المفتاح الشهري" : "Submission Received | Monthly Key"} />
        <Navbar />
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-16" dir={dir}>
          <div className="max-w-md w-full text-center">
            {/* Animated success */}
            <div className="relative mx-auto w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full bg-[#3ECFC0]/20 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#3ECFC0] to-[#2ab5a6] flex items-center justify-center shadow-lg shadow-[#3ECFC0]/30">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-[#0B1E2D] dark:text-white mb-4">
              {isAr ? "تم إرسال طلبك بنجاح!" : "Submission Received!"}
            </h2>
            <p className="text-muted-foreground text-lg mb-2">
              {isAr
                ? "شكراً لثقتك بنا! سيتواصل معك فريقنا خلال 24 ساعة لمناقشة تفاصيل العقار."
                : "Thank you for your trust! Our team will contact you within 24 hours to discuss your property details."}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              {isAr
                ? "يمكنك متابعة حالة طلبك عبر التواصل معنا على الواتساب"
                : "You can follow up on your request status by contacting us on WhatsApp"}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => window.location.href = "/"} variant="outline" className="h-12 px-6">
                {isAr ? "العودة للرئيسية" : "Back to Home"}
              </Button>
              <Button
                onClick={() => { setSubmitted(false); setCurrentStep(1); setAgreedToTerms(false); setForm({ ownerName: "", ownerNameAr: "", phone: "", email: "", city: "", cityAr: "", district: "", districtAr: "", address: "", addressAr: "", googleMapsUrl: "", propertyType: "", bedrooms: "", bathrooms: "", sizeSqm: "", furnishedLevel: "", desiredMonthlyRent: "", notes: "", notesAr: "", photos: [] }); }}
                className="h-12 px-6 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]"
              >
                {isAr ? "تقديم عقار آخر" : "Submit Another Property"}
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  /* ─── Step Content Renderers ─── */
  const renderStep1 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center">
          <User className="h-5 w-5 text-[#3ECFC0]" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#0B1E2D] dark:text-white">
            {isAr ? "بيانات التواصل" : "Contact Information"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr ? "حتى نتمكن من التواصل معك بخصوص عقارك" : "So we can reach you about your property"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-semibold mb-1.5 block">
            {isAr ? "الاسم الكامل *" : "Full Name *"}
          </Label>
          <Input
            value={isAr ? form.ownerNameAr : form.ownerName}
            onChange={e => setForm(p => isAr ? { ...p, ownerNameAr: e.target.value } : { ...p, ownerName: e.target.value })}
            placeholder={isAr ? "مثال: محمد أحمد العمري" : "e.g. John Doe"}
            className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
          />
        </div>

        <div>
          <Label className="text-sm font-semibold mb-1.5 block">
            {isAr ? "رقم الهاتف *" : "Phone Number *"}
          </Label>
          <Input
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="+966 5XX XXX XXXX"
            dir="ltr"
            className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {isAr ? "سيتم التواصل معك عبر هذا الرقم" : "We will contact you via this number"}
          </p>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-1.5 block">
            {isAr ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}
          </Label>
          <Input
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="email@example.com"
            dir="ltr"
            type="email"
            className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center">
          <MapPin className="h-5 w-5 text-[#3ECFC0]" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#0B1E2D] dark:text-white">
            {isAr ? "موقع العقار" : "Property Location"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أين يقع عقارك؟" : "Where is your property located?"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">
              {isAr ? "المدينة *" : "City *"}
            </Label>
            <Input
              value={isAr ? form.cityAr : form.city}
              onChange={e => setForm(p => isAr ? { ...p, cityAr: e.target.value } : { ...p, city: e.target.value })}
              placeholder={isAr ? "مثال: الرياض" : "e.g. Riyadh"}
              className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">
              {isAr ? "الحي" : "District"}
            </Label>
            <Input
              value={isAr ? form.districtAr : form.district}
              onChange={e => setForm(p => isAr ? { ...p, districtAr: e.target.value } : { ...p, district: e.target.value })}
              placeholder={isAr ? "مثال: حي النرجس" : "e.g. Al Narjis"}
              className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-1.5 block">
            {isAr ? "العنوان التفصيلي" : "Detailed Address"}
          </Label>
          <Input
            value={isAr ? form.addressAr : form.address}
            onChange={e => setForm(p => isAr ? { ...p, addressAr: e.target.value } : { ...p, address: e.target.value })}
            placeholder={isAr ? "مثال: شارع الملك فهد، بجوار..." : "e.g. King Fahd Road, near..."}
            className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
          />
        </div>

        <div>
          <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#3ECFC0]" />
            {isAr ? "رابط Google Maps" : "Google Maps Link"}
          </Label>
          <Input
            value={form.googleMapsUrl}
            onChange={e => setForm(p => ({ ...p, googleMapsUrl: e.target.value }))}
            placeholder={isAr ? "الصق رابط الموقع من Google Maps" : "Paste Google Maps link here"}
            dir="ltr"
            className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {isAr ? "افتح Google Maps ← اضغط مشاركة ← انسخ الرابط" : "Open Google Maps → Click Share → Copy link"}
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-[#3ECFC0]" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#0B1E2D] dark:text-white">
            {isAr ? "تفاصيل العقار" : "Property Details"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أخبرنا عن مواصفات عقارك" : "Tell us about your property specifications"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">
              {isAr ? "نوع العقار *" : "Property Type *"}
            </Label>
            <Select value={form.propertyType} onValueChange={v => setForm(p => ({ ...p, propertyType: v }))}>
              <SelectTrigger className="h-12 text-base border-gray-200 dark:border-gray-700">
                <SelectValue placeholder={isAr ? "اختر النوع" : "Select type"} />
              </SelectTrigger>
              <SelectContent>
                {propertyTypes.map(pt => (
                  <SelectItem key={pt.value} value={pt.value}>{isAr ? pt.labelAr : pt.labelEn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">
              {isAr ? "مستوى التأثيث" : "Furnishing Level"}
            </Label>
            <Select value={form.furnishedLevel} onValueChange={v => setForm(p => ({ ...p, furnishedLevel: v }))}>
              <SelectTrigger className="h-12 text-base border-gray-200 dark:border-gray-700">
                <SelectValue placeholder={isAr ? "اختر" : "Select"} />
              </SelectTrigger>
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
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5 text-[#3ECFC0]" />
              {isAr ? "غرف النوم" : "Bedrooms"}
            </Label>
            <Input
              type="number"
              value={form.bedrooms}
              onChange={e => setForm(p => ({ ...p, bedrooms: e.target.value }))}
              min={0}
              placeholder="2"
              className="h-12 text-base text-center border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              <Bath className="h-3.5 w-3.5 text-[#3ECFC0]" />
              {isAr ? "الحمامات" : "Bathrooms"}
            </Label>
            <Input
              type="number"
              value={form.bathrooms}
              onChange={e => setForm(p => ({ ...p, bathrooms: e.target.value }))}
              min={0}
              placeholder="1"
              className="h-12 text-base text-center border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-[#3ECFC0]" />
              {isAr ? "م²" : "sqm"}
            </Label>
            <Input
              type="number"
              value={form.sizeSqm}
              onChange={e => setForm(p => ({ ...p, sizeSqm: e.target.value }))}
              min={0}
              placeholder="120"
              className="h-12 text-base text-center border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-1.5 block">
            {isAr ? "الإيجار الشهري المطلوب (ر.س)" : "Desired Monthly Rent (SAR)"}
          </Label>
          <Input
            value={form.desiredMonthlyRent}
            onChange={e => setForm(p => ({ ...p, desiredMonthlyRent: e.target.value }))}
            placeholder={isAr ? "مثال: 3000" : "e.g. 3000"}
            dir="ltr"
            className="h-12 text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20"
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center">
          <Camera className="h-5 w-5 text-[#3ECFC0]" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#0B1E2D] dark:text-white">
            {isAr ? "الصور والملاحظات" : "Photos & Notes"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أضف صوراً لعقارك وأي ملاحظات إضافية" : "Add photos of your property and any additional notes"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Photo Upload */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            {isAr ? "صور العقار (اختياري - حتى 10 صور)" : "Property Photos (optional - up to 10)"}
          </Label>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {form.photos.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-700 group shadow-sm">
                <img loading="lazy" src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1.5 end-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {form.photos.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center text-muted-foreground hover:border-[#3ECFC0] hover:text-[#3ECFC0] hover:bg-[#3ECFC0]/5 transition-all duration-200"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-medium">{isAr ? "رفع صورة" : "Upload"}</span>
                  </>
                )}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label className="text-sm font-semibold mb-1.5 block">
            {isAr ? "ملاحظات إضافية" : "Additional Notes"}
          </Label>
          <Textarea
            value={isAr ? form.notesAr : form.notes}
            onChange={e => setForm(p => isAr ? { ...p, notesAr: e.target.value } : { ...p, notes: e.target.value })}
            placeholder={isAr ? "أي معلومات إضافية تود مشاركتها عن العقار..." : "Any additional information you'd like to share about the property..."}
            rows={5}
            className="text-base border-gray-200 dark:border-gray-700 focus:border-[#3ECFC0] focus:ring-[#3ECFC0]/20 resize-none"
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-[#3ECFC0]" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#0B1E2D] dark:text-white">
            {isAr ? "الموافقة على الشروط" : "Terms Agreement"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr ? "يرجى قراءة الشروط والموافقة عليها قبل الإرسال" : "Please read and agree to the terms before submitting"}
          </p>
        </div>
      </div>

      {/* Agreement Preview Box */}
      <div
        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 max-h-[300px] sm:max-h-[350px] overflow-y-auto text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
        style={{ direction: isAr ? "rtl" : "ltr" }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(agreementContent)) }}
      />

      {/* Read full agreement button */}
      <button
        onClick={() => setShowAgreement(true)}
        className="text-sm text-[#3ECFC0] hover:text-[#2ab5a6] font-medium underline underline-offset-4 transition-colors"
      >
        {isAr ? "قراءة الاتفاقية كاملة" : "Read full agreement"}
      </button>

      {/* Checkbox */}
      <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${agreedToTerms ? "border-[#3ECFC0] bg-[#3ECFC0]/5" : "border-gray-200 dark:border-gray-700"}`}>
        <Checkbox
          id="agree-terms"
          checked={agreedToTerms}
          onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
          className="mt-0.5 data-[state=checked]:bg-[#3ECFC0] data-[state=checked]:border-[#3ECFC0]"
        />
        <label htmlFor="agree-terms" className="text-sm font-medium cursor-pointer leading-relaxed select-none">
          {isAr
            ? "أقر بأنني قرأت وأوافق على اتفاقية الخصوصية وشروط تقديم العقار المذكورة أعلاه"
            : "I confirm that I have read and agree to the Privacy Agreement and Property Submission Terms stated above"}
        </label>
      </div>

      {!agreedToTerms && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {isAr ? "يجب الموافقة على الشروط للمتابعة" : "You must agree to the terms to continue"}
        </p>
      )}

      {/* Summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-3 bg-white dark:bg-gray-900">
        <h4 className="font-bold text-sm text-[#0B1E2D] dark:text-white mb-3">
          {isAr ? "ملخص الطلب" : "Request Summary"}
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="text-muted-foreground">{isAr ? "الاسم:" : "Name:"}</div>
          <div className="font-medium">{isAr ? form.ownerNameAr : form.ownerName}</div>
          <div className="text-muted-foreground">{isAr ? "الهاتف:" : "Phone:"}</div>
          <div className="font-medium" dir="ltr">{form.phone}</div>
          {form.email && (
            <>
              <div className="text-muted-foreground">{isAr ? "البريد:" : "Email:"}</div>
              <div className="font-medium" dir="ltr">{form.email}</div>
            </>
          )}
          <div className="text-muted-foreground">{isAr ? "المدينة:" : "City:"}</div>
          <div className="font-medium">{isAr ? form.cityAr : form.city}</div>
          {(form.district || form.districtAr) && (
            <>
              <div className="text-muted-foreground">{isAr ? "الحي:" : "District:"}</div>
              <div className="font-medium">{isAr ? form.districtAr : form.district}</div>
            </>
          )}
          {form.propertyType && (
            <>
              <div className="text-muted-foreground">{isAr ? "نوع العقار:" : "Type:"}</div>
              <div className="font-medium">{propertyTypes.find(p => p.value === form.propertyType)?.[isAr ? "labelAr" : "labelEn"]}</div>
            </>
          )}
          {form.bedrooms && (
            <>
              <div className="text-muted-foreground">{isAr ? "غرف النوم:" : "Bedrooms:"}</div>
              <div className="font-medium">{form.bedrooms}</div>
            </>
          )}
          {form.desiredMonthlyRent && (
            <>
              <div className="text-muted-foreground">{isAr ? "الإيجار:" : "Rent:"}</div>
              <div className="font-medium">{form.desiredMonthlyRent} {isAr ? "ر.س" : "SAR"}</div>
            </>
          )}
          <div className="text-muted-foreground">{isAr ? "الصور:" : "Photos:"}</div>
          <div className="font-medium">{form.photos.length} {isAr ? "صورة" : "photo(s)"}</div>
        </div>
      </div>
    </div>
  );

  /* ─── Main Render ─── */
  return (
    <>
      <SEOHead
        title={isAr ? "أضف عقارك | المفتاح الشهري" : "List Your Property | Monthly Key"}
        description={isAr ? "سجّل عقارك معنا واحصل على مستأجرين موثوقين" : "List your property with us and get reliable tenants"}
      />
      <Navbar />

      {/* Draft Restore Prompt */}
      <Dialog open={showDraftPrompt} onOpenChange={setShowDraftPrompt}>
        <DialogContent className="max-w-sm" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-[#3ECFC0]" />
              {isAr ? "مسودة محفوظة" : "Saved Draft Found"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "وجدنا مسودة محفوظة من طلب سابق. هل تريد استعادتها أو البدء من جديد؟"
              : "We found a saved draft from a previous submission. Would you like to restore it or start fresh?"}
          </p>
          <div className="flex gap-3 mt-4">
            <Button onClick={loadDraft} className="flex-1 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
              <Save className="h-4 w-4 me-2" />
              {isAr ? "استعادة المسودة" : "Restore Draft"}
            </Button>
            <Button onClick={() => { clearDraft(); setShowDraftPrompt(false); }} variant="outline" className="flex-1">
              {isAr ? "بدء جديد" : "Start Fresh"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Agreement Dialog */}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#3ECFC0]" />
              {isAr ? "اتفاقية الخصوصية وشروط التقديم" : "Privacy Agreement & Submission Terms"}
            </DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
            style={{ direction: isAr ? "rtl" : "ltr" }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(agreementContent)) }}
          />
          <div className="flex justify-end mt-4">
            <Button onClick={() => setShowAgreement(false)} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
              {isAr ? "إغلاق" : "Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gradient-to-b from-[#0B1E2D] via-[#0f2a3d] to-background" dir={dir}>
        {/* Hero Section */}
        <div className="relative overflow-hidden pt-8 pb-20 sm:pt-12 sm:pb-28 px-4">
          {/* Decorative elements */}
          <div className="absolute top-0 start-0 w-full h-full">
            <div className="absolute top-10 start-[10%] w-64 h-64 rounded-full bg-[#3ECFC0]/5 blur-3xl" />
            <div className="absolute bottom-0 end-[20%] w-80 h-80 rounded-full bg-[#C9A96E]/5 blur-3xl" />
          </div>

          <div className="max-w-2xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Building2 className="h-4 w-4 text-[#3ECFC0]" />
              <span className="text-white/80 text-sm font-medium">
                {isAr ? "المفتاح الشهري" : "Monthly Key"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              {isAr ? "أضف عقارك" : "List Your Property"}
            </h1>
            <p className="text-white/70 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
              {isAr
                ? "أدخل بيانات عقارك وسيتواصل معك فريقنا خلال 24 ساعة لإتمام عملية التسجيل"
                : "Enter your property details and our team will contact you within 24 hours to complete the listing"}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div ref={formTopRef} className="max-w-2xl mx-auto px-4 -mt-12 sm:-mt-16 pb-16 relative z-10">
          <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
            {/* Step Indicator - Mobile (horizontal scroll) */}
            <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-4 overflow-x-auto">
              <div className="flex items-center justify-between min-w-[400px] sm:min-w-0">
                {stepsMeta.map((step, idx) => {
                  const StepIcon = step.Icon;
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  return (
                    <div key={step.id} className="flex items-center">
                      <button
                        onClick={() => {
                          // Allow going back to completed steps
                          if (isCompleted || isActive) setCurrentStep(step.id);
                        }}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${isActive || isCompleted ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isActive
                            ? "bg-[#3ECFC0] text-[#0B1E2D] shadow-md shadow-[#3ECFC0]/30 scale-110"
                            : isCompleted
                              ? "bg-[#3ECFC0]/20 text-[#3ECFC0]"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          ) : (
                            <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                          )}
                        </div>
                        <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
                          isActive ? "text-[#3ECFC0]" : isCompleted ? "text-[#3ECFC0]/70" : "text-gray-400"
                        }`}>
                          {isAr ? step.labelAr : step.labelEn}
                        </span>
                      </button>
                      {idx < stepsMeta.length - 1 && (
                        <div className={`w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 rounded-full transition-colors duration-300 ${
                          currentStep > step.id ? "bg-[#3ECFC0]" : "bg-gray-200 dark:bg-gray-700"
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Progress Text */}
            <div className="px-6 sm:px-8 pt-5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isAr ? `الخطوة ${currentStep} من 5` : `Step ${currentStep} of 5`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={saveDraft}
                className="text-xs text-[#3ECFC0] hover:text-[#2ab5a6] hover:bg-[#3ECFC0]/5 h-8 gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {isAr ? "حفظ مسودة" : "Save Draft"}
              </Button>
            </div>

            {/* Step Content */}
            <CardContent className="p-6 sm:p-8">
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                {currentStep > 1 ? (
                  <Button
                    variant="outline"
                    onClick={goPrev}
                    className="h-11 sm:h-12 px-5 sm:px-6 gap-2 text-sm sm:text-base"
                  >
                    {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {isAr ? "السابق" : "Previous"}
                  </Button>
                ) : (
                  <div />
                )}

                {currentStep < 5 ? (
                  <Button
                    onClick={goNext}
                    className="h-11 sm:h-12 px-6 sm:px-8 gap-2 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] text-sm sm:text-base font-semibold"
                  >
                    {isAr ? "التالي" : "Next"}
                    {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={saving || !agreedToTerms}
                    className="h-11 sm:h-12 px-6 sm:px-8 gap-2 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] text-sm sm:text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isAr ? "إرسال الطلب" : "Submit Request"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-[#3ECFC0]" />
              <span>{isAr ? "بياناتك محمية" : "Your data is protected"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-[#3ECFC0]" />
              <span>{isAr ? "تقييم مجاني" : "Free assessment"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-[#3ECFC0]" />
              <span>{isAr ? "رد خلال 24 ساعة" : "Response within 24h"}</span>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
