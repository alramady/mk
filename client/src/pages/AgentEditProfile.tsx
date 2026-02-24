import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  UserCog, Save, Loader2, Phone, Mail, MessageSquare, Camera, CheckCircle
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useRoute } from "wouter";

export default function AgentEditProfile() {
  const { lang } = useI18n();
  const [, params] = useRoute("/agent/edit/:token");
  const token = params?.token || "";

  const { data: manager, isLoading, refetch } = trpc.propertyManager.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const updateProfile = trpc.propertyManager.updateSelfProfile.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully");
      refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const uploadPhoto = trpc.propertyManager.uploadSelfPhoto.useMutation({
    onSuccess: (data) => {
      setPhotoUrl(data.url);
      toast.success(lang === "ar" ? "تم رفع الصورة" : "Photo uploaded");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bio, setBio] = useState("");
  const [bioAr, setBioAr] = useState("");
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (manager && !initialized) {
      setPhone(manager.phone || "");
      setWhatsapp(manager.whatsapp || "");
      setBio(manager.bio || "");
      setBioAr(manager.bioAr || "");
      setTitle(manager.title || "");
      setTitleAr(manager.titleAr || "");
      setPhotoUrl(manager.photoUrl || "");
      setInitialized(true);
    }
  }, [manager, initialized]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await uploadPhoto.mutateAsync({ token, base64, filename: file.name, contentType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateProfile.mutate({
      token,
      phone: phone || undefined,
      whatsapp: whatsapp || undefined,
      bio: bio || undefined,
      bioAr: bioAr || undefined,
      title: title || undefined,
      titleAr: titleAr || undefined,
      photoUrl: photoUrl || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8 max-w-2xl mx-auto">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!manager) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <UserCog className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-heading font-bold mb-2">
            {lang === "ar" ? "رابط غير صالح أو منتهي الصلاحية" : "Invalid or Expired Link"}
          </h2>
          <p className="text-muted-foreground">
            {lang === "ar"
              ? "يرجى التواصل مع المسؤول للحصول على رابط جديد"
              : "Please contact the administrator for a new link"}
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  const name = lang === "ar" ? (manager.nameAr || manager.name) : manager.name;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <Navbar />
      <div className="container py-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-heading font-bold flex items-center justify-center gap-2">
            <UserCog className="h-6 w-6 text-[#3ECFC0]" />
            {lang === "ar" ? "تعديل البروفايل" : "Edit Profile"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "ar" ? `مرحباً ${name}` : `Welcome ${name}`}
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 space-y-6">
            {/* Photo Section */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                {photoUrl ? (
                  <img src={photoUrl} alt={name} className="w-28 h-28 rounded-xl object-cover border-2 border-[#3ECFC0]/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                ) : null}
                <div className={`w-28 h-28 rounded-xl bg-gradient-to-br from-[#3ECFC0] to-[#2ab5a6] flex items-center justify-center text-white font-bold text-3xl select-none ${photoUrl ? 'hidden' : ''}`}>
                  {(manager?.name || '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'PM'}
                </div>
                <button
                  className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
              </div>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhoto.isPending}>
                {uploadPhoto.isPending ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : <Camera className="h-3 w-3 me-1" />}
                {lang === "ar" ? "تغيير الصورة" : "Change Photo"}
              </Button>
            </div>

            <Separator />

            {/* Name (read-only) */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">{lang === "ar" ? "الاسم" : "Name"}</p>
              <p className="font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar" ? "لتغيير الاسم تواصل مع المسؤول" : "Contact admin to change name"}
              </p>
            </div>

            {/* Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  {lang === "ar" ? "المسمى الوظيفي (EN)" : "Job Title (EN)"}
                </Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Property Manager" />
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  {lang === "ar" ? "المسمى الوظيفي (AR)" : "Job Title (AR)"}
                </Label>
                <Input value={titleAr} onChange={e => setTitleAr(e.target.value)} placeholder="مدير العقار" dir="rtl" />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {lang === "ar" ? "رقم الهاتف" : "Phone"}
                </Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+966..." dir="ltr" />
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {lang === "ar" ? "واتساب" : "WhatsApp"}
                </Label>
                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+966..." dir="ltr" />
              </div>
            </div>

            {/* Bio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  {lang === "ar" ? "نبذة عنك (EN)" : "About You (EN)"}
                </Label>
                <Textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
                  placeholder={lang === "ar" ? "اكتب نبذة عنك بالإنجليزية..." : "Write about yourself in English..."} />
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  {lang === "ar" ? "نبذة عنك (AR)" : "About You (AR)"}
                </Label>
                <Textarea value={bioAr} onChange={e => setBioAr(e.target.value)} rows={4} dir="rtl"
                  placeholder={lang === "ar" ? "اكتب نبذة عنك بالعربية..." : "Write about yourself in Arabic..."} />
              </div>
            </div>

            <Separator />

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateProfile.isPending}
                className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] gap-2 min-w-[140px]"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saved
                  ? (lang === "ar" ? "تم الحفظ" : "Saved!")
                  : (lang === "ar" ? "حفظ التغييرات" : "Save Changes")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
