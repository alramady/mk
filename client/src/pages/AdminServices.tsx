import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Wrench, Sparkles, Truck, Sofa, Package, Loader2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";

const categoryIcons: Record<string, any> = {
  cleaning: Sparkles, maintenance: Wrench, furniture: Sofa, moving: Truck, other: Package,
};
const categoryLabels: Record<string, { en: string; ar: string }> = {
  cleaning: { en: "Cleaning", ar: "تنظيف" },
  maintenance: { en: "Maintenance", ar: "صيانة" },
  furniture: { en: "Furniture", ar: "أثاث" },
  moving: { en: "Moving", ar: "نقل" },
  other: { en: "Other", ar: "أخرى" },
};

const statusLabels: Record<string, { en: string; ar: string; color: string }> = {
  pending: { en: "Pending", ar: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800" },
  approved: { en: "Approved", ar: "مقبول", color: "bg-blue-100 text-blue-800" },
  in_progress: { en: "In Progress", ar: "قيد التنفيذ", color: "bg-purple-100 text-purple-800" },
  completed: { en: "Completed", ar: "مكتمل", color: "bg-green-100 text-green-800" },
  cancelled: { en: "Cancelled", ar: "ملغي", color: "bg-red-100 text-red-800" },
};

export default function AdminServices() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [form, setForm] = useState({ nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", price: "", category: "other" as string, isActive: true, sortOrder: 0 });

  const services = trpc.services.listAll.useQuery();
  const serviceRequests = trpc.serviceRequests.listAll.useQuery();
  const utils = trpc.useUtils();

  const createService = trpc.services.create.useMutation({
    onSuccess: () => { utils.services.listAll.invalidate(); setDialogOpen(false); resetForm(); toast.success(lang === "ar" ? "تم إضافة الخدمة" : "Service added"); },
  });
  const updateService = trpc.services.update.useMutation({
    onSuccess: () => { utils.services.listAll.invalidate(); setDialogOpen(false); resetForm(); toast.success(lang === "ar" ? "تم تحديث الخدمة" : "Service updated"); },
  });
  const deleteService = trpc.services.delete.useMutation({
    onSuccess: () => { utils.services.listAll.invalidate(); toast.success(lang === "ar" ? "تم حذف الخدمة" : "Service deleted"); },
  });
  const updateRequestStatus = trpc.serviceRequests.updateStatus.useMutation({
    onSuccess: () => { utils.serviceRequests.listAll.invalidate(); toast.success(lang === "ar" ? "تم تحديث الحالة" : "Status updated"); },
  });

  const resetForm = () => {
    setForm({ nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", price: "", category: "other", isActive: true, sortOrder: 0 });
    setEditingService(null);
  };

  const openEdit = (s: any) => {
    setEditingService(s);
    setForm({ nameAr: s.nameAr, nameEn: s.nameEn, descriptionAr: s.descriptionAr || "", descriptionEn: s.descriptionEn || "", price: String(s.price), category: s.category, isActive: s.isActive, sortOrder: s.sortOrder || 0 });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nameAr || !form.nameEn || !form.price) { toast.error(lang === "ar" ? "يرجى تعبئة الحقول المطلوبة" : "Please fill required fields"); return; }
    if (editingService) {
      updateService.mutate({ id: editingService.id, ...form, category: form.category as any });
    } else {
      createService.mutate(form as any);
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <SEOHead title={lang === "ar" ? "إدارة الخدمات" : "Services Management"} />
      <div className="container py-6 flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{lang === "ar" ? "رجوع" : "Back"}</Button>
          </Link>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-heading font-bold">
              <Wrench className="h-6 w-6 text-[#3ECFC0] inline me-2" />
              {lang === "ar" ? "إدارة الخدمات" : "Services Management"}
            </h1>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]"><Plus className="h-4 w-4 me-2" />{lang === "ar" ? "إضافة خدمة" : "Add Service"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingService ? (lang === "ar" ? "تعديل الخدمة" : "Edit Service") : (lang === "ar" ? "إضافة خدمة جديدة" : "Add New Service")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{lang === "ar" ? "الاسم بالعربي *" : "Name (AR) *"}</Label><Input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} placeholder="تنظيف شقة" /></div>
                  <div><Label>{lang === "ar" ? "الاسم بالإنجليزي *" : "Name (EN) *"}</Label><Input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="Apartment Cleaning" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{lang === "ar" ? "الوصف بالعربي" : "Description (AR)"}</Label><Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={2} /></div>
                  <div><Label>{lang === "ar" ? "الوصف بالإنجليزي" : "Description (EN)"}</Label><Textarea value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} rows={2} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{lang === "ar" ? "السعر (ر.س) *" : "Price (SAR) *"}</Label><Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="150" /></div>
                  <div>
                    <Label>{lang === "ar" ? "التصنيف" : "Category"}</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{lang === "ar" ? v.ar : v.en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
                  <Label>{lang === "ar" ? "نشط" : "Active"}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
                <Button onClick={handleSubmit} disabled={createService.isPending || updateService.isPending} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
                  {(createService.isPending || updateService.isPending) && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {editingService ? (lang === "ar" ? "تحديث" : "Update") : (lang === "ar" ? "إضافة" : "Add")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="services">
          <TabsList>
            <TabsTrigger value="services">{lang === "ar" ? "الخدمات" : "Services"} ({services.data?.length || 0})</TabsTrigger>
            <TabsTrigger value="requests">{lang === "ar" ? "طلبات الخدمات" : "Service Requests"} ({serviceRequests.data?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="mt-4">
            {services.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#3ECFC0]" /></div>
            ) : services.data && services.data.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.data.map((s) => {
                  const Icon = categoryIcons[s.category] || Package;
                  return (
                    <Card key={s.id} className={`transition-all ${!s.isActive ? "opacity-60" : ""}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#3ECFC0]/10 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-[#3ECFC0]" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{lang === "ar" ? s.nameAr : s.nameEn}</h3>
                              <Badge variant="outline" className="text-xs">{lang === "ar" ? categoryLabels[s.category]?.ar : categoryLabels[s.category]?.en}</Badge>
                            </div>
                          </div>
                          {!s.isActive && <Badge variant="secondary">{lang === "ar" ? "غير نشط" : "Inactive"}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{lang === "ar" ? s.descriptionAr : s.descriptionEn}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-[#C9A96E]">{Number(s.price).toLocaleString()} <span className="text-xs">{lang === "ar" ? "ر.س" : "SAR"}</span></span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(s)}><Edit className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { if (confirm(lang === "ar" ? "حذف هذه الخدمة؟" : "Delete this service?")) deleteService.mutate({ id: s.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد خدمات بعد" : "No services yet"}</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            {serviceRequests.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#3ECFC0]" /></div>
            ) : serviceRequests.data && serviceRequests.data.length > 0 ? (
              <div className="space-y-3">
                {serviceRequests.data.map((r) => {
                  const svc = services.data?.find(s => s.id === r.serviceId);
                  const st = statusLabels[r.status] || statusLabels.pending;
                  return (
                    <Card key={r.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">#{r.id} — {svc ? (lang === "ar" ? svc.nameAr : svc.nameEn) : `Service #${r.serviceId}`}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{lang === "ar" ? st.ar : st.en}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {lang === "ar" ? `المستأجر #${r.tenantId}` : `Tenant #${r.tenantId}`} • {new Date(r.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                            </div>
                            {r.notes && <p className="text-sm mt-1">{r.notes}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#C9A96E]">{Number(r.totalPrice).toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                            <Select value={r.status} onValueChange={(v) => updateRequestStatus.mutate({ id: r.id, status: v as any })}>
                              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{lang === "ar" ? v.ar : v.en}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{lang === "ar" ? "لا توجد طلبات خدمات" : "No service requests yet"}</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
}
