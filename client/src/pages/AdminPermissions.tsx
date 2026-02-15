import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowRight, Shield, Plus, Pencil, Trash2, Users, Check, X, ChevronDown, ChevronUp } from "lucide-react";

// All available permissions
const ALL_PERMISSIONS = [
  { group: "العقارات", groupEn: "Properties", items: [
    { key: "properties.view", label: "عرض العقارات", labelEn: "View Properties" },
    { key: "properties.create", label: "إضافة عقار", labelEn: "Create Property" },
    { key: "properties.edit", label: "تعديل عقار", labelEn: "Edit Property" },
    { key: "properties.delete", label: "حذف عقار", labelEn: "Delete Property" },
  ]},
  { group: "الحجوزات", groupEn: "Bookings", items: [
    { key: "bookings.view", label: "عرض الحجوزات", labelEn: "View Bookings" },
    { key: "bookings.create", label: "إنشاء حجز", labelEn: "Create Booking" },
    { key: "bookings.approve", label: "الموافقة على الحجوزات", labelEn: "Approve Bookings" },
    { key: "bookings.cancel", label: "إلغاء الحجوزات", labelEn: "Cancel Bookings" },
  ]},
  { group: "المستخدمين", groupEn: "Users", items: [
    { key: "users.view", label: "عرض المستخدمين", labelEn: "View Users" },
    { key: "users.edit", label: "تعديل المستخدمين", labelEn: "Edit Users" },
    { key: "users.delete", label: "حذف المستخدمين", labelEn: "Delete Users" },
    { key: "users.roles", label: "إدارة الأدوار", labelEn: "Manage Roles" },
  ]},
  { group: "المدفوعات", groupEn: "Payments", items: [
    { key: "payments.view", label: "عرض المدفوعات", labelEn: "View Payments" },
    { key: "payments.process", label: "معالجة المدفوعات", labelEn: "Process Payments" },
  ]},
  { group: "الخدمات", groupEn: "Services", items: [
    { key: "services.view", label: "عرض الخدمات", labelEn: "View Services" },
    { key: "services.manage", label: "إدارة الخدمات", labelEn: "Manage Services" },
  ]},
  { group: "الصيانة", groupEn: "Maintenance", items: [
    { key: "maintenance.view", label: "عرض الصيانة", labelEn: "View Maintenance" },
    { key: "maintenance.manage", label: "إدارة الصيانة", labelEn: "Manage Maintenance" },
  ]},
  { group: "الإعدادات", groupEn: "Settings", items: [
    { key: "settings.view", label: "عرض الإعدادات", labelEn: "View Settings" },
    { key: "settings.edit", label: "تعديل الإعدادات", labelEn: "Edit Settings" },
  ]},
  { group: "أخرى", groupEn: "Other", items: [
    { key: "analytics.view", label: "عرض التحليلات", labelEn: "View Analytics" },
    { key: "notifications.send", label: "إرسال الإشعارات", labelEn: "Send Notifications" },
    { key: "cms.edit", label: "تعديل المحتوى", labelEn: "Edit CMS" },
  ]},
];

