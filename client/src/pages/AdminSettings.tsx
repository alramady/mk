import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  Settings, Image, Palette, DollarSign, FileText, Users, Shield, BarChart3,
  ArrowRight, ArrowLeft, Save, Upload, RefreshCw, Globe, MapPin, BookOpen,
  ChevronDown, ChevronUp, Eye, Trash2, Plus, Search, MessageCircle, Phone
} from "lucide-react";

export default function AdminSettings() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const isRtl = dir === "rtl";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const settingsQuery = trpc.siteSettings.getAll.useQuery();
  const updateMutation = trpc.siteSettings.update.useMutation({
    onSuccess: () => { toast.success(t("settings.saved")); settingsQuery.refetch(); },
  });
  const seedMutation = trpc.siteSettings.seed.useMutation({
    onSuccess: () => { toast.success(t("settings.seeded")); settingsQuery.refetch(); },
  });
  const uploadMutation = trpc.siteSettings.uploadAsset.useMutation({
    onSuccess: (data) => { toast.success(t("settings.saved")); settingsQuery.refetch(); },
  });

  // Admin permissions
  const permsQuery = trpc.permissions.list.useQuery();
  const setPermsMutation = trpc.permissions.set.useMutation({
    onSuccess: () => { toast.success(t("perms.saved")); permsQuery.refetch(); },
    onError: (err) => { toast.error(err.message); },
  });

  // User analytics
  const activityStatsQuery = trpc.activity.stats.useQuery();
  const activityLogQuery = trpc.activity.log.useQuery({ limit: 50 });

  // Districts
  const districtsQuery = trpc.districts.all.useQuery();
  const [districtFilter, setDistrictFilter] = useState("all");

  // Admin users for permissions
  const adminUsersQuery = trpc.admin.users.useQuery({ limit: 100 });

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      const map: Record<string, string> = {};
      const dataArr = Array.isArray(settingsQuery.data) ? settingsQuery.data : Object.values(settingsQuery.data as any);
      (dataArr as any[]).forEach((s: any) => { map[s.key] = s.value; });
      setSettings(map);
      setDirty(false);
    }
  }, [settingsQuery.data]);

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveSettings = () => {
    updateMutation.mutate({ settings });
    setDirty(false);
  };

  const handleFileUpload = (purpose: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadMutation.mutate({ base64, filename: file.name, contentType: file.type, purpose });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Permission management
  const allPermissions = [
    { key: "manage_users", label: t("perms.manageUsers") },
    { key: "manage_properties", label: t("perms.manageProperties") },
    { key: "manage_bookings", label: t("perms.manageBookings") },
    { key: "manage_settings", label: t("perms.manageSettings") },
    { key: "manage_kb", label: t("perms.manageKB") },
    { key: "view_analytics", label: t("perms.viewAnalytics") },
    { key: "manage_payments", label: t("perms.managePayments") },
    { key: "manage_maintenance", label: t("perms.manageMaintenance") },
  ];

  const [selectedAdminPerms, setSelectedAdminPerms] = useState<Record<number, string[]>>({});

  useEffect(() => {
    if (permsQuery.data) {
      const map: Record<number, string[]> = {};
      (permsQuery.data as any[]).forEach((p: any) => {
        try { map[p.userId] = JSON.parse(p.permissions); } catch { map[p.userId] = []; }
      });
      setSelectedAdminPerms(map);
    }
  }, [permsQuery.data]);

  const togglePerm = (userId: number, perm: string) => {
    setSelectedAdminPerms(prev => {
      const current = prev[userId] || [];
      const next = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
      return { ...prev, [userId]: next };
    });
  };

  const savePerms = (userId: number) => {
    setPermsMutation.mutate({ userId, permissions: selectedAdminPerms[userId] || [] });
  };

  // Districts grouped by city
  const groupedDistricts = useMemo(() => {
    if (!districtsQuery.data) return {};
    const grouped: Record<string, any[]> = {};
    (districtsQuery.data as any[]).forEach(d => {
      const key = d.city;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    });
    return grouped;
  }, [districtsQuery.data]);

  const filteredDistricts = useMemo(() => {
    if (districtFilter === "all") return districtsQuery.data || [];
    return (districtsQuery.data as any[] || []).filter((d: any) => d.city === districtFilter);
  }, [districtsQuery.data, districtFilter]);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-muted-foreground">{lang === "ar" ? "غير مصرح" : "Unauthorized"}</p>
      </div>
    );
  }

  const SettingField = ({ label, settingKey, type = "text", placeholder }: { label: string; settingKey: string; type?: string; placeholder?: string }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {type === "textarea" ? (
        <Textarea
          value={settings[settingKey] || ""}
          onChange={(e) => updateSetting(settingKey, e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px]"
          dir={settingKey.endsWith("Ar") ? "rtl" : settingKey.endsWith("En") ? "ltr" : dir}
        />
      ) : type === "color" ? (
        <div className="flex gap-3 items-center">
          <input
            type="color"
            value={settings[settingKey] || "#15803d"}
            onChange={(e) => updateSetting(settingKey, e.target.value)}
            className="w-12 h-10 rounded border cursor-pointer"
          />
          <Input
            value={settings[settingKey] || ""}
            onChange={(e) => updateSetting(settingKey, e.target.value)}
            placeholder="#15803d"
            className="flex-1"
          />
        </div>
      ) : (
        <Input
          type={type}
          value={settings[settingKey] || ""}
          onChange={(e) => updateSetting(settingKey, e.target.value)}
          placeholder={placeholder}
          dir={settingKey.endsWith("Ar") ? "rtl" : settingKey.endsWith("En") ? "ltr" : undefined}
        />
      )}
    </div>
  );

  const BilingualField = ({ labelAr, labelEn, keyAr, keyEn, type = "text" }: { labelAr: string; labelEn: string; keyAr: string; keyEn: string; type?: string }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingField label={`${labelAr} (${t("settings.arabic")})`} settingKey={keyAr} type={type} />
      <SettingField label={`${labelEn} (${t("settings.english")})`} settingKey={keyEn} type={type} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "تحكم كامل في جميع إعدادات المنصة" : "Full control over all platform settings"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <RefreshCw className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"} ${seedMutation.isPending ? "animate-spin" : ""}`} />
                {t("settings.seedDefaults")}
              </Button>
              {dirty && (
                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Tabs defaultValue="general" dir={dir}>
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 mb-6">
            <TabsTrigger value="general" className="gap-2"><Settings className="h-4 w-4" />{t("settings.general")}</TabsTrigger>
            <TabsTrigger value="hero" className="gap-2"><Image className="h-4 w-4" />{t("settings.hero")}</TabsTrigger>
            <TabsTrigger value="stats" className="gap-2"><BarChart3 className="h-4 w-4" />{t("settings.stats")}</TabsTrigger>
            <TabsTrigger value="fees" className="gap-2"><DollarSign className="h-4 w-4" />{t("settings.fees")}</TabsTrigger>
            <TabsTrigger value="footer" className="gap-2"><Globe className="h-4 w-4" />{t("settings.footer")}</TabsTrigger>
            <TabsTrigger value="legal" className="gap-2"><FileText className="h-4 w-4" />{t("settings.legal")}</TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2"><Shield className="h-4 w-4" />{t("perms.title")}</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" />{t("analytics.title")}</TabsTrigger>
            <TabsTrigger value="districts" className="gap-2"><MapPin className="h-4 w-4" />{t("districts.title")}</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="h-4 w-4" />{lang === "ar" ? "واتساب" : "WhatsApp"}</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t("settings.general")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <BilingualField labelAr={t("settings.siteName")} labelEn={t("settings.siteName")} keyAr="site.nameAr" keyEn="site.nameEn" />
                <BilingualField labelAr={t("settings.siteDescription")} labelEn={t("settings.siteDescription")} keyAr="site.descriptionAr" keyEn="site.descriptionEn" type="textarea" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Logo */}
                  <div className="space-y-3">
                    <Label>{t("settings.logo")}</Label>
                    <div className="flex items-center gap-4">
                      {settings["site.logoUrl"] && (
                        <img src={settings["site.logoUrl"]} alt="Logo" className="h-16 w-16 object-contain rounded border" />
                      )}
                      <Button variant="outline" onClick={() => handleFileUpload("site.logoUrl")}>
                        <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {t("settings.uploadLogo")}
                      </Button>
                    </div>
                  </div>

                  {/* Favicon */}
                  <div className="space-y-3">
                    <Label>{t("settings.favicon")}</Label>
                    <div className="flex items-center gap-4">
                      {settings["site.faviconUrl"] && (
                        <img src={settings["site.faviconUrl"]} alt="Favicon" className="h-10 w-10 object-contain rounded border" />
                      )}
                      <Button variant="outline" onClick={() => handleFileUpload("site.faviconUrl")}>
                        <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {t("settings.uploadFavicon")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingField label={t("settings.primaryColor")} settingKey="site.primaryColor" type="color" />
                  <SettingField label={t("settings.accentColor")} settingKey="site.accentColor" type="color" />
                </div>

                <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hero Section */}
          <TabsContent value="hero">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  {t("settings.hero")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <BilingualField labelAr={t("settings.heroTitle")} labelEn={t("settings.heroTitle")} keyAr="hero.titleAr" keyEn="hero.titleEn" />
                <BilingualField labelAr={t("settings.heroSubtitle")} labelEn={t("settings.heroSubtitle")} keyAr="hero.subtitleAr" keyEn="hero.subtitleEn" type="textarea" />

                <div className="space-y-3">
                  <Label>{t("settings.heroBgImage")}</Label>
                  <div className="flex items-center gap-4">
                    {settings["hero.bgImage"] && (
                      <img src={settings["hero.bgImage"]} alt="Hero BG" className="h-24 w-40 object-cover rounded border" />
                    )}
                    <Button variant="outline" onClick={() => handleFileUpload("hero.bgImage")}>
                      <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                      {t("settings.uploadBg")}
                    </Button>
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics */}
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t("settings.stats")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { key: "properties", label: t("settings.properties") },
                  { key: "tenants", label: t("settings.tenants") },
                  { key: "cities", label: t("settings.cities") },
                  { key: "satisfaction", label: t("settings.satisfaction") },
                ].map(stat => (
                  <div key={stat.key} className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">{stat.label}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <SettingField label={t("settings.value")} settingKey={`stats.${stat.key}`} type="number" />
                      <SettingField label={`${t("settings.label")} (${t("settings.arabic")})`} settingKey={`stats.${stat.key}LabelAr`} />
                      <SettingField label={`${t("settings.label")} (${t("settings.english")})`} settingKey={`stats.${stat.key}LabelEn`} />
                    </div>
                  </div>
                ))}

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fees & Pricing */}
          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t("settings.fees")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingField label={t("settings.serviceFee")} settingKey="fees.serviceFeePercent" type="number" placeholder="5" />
                  <SettingField label={t("settings.vatPercent")} settingKey="fees.vatPercent" type="number" placeholder="15" />
                  <SettingField label={`${t("settings.minRent")} (SAR)`} settingKey="fees.minRent" type="number" placeholder="500" />
                  <SettingField label={`${t("settings.maxRent")} (SAR)`} settingKey="fees.maxRent" type="number" placeholder="100000" />
                  <SettingField label={t("settings.depositMonths")} settingKey="fees.depositMonths" type="number" placeholder="2" />
                </div>

                {/* Rental Duration Limits */}
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {lang === "ar" ? "حدود مدة الإيجار" : "Rental Duration Limits"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {lang === "ar" ? "تحديد الحد الأدنى والأقصى لمدة الإيجار المسموح بها على المنصة (بالأشهر)" : "Set the minimum and maximum rental duration allowed on the platform (in months)"}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SettingField label={lang === "ar" ? "الحد الأدنى (أشهر)" : "Minimum Duration (months)"} settingKey="rental.minMonths" type="number" placeholder="1" />
                    <SettingField label={lang === "ar" ? "الحد الأقصى (أشهر)" : "Maximum Duration (months)"} settingKey="rental.maxMonths" type="number" placeholder="12" />
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Footer */}
          <TabsContent value="footer">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t("settings.footer")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <BilingualField labelAr={t("settings.aboutText")} labelEn={t("settings.aboutText")} keyAr="footer.aboutAr" keyEn="footer.aboutEn" type="textarea" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingField label={t("settings.email")} settingKey="footer.email" placeholder="info@ijar.sa" />
                  <SettingField label={t("settings.phone")} settingKey="footer.phone" placeholder="+966500000000" />
                </div>
                <BilingualField labelAr={t("settings.address")} labelEn={t("settings.address")} keyAr="footer.addressAr" keyEn="footer.addressEn" />

                <h3 className="font-semibold pt-4 border-t">{t("settings.social")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SettingField label="Twitter / X" settingKey="footer.twitter" placeholder="https://twitter.com/..." />
                  <SettingField label="Instagram" settingKey="footer.instagram" placeholder="https://instagram.com/..." />
                  <SettingField label="LinkedIn" settingKey="footer.linkedin" placeholder="https://linkedin.com/..." />
                </div>

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Legal */}
          <TabsContent value="legal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("settings.legal")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <BilingualField labelAr={t("settings.terms")} labelEn={t("settings.terms")} keyAr="terms.contentAr" keyEn="terms.contentEn" type="textarea" />
                <BilingualField labelAr={t("settings.privacy")} labelEn={t("settings.privacy")} keyAr="privacy.contentAr" keyEn="privacy.contentEn" type="textarea" />

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Settings */}
          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                  {lang === "ar" ? "إعدادات واتساب" : "WhatsApp Settings"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "تحكم في زر واتساب العائم والرسالة الافتراضية" : "Control the floating WhatsApp button and default message"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingField label={lang === "ar" ? "رقم واتساب (مع رمز الدولة)" : "WhatsApp Number (with country code)"} settingKey="whatsapp.number" placeholder="966504466528" />
                  <SettingField label={lang === "ar" ? "رسالة ترحيبية افتراضية" : "Default Welcome Message"} settingKey="whatsapp.message" placeholder={lang === "ar" ? "مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري" : "Hello, I need help with monthly rental"} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingField label={lang === "ar" ? "نص الزر (عربي)" : "Button Text (Arabic)"} settingKey="whatsapp.textAr" placeholder="تواصل معنا" />
                  <SettingField label={lang === "ar" ? "نص الزر (إنجليزي)" : "Button Text (English)"} settingKey="whatsapp.textEn" placeholder="Chat with us" />
                </div>

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Permissions */}
          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("perms.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {adminUsersQuery.data && (adminUsersQuery.data as any[]).filter((u: any) => u.role === "admin").length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t("perms.noAdmins")}</p>
                ) : (
                  <div className="space-y-6">
                    {(adminUsersQuery.data as any[] || [])
                      .filter((u: any) => u.role === "admin")
                      .map((adminUser: any) => {
                        const isRoot = (permsQuery.data as any[] || []).find((p: any) => p.userId === adminUser.id)?.isRootAdmin;
                        return (
                          <div key={adminUser.id} className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Shield className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-semibold">{adminUser.displayName || adminUser.name || adminUser.userId}</p>
                                  <p className="text-sm text-muted-foreground">{adminUser.email}</p>
                                </div>
                              </div>
                              {isRoot && <Badge variant="destructive">{t("perms.rootAdmin")}</Badge>}
                            </div>

                            {isRoot ? (
                              <p className="text-sm text-muted-foreground italic">{t("perms.cannotModifyRoot")}</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {allPermissions.map(perm => (
                                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                                      <Checkbox
                                        checked={(selectedAdminPerms[adminUser.id] || []).includes(perm.key)}
                                        onCheckedChange={() => togglePerm(adminUser.id, perm.key)}
                                      />
                                      <span className="text-sm">{perm.label}</span>
                                    </label>
                                  ))}
                                </div>
                                <Button size="sm" onClick={() => savePerms(adminUser.id)} disabled={setPermsMutation.isPending}>
                                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                                  {t("perms.save")}
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Analytics */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: t("analytics.totalActions"), value: (activityStatsQuery.data as any)?.totalActions || 0, icon: BarChart3 },
                  { label: t("analytics.uniqueUsers"), value: (activityStatsQuery.data as any)?.uniqueUsers || 0, icon: Users },
                  { label: t("analytics.pageViews"), value: (activityStatsQuery.data as any)?.topActions?.find((a: any) => a.action === "page_view")?.count || 0, icon: Eye },
                  { label: t("analytics.searches"), value: (activityStatsQuery.data as any)?.topActions?.find((a: any) => a.action === "search")?.count || 0, icon: Search },
                ].map((stat, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <stat.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Top Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("analytics.topActions")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {((activityStatsQuery.data as any)?.topActions || []).map((action: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="font-medium">{action.action}</span>
                        <Badge variant="secondary">{action.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity Log */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("analytics.recentActivity")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-start p-2">{t("analytics.user")}</th>
                          <th className="text-start p-2">{t("analytics.action")}</th>
                          <th className="text-start p-2">{t("analytics.page")}</th>
                          <th className="text-start p-2">{t("analytics.time")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activityLogQuery.data as any[] || []).map((log: any, i: number) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2">{log.userId || "-"}</td>
                            <td className="p-2"><Badge variant="outline">{log.action}</Badge></td>
                            <td className="p-2 text-muted-foreground">{log.page || "-"}</td>
                            <td className="p-2 text-muted-foreground">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US") : "-"}
                            </td>
                          </tr>
                        ))}
                        {(!activityLogQuery.data || (activityLogQuery.data as any[]).length === 0) && (
                          <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">
                            {lang === "ar" ? "لا توجد أنشطة مسجلة بعد" : "No activities recorded yet"}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Districts */}
          <TabsContent value="districts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {t("districts.title")} ({(districtsQuery.data as any[] || []).length})
                  </CardTitle>
                  <Select value={districtFilter} onValueChange={setDistrictFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("districts.allCities")}</SelectItem>
                      {Object.keys(groupedDistricts).sort().map(city => (
                        <SelectItem key={city} value={city}>{city} ({groupedDistricts[city].length})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {/* City summary cards */}
                {districtFilter === "all" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {Object.entries(groupedDistricts).sort().map(([city, dists]) => (
                      <button
                        key={city}
                        onClick={() => setDistrictFilter(city)}
                        className="border rounded-lg p-3 text-start hover:bg-accent/50 transition-colors"
                      >
                        <p className="font-semibold">{city}</p>
                        <p className="text-xs text-muted-foreground">
                          {(dists as any[])[0]?.cityAr} • {(dists as any[]).length} {lang === "ar" ? "حي" : "districts"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Districts table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start p-2">{t("districts.city")}</th>
                        <th className="text-start p-2">{t("districts.district")} ({t("settings.english")})</th>
                        <th className="text-start p-2">{t("districts.district")} ({t("settings.arabic")})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(filteredDistricts as any[]).map((d: any) => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-accent/30">
                          <td className="p-2">
                            <span className="font-medium">{d.city}</span>
                            <span className="text-muted-foreground text-xs block">{d.cityAr}</span>
                          </td>
                          <td className="p-2" dir="ltr">{d.nameEn}</td>
                          <td className="p-2" dir="rtl">{d.nameAr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
