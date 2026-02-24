import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  UserCog, Plus, Pencil, Trash2, Building2, Phone, Mail, Link2,
  Copy, Check, ArrowLeft, ArrowRight, Loader2, Shield, Eye, MessageSquare
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function AdminManagers() {
  const { t, lang, dir } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();

  const managers = trpc.propertyManager.listWithCounts.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const properties = trpc.admin.properties.useQuery({ limit: 500 }, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const createMgr = trpc.propertyManager.create.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم إنشاء الموظف" : "Manager created"); utils.propertyManager.listWithCounts.invalidate(); setShowCreate(false); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateMgr = trpc.propertyManager.update.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم التحديث" : "Updated"); utils.propertyManager.listWithCounts.invalidate(); setEditingId(null); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMgr = trpc.propertyManager.delete.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم الحذف" : "Deleted"); utils.propertyManager.listWithCounts.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  const assignProp = trpc.propertyManager.assign.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم التعيين" : "Assigned"); utils.propertyManager.listWithCounts.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  // For unassign, we reassign with the remaining property IDs
  const reassignProp = trpc.propertyManager.assign.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم إلغاء التعيين" : "Unassigned"); utils.propertyManager.listWithCounts.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const genLink = trpc.propertyManager.generateEditLink.useMutation({
    onError: (err: any) => toast.error(err.message),
  });
  const uploadPhoto = trpc.propertyManager.uploadPhoto.useMutation({
    onError: (err: any) => toast.error(err.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedPropId, setSelectedPropId] = useState<string>("");
  const [editLink, setEditLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNameAr, setFormNameAr] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTitle, setFormTitle] = useState("Property Manager");
  const [formTitleAr, setFormTitleAr] = useState("مدير العقار");
  const [formBio, setFormBio] = useState("");
  const [formBioAr, setFormBioAr] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  const resetForm = () => {
    setFormName(""); setFormNameAr(""); setFormPhone(""); setFormWhatsapp("");
    setFormEmail(""); setFormTitle("Property Manager"); setFormTitleAr("مدير العقار");
    setFormBio(""); setFormBioAr(""); setFormPhotoUrl("");
  };

  const fillEditForm = (mgr: any) => {
    setFormName(mgr.name || ""); setFormNameAr(mgr.nameAr || ""); setFormPhone(mgr.phone || "");
    setFormWhatsapp(mgr.whatsapp || ""); setFormEmail(mgr.email || "");
    setFormTitle(mgr.title || "Property Manager"); setFormTitleAr(mgr.titleAr || "مدير العقار");
    setFormBio(mgr.bio || ""); setFormBioAr(mgr.bioAr || ""); setFormPhotoUrl(mgr.photoUrl || "");
    setEditingId(mgr.id);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await uploadPhoto.mutateAsync({ base64, filename: file.name, contentType: file.type });
      setFormPhotoUrl(res.url);
      toast.success(lang === "ar" ? "تم رفع الصورة" : "Photo uploaded");
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!formName || !formNameAr || !formPhone) {
      toast.error(lang === "ar" ? "الاسم والهاتف مطلوبان" : "Name and phone are required");
      return;
    }
    createMgr.mutate({
      name: formName, nameAr: formNameAr, phone: formPhone,
      whatsapp: formWhatsapp || undefined, email: formEmail || undefined,
      title: formTitle, titleAr: formTitleAr,
      bio: formBio || undefined, bioAr: formBioAr || undefined,
      photoUrl: formPhotoUrl || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateMgr.mutate({
      id: editingId, name: formName, nameAr: formNameAr, phone: formPhone,
      whatsapp: formWhatsapp || undefined, email: formEmail || undefined,
      title: formTitle, titleAr: formTitleAr,
      bio: formBio || undefined, bioAr: formBioAr || undefined,
      photoUrl: formPhotoUrl || undefined,
    });
  };

  const handleGenerateLink = async (managerId: number) => {
    const res = await genLink.mutateAsync({ managerId });
    const link = `${window.location.origin}/agent/edit/${res.token}`;
    setEditLink(link);
    setCopiedLink(false);
  };

  const copyLink = () => {
    if (editLink) {
      navigator.clipboard.writeText(editLink);
      setCopiedLink(true);
      toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied");
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-heading font-bold mb-2">{lang === "ar" ? "غير مصرح" : "Unauthorized"}</h2>
        </div>
        <Footer />
      </div>
    );
  }

  const ManagerForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{lang === "ar" ? "الاسم (EN)" : "Name (EN)"}</Label>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Doe" />
        </div>
        <div>
          <Label>{lang === "ar" ? "الاسم (AR)" : "Name (AR)"}</Label>
          <Input value={formNameAr} onChange={e => setFormNameAr(e.target.value)} placeholder="محمد أحمد" dir="rtl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{lang === "ar" ? "المسمى الوظيفي (EN)" : "Title (EN)"}</Label>
          <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} />
        </div>
        <div>
          <Label>{lang === "ar" ? "المسمى الوظيفي (AR)" : "Title (AR)"}</Label>
          <Input value={formTitleAr} onChange={e => setFormTitleAr(e.target.value)} dir="rtl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>{lang === "ar" ? "الهاتف" : "Phone"}</Label>
          <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+966..." dir="ltr" />
        </div>
        <div>
          <Label>{lang === "ar" ? "واتساب" : "WhatsApp"}</Label>
          <Input value={formWhatsapp} onChange={e => setFormWhatsapp(e.target.value)} placeholder="+966..." dir="ltr" />
        </div>
        <div>
          <Label>{lang === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
          <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@example.com" dir="ltr" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{lang === "ar" ? "نبذة (EN)" : "Bio (EN)"}</Label>
          <Textarea value={formBio} onChange={e => setFormBio(e.target.value)} rows={3} />
        </div>
        <div>
          <Label>{lang === "ar" ? "نبذة (AR)" : "Bio (AR)"}</Label>
          <Textarea value={formBioAr} onChange={e => setFormBioAr(e.target.value)} rows={3} dir="rtl" />
        </div>
      </div>
      <div>
        <Label>{lang === "ar" ? "الصورة الشخصية" : "Profile Photo"}</Label>
        <div className="flex items-center gap-3 mt-1">
          {formPhotoUrl && (
            <img src={formPhotoUrl} alt="preview" className="w-16 h-16 rounded-lg object-cover border" />
          )}
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
            disabled={uploadPhoto.isPending}>
            {uploadPhoto.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
            {lang === "ar" ? "رفع صورة" : "Upload Photo"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm"><BackArrow className="h-4 w-4 me-1" />{t("common.back")}</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <UserCog className="h-6 w-6 text-[#3ECFC0]" />
              {lang === "ar" ? "إدارة مدراء العقارات" : "Property Managers"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {lang === "ar" ? "إضافة وتعديل الموظفين وتعيينهم على العقارات" : "Add, edit managers and assign them to properties"}
            </p>
          </div>
          <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] gap-2">
                <Plus className="h-4 w-4" />
                {lang === "ar" ? "إضافة موظف" : "Add Manager"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{lang === "ar" ? "إضافة موظف جديد" : "Add New Manager"}</DialogTitle>
              </DialogHeader>
              <ManagerForm />
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
                <Button onClick={handleCreate} disabled={createMgr.isPending} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
                  {createMgr.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                  {lang === "ar" ? "إنشاء" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Link Dialog */}
        <Dialog open={!!editLink} onOpenChange={(v) => { if (!v) setEditLink(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "رابط تعديل البروفايل" : "Profile Edit Link"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">
              {lang === "ar"
                ? "أرسل هذا الرابط للموظف ليتمكن من تعديل بروفايله بنفسه:"
                : "Send this link to the manager so they can edit their own profile:"}
            </p>
            <div className="flex items-center gap-2">
              <Input value={editLink || ""} readOnly dir="ltr" className="text-xs font-mono" />
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{lang === "ar" ? "إغلاق" : "Close"}</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Managers List */}
        {managers.isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
        ) : managers.data && managers.data.length > 0 ? (
          <div className="space-y-4">
            {managers.data.map((mgr: any) => (
              <Card key={mgr.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Photo */}
                    <div className="shrink-0">
                      {mgr.photoUrl ? (
                        <img src={mgr.photoUrl} alt={mgr.name} className="w-20 h-20 rounded-xl object-cover border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                      ) : null}
                      <div className={`w-20 h-20 rounded-xl bg-gradient-to-br from-[#3ECFC0] to-[#2ab5a6] flex items-center justify-center text-white font-bold text-2xl select-none ${mgr.photoUrl ? 'hidden' : ''}`}>
                        {(mgr.name || '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'PM'}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-heading font-bold text-lg">{lang === "ar" ? (mgr.nameAr || mgr.name) : mgr.name}</h3>
                          <p className="text-sm text-muted-foreground">{lang === "ar" ? (mgr.titleAr || mgr.title) : mgr.title}</p>
                        </div>
                        <Badge variant={mgr.isActive ? "default" : "secondary"}>
                          {mgr.isActive ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "غير نشط" : "Inactive")}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {mgr.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{mgr.phone}</span>}
                        {mgr.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{mgr.email}</span>}
                        {mgr.whatsapp && <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{mgr.whatsapp}</span>}
                        <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{mgr.propertyCount ?? 0} {lang === "ar" ? "عقار" : "properties"}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Link href={`/agent/${mgr.id}`}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <Eye className="h-3.5 w-3.5" />
                            {lang === "ar" ? "البروفايل" : "Profile"}
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline" className="gap-1.5"
                          onClick={() => fillEditForm(mgr)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {lang === "ar" ? "تعديل" : "Edit"}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5"
                          onClick={() => { setAssigningId(mgr.id); setSelectedPropId(""); }}>
                          <Building2 className="h-3.5 w-3.5" />
                          {lang === "ar" ? "تعيين عقار" : "Assign Property"}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5"
                          onClick={() => handleGenerateLink(mgr.id)}
                          disabled={genLink.isPending}>
                          <Link2 className="h-3.5 w-3.5" />
                          {lang === "ar" ? "رابط التعديل" : "Edit Link"}
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5"
                          onClick={() => { if (confirm(lang === "ar" ? "هل أنت متأكد؟" : "Are you sure?")) deleteMgr.mutate({ id: mgr.id }); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                          {lang === "ar" ? "حذف" : "Delete"}
                        </Button>
                      </div>

                      {/* Assigned Properties */}
                      {mgr.assignedProperties && mgr.assignedProperties.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                            {lang === "ar" ? "العقارات المعينة:" : "Assigned Properties:"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {mgr.assignedProperties.map((ap: any) => (
                              <Badge key={ap.propertyId} variant="secondary" className="gap-1 text-xs">
                                #{ap.propertyId} - {ap.propertyTitle || ""}
                                <button
                                  className="ms-1 hover:text-destructive"
                                  onClick={() => {
                                    const remaining = (mgr.assignedProperties || []).filter((x: any) => x.propertyId !== ap.propertyId).map((x: any) => x.propertyId);
                                    reassignProp.mutate({ managerId: mgr.id, propertyIds: remaining });
                                  }}
                                >×</button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <UserCog className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">
                {lang === "ar" ? "لا يوجد مدراء عقارات" : "No Property Managers"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {lang === "ar" ? "أضف موظفاً جديداً لإدارة العقارات" : "Add a new manager to manage properties"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Edit Manager Dialog */}
        <Dialog open={editingId !== null} onOpenChange={(v) => { if (!v) { setEditingId(null); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "تعديل بيانات الموظف" : "Edit Manager"}</DialogTitle>
            </DialogHeader>
            <ManagerForm isEdit />
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
              <Button onClick={handleUpdate} disabled={updateMgr.isPending} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
                {updateMgr.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                {lang === "ar" ? "حفظ" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Property Dialog */}
        <Dialog open={assigningId !== null} onOpenChange={(v) => { if (!v) setAssigningId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "تعيين عقار" : "Assign Property"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>{lang === "ar" ? "اختر العقار" : "Select Property"}</Label>
              <Select value={selectedPropId} onValueChange={setSelectedPropId}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === "ar" ? "اختر عقاراً..." : "Choose a property..."} />
                </SelectTrigger>
                <SelectContent>
                  {properties.data?.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      #{p.id} - {lang === "ar" ? (p.titleAr || p.title) : p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
              <Button
                onClick={() => {
                  if (assigningId && selectedPropId) {
                    const currentIds = (managers.data?.find((m: any) => m.id === assigningId)?.assignedProperties || []).map((x: any) => x.propertyId);
                    assignProp.mutate({ managerId: assigningId, propertyIds: [...currentIds, Number(selectedPropId)] });
                    setAssigningId(null);
                  }
                }}
                disabled={!selectedPropId || assignProp.isPending}
                className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]"
              >
                {lang === "ar" ? "تعيين" : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </div>
  );
}