function PermissionMatrix({ selected, onChange }: { selected: string[]; onChange: (perms: string[]) => void }) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(ALL_PERMISSIONS.map(g => g.group));

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
  };

  const togglePermission = (key: string) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };

  const toggleGroupAll = (items: { key: string }[]) => {
    const allSelected = items.every(i => selected.includes(i.key));
    if (allSelected) {
      onChange(selected.filter(k => !items.some(i => i.key === k)));
    } else {
      const newPerms = [...selected];
      items.forEach(i => { if (!newPerms.includes(i.key)) newPerms.push(i.key); });
      onChange(newPerms);
    }
  };

  return (
    <div className="space-y-2">
      {ALL_PERMISSIONS.map(group => {
        const isExpanded = expandedGroups.includes(group.group);
        const allSelected = group.items.every(i => selected.includes(i.key));
        const someSelected = group.items.some(i => selected.includes(i.key));
        return (
          <div key={group.group} className="border rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
              onClick={() => toggleGroup(group.group)}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleGroupAll(group.items); }}
                  className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${
                    allSelected ? 'bg-primary border-primary text-primary-foreground' :
                    someSelected ? 'bg-primary/30 border-primary' : 'border-muted-foreground/30'
                  }`}
                >
                  {allSelected && <Check className="w-3 h-3" />}
                  {someSelected && !allSelected && <span className="w-2 h-0.5 bg-primary block" />}
                </button>
                <span className="font-medium">{group.group}</span>
                <span className="text-xs text-muted-foreground">({group.groupEn})</span>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {isExpanded && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map(item => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/30">
                    <button
                      type="button"
                      onClick={() => togglePermission(item.key)}
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selected.includes(item.key) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                      }`}
                    >
                      {selected.includes(item.key) && <Check className="w-3 h-3" />}
                    </button>
                    <span className="text-sm">{item.label}</span>
                    <span className="text-xs text-muted-foreground">({item.labelEn})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPermissions() {
  const { user } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [newRole, setNewRole] = useState({ name: "", nameAr: "", description: "", descriptionAr: "", permissions: [] as string[] });

  const rolesQuery = trpc.roles.list.useQuery();
  const adminsQuery = trpc.permissions.list.useQuery();
  const createMutation = trpc.roles.create.useMutation({
    onSuccess: () => { rolesQuery.refetch(); setCreateOpen(false); setNewRole({ name: "", nameAr: "", description: "", descriptionAr: "", permissions: [] }); toast.success("تم إنشاء الدور بنجاح"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.roles.update.useMutation({
    onSuccess: () => { rolesQuery.refetch(); setEditRole(null); toast.success("تم تحديث الدور بنجاح"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.roles.delete.useMutation({
    onSuccess: () => { rolesQuery.refetch(); toast.success("تم حذف الدور"); },
    onError: (e) => toast.error(e.message),
  });
  const assignMutation = trpc.roles.assignToUser.useMutation({
    onSuccess: () => { adminsQuery.refetch(); toast.success("تم تعيين الدور بنجاح"); },
    onError: (e) => toast.error(e.message),
  });

  if (!user || user.role !== "admin") {
    return (
      <>
        <Navbar />
        <div className="container py-20 text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">غير مصرح</h1>
          <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤولين فقط</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container py-8 space-y-8" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><ArrowRight className="w-5 h-5" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                إدارة الأدوار والصلاحيات
              </h1>
              <p className="text-muted-foreground">إنشاء وتعديل الأدوار وتعيين الصلاحيات للمستخدمين</p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />دور جديد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء دور جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>اسم الدور (عربي)</Label>
                    <Input value={newRole.nameAr} onChange={e => setNewRole(p => ({ ...p, nameAr: e.target.value }))} placeholder="مثال: مدير عقارات" />
                  </div>
                  <div>
                    <Label>Role Name (English)</Label>
                    <Input value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Property Manager" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الوصف (عربي)</Label>
                    <Textarea value={newRole.descriptionAr} onChange={e => setNewRole(p => ({ ...p, descriptionAr: e.target.value }))} rows={2} />
                  </div>
                  <div>
                    <Label>Description (English)</Label>
                    <Textarea value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} rows={2} />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">الصلاحيات</Label>
                  <PermissionMatrix selected={newRole.permissions} onChange={perms => setNewRole(p => ({ ...p, permissions: perms }))} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                <Button onClick={() => createMutation.mutate(newRole)} disabled={!newRole.name || !newRole.nameAr || createMutation.isPending}>
                  {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rolesQuery.data?.map((role: any) => (
            <Card key={role.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{role.nameAr}</CardTitle>
                  <div className="flex gap-1">
                    {role.isSystem && <Badge variant="secondary">نظامي</Badge>}
                    {role.isActive === false && <Badge variant="destructive">معطل</Badge>}
                  </div>
                </div>
                <CardDescription>{role.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{role.descriptionAr || role.description || "بدون وصف"}</p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {(role.permissions || []).slice(0, 5).map((p: string) => (
                    <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                  ))}
                  {(role.permissions || []).length > 5 && (
                    <Badge variant="outline" className="text-xs">+{role.permissions.length - 5}</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Dialog open={editRole?.id === role.id} onOpenChange={(open) => {
                    if (open) setEditRole({ ...role, permissions: [...(role.permissions || [])] });
                    else setEditRole(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Pencil className="w-3 h-3 ml-1" />تعديل</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                      <DialogHeader>
                        <DialogTitle>تعديل الدور: {role.nameAr}</DialogTitle>
                      </DialogHeader>
                      {editRole && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>اسم الدور (عربي)</Label>
                              <Input value={editRole.nameAr} onChange={e => setEditRole((p: any) => ({ ...p, nameAr: e.target.value }))} disabled={role.isSystem} />
                            </div>
                            <div>
                              <Label>Role Name</Label>
                              <Input value={editRole.name} onChange={e => setEditRole((p: any) => ({ ...p, name: e.target.value }))} disabled={role.isSystem} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>الوصف (عربي)</Label>
                              <Textarea value={editRole.descriptionAr || ""} onChange={e => setEditRole((p: any) => ({ ...p, descriptionAr: e.target.value }))} rows={2} />
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Textarea value={editRole.description || ""} onChange={e => setEditRole((p: any) => ({ ...p, description: e.target.value }))} rows={2} />
                            </div>
                          </div>
                          <div>
                            <Label className="mb-2 block">الصلاحيات</Label>
                            <PermissionMatrix selected={editRole.permissions || []} onChange={perms => setEditRole((p: any) => ({ ...p, permissions: perms }))} />
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                        <Button onClick={() => updateMutation.mutate({ id: editRole.id, nameAr: editRole.nameAr, name: editRole.name, description: editRole.description, descriptionAr: editRole.descriptionAr, permissions: editRole.permissions })} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {!role.isSystem && (
                    <Button variant="destructive" size="sm" onClick={() => { if (confirm("هل أنت متأكد من حذف هذا الدور؟")) deleteMutation.mutate({ id: role.id }); }}>
                      <Trash2 className="w-3 h-3 ml-1" />حذف
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Admin Users Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              المسؤولون وصلاحياتهم
            </CardTitle>
            <CardDescription>تعيين الأدوار للمستخدمين المسؤولين</CardDescription>
          </CardHeader>
          <CardContent>
            {adminsQuery.data && adminsQuery.data.length > 0 ? (
              <div className="space-y-3">
                {adminsQuery.data.map((admin: any) => (
                  <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{admin.nameAr || admin.name || admin.displayName}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(admin.permissions || []).slice(0, 4).map((p: string) => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                        {(admin.permissions || []).length > 4 && (
                          <Badge variant="outline" className="text-xs">+{admin.permissions.length - 4}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rolesQuery.data && (
                        <select
                          className="border rounded px-3 py-1.5 text-sm bg-background"
                          onChange={(e) => {
                            if (e.target.value) {
                              assignMutation.mutate({ userId: admin.id, roleId: parseInt(e.target.value) });
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>تعيين دور...</option>
                          {rolesQuery.data.map((role: any) => (
                            <option key={role.id} value={role.id}>{role.nameAr}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد مسؤولون حالياً</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}
