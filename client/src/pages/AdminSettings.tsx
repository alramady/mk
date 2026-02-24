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
  ChevronDown, ChevronUp, Eye, Trash2, Plus, Search, MessageCircle, Phone,
  CreditCard, LayoutGrid, Home as HomeIcon, Video, UserCog, Calendar, Clock, HelpCircle
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
      const raw = settingsQuery.data as any;
      let map: Record<string, string> = {};
      if (Array.isArray(raw)) {
        // Array of {key, value} objects
        raw.forEach((s: any) => { map[s.key ?? s.settingKey] = s.value ?? s.settingValue ?? ""; });
      } else if (typeof raw === 'object') {
        // Direct Record<string, string> from getAllSettings
        map = { ...raw };
      }
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
            <TabsTrigger value="services" className="gap-2"><LayoutGrid className="h-4 w-4" />{lang === "ar" ? "الخدمات" : "Services"}</TabsTrigger>
            <TabsTrigger value="homepage" className="gap-2"><HomeIcon className="h-4 w-4" />{lang === "ar" ? "الصفحة الرئيسية" : "Homepage"}</TabsTrigger>
            <TabsTrigger value="payment" className="gap-2"><CreditCard className="h-4 w-4" />{lang === "ar" ? "الدفع" : "Payment"}</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="h-4 w-4" />{lang === "ar" ? "واتساب" : "WhatsApp"}</TabsTrigger>
            <TabsTrigger value="managers" className="gap-2"><UserCog className="h-4 w-4" />{lang === "ar" ? "مدراء العقارات" : "Managers"}</TabsTrigger>
            <TabsTrigger value="inspections" className="gap-2"><Calendar className="h-4 w-4" />{lang === "ar" ? "طلبات المعاينة" : "Inspections"}</TabsTrigger>
            <TabsTrigger value="faq" className="gap-2"><HelpCircle className="h-4 w-4" />{lang === "ar" ? "الأسئلة الشائعة" : "FAQ"}</TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2"><Shield className="h-4 w-4" />{lang === "ar" ? "وضع الصيانة" : "Maintenance Mode"}</TabsTrigger>
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

                {/* Hero Background Type */}
                <div className="space-y-3">
                  <Label>{lang === "ar" ? "نوع خلفية الهيرو" : "Hero Background Type"}</Label>
                  <Select value={settings["hero.bgType"] || "image"} onValueChange={(v) => updateSetting("hero.bgType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">{lang === "ar" ? "صورة" : "Image"}</SelectItem>
                      <SelectItem value="video">{lang === "ar" ? "فيديو" : "Video"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(settings["hero.bgType"] || "image") === "image" ? (
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
                ) : (
                  <div className="space-y-3">
                    <Label>{lang === "ar" ? "رابط الفيديو" : "Video URL"}</Label>
                    <Input
                      value={settings["hero.bgVideo"] || ""}
                      onChange={(e) => updateSetting("hero.bgVideo", e.target.value)}
                      placeholder="https://example.com/video.mp4"
                      dir="ltr"
                    />
                    <p className="text-xs text-muted-foreground">
                      {lang === "ar" ? "أدخل رابط فيديو MP4 مباشر. يمكنك رفع الفيديو عبر S3 أو استخدام رابط خارجي" : "Enter a direct MP4 video URL. Upload via S3 or use an external link."}
                    </p>
                    {settings["hero.bgVideo"] && (
                      <video src={settings["hero.bgVideo"]} className="h-32 w-56 object-cover rounded border" muted autoPlay loop />
                    )}
                  </div>
                )}

                {/* Hero Overlay Opacity */}
                <div className="space-y-2">
                  <Label>{lang === "ar" ? "شفافية التعتيم" : "Overlay Opacity"}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min="0" max="100" step="5"
                      value={settings["hero.overlayOpacity"] || "60"}
                      onChange={(e) => updateSetting("hero.overlayOpacity", e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12">{settings["hero.overlayOpacity"] || "60"}%</span>
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
                  <SettingField label={lang === 'ar' ? 'نسبة التأمين %' : 'Security Deposit %'} settingKey="fees.depositPercent" type="number" placeholder="10" />
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
                    <SettingField label={lang === "ar" ? "الحد الأقصى (أشهر)" : "Maximum Duration (months)"} settingKey="rental.maxMonths" type="number" placeholder="2" />
                  </div>
                </div>

                {/* Calculator Config */}
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    {lang === "ar" ? "إعدادات حاسبة التكاليف" : "Cost Calculator Settings"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {lang === "ar" ? "تحكم في المدد المسموحة والتسميات التي تظهر في حاسبة التكاليف للعملاء" : "Control allowed durations and labels shown in the customer cost calculator"}
                  </p>
                  <div className="space-y-4">
                    <SettingField
                      label={lang === "ar" ? "المدد المسموحة (JSON array بالأشهر)" : "Allowed Months (JSON array)"}
                      settingKey="calculator.allowedMonths"
                      placeholder='[1,2]'
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SettingField label={lang === "ar" ? "تسمية التأمين (عربي)" : "Insurance Label (Arabic)"} settingKey="calculator.insuranceLabelAr" placeholder="التأمين" />
                      <SettingField label={lang === "ar" ? "تسمية التأمين (إنجليزي)" : "Insurance Label (English)"} settingKey="calculator.insuranceLabelEn" placeholder="Insurance/Deposit" />
                      <SettingField label={lang === "ar" ? "تسمية رسوم الخدمة (عربي)" : "Service Fee Label (Arabic)"} settingKey="calculator.serviceFeeLabelAr" placeholder="رسوم الخدمة" />
                      <SettingField label={lang === "ar" ? "تسمية رسوم الخدمة (إنجليزي)" : "Service Fee Label (English)"} settingKey="calculator.serviceFeeLabelEn" placeholder="Service Fee" />
                      <SettingField label={lang === "ar" ? "تسمية الضريبة (عربي)" : "VAT Label (Arabic)"} settingKey="calculator.vatLabelAr" placeholder="ضريبة القيمة المضافة" />
                      <SettingField label={lang === "ar" ? "تسمية الضريبة (إنجليزي)" : "VAT Label (English)"} settingKey="calculator.vatLabelEn" placeholder="VAT" />
                    </div>
                    <h4 className="text-sm font-medium text-muted-foreground pt-2">{lang === "ar" ? "نصوص التوضيح (Tooltips)" : "Tooltip Texts"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SettingField label={lang === "ar" ? "توضيح التأمين (عربي)" : "Insurance Tooltip (AR)"} settingKey="calculator.insuranceTooltipAr" placeholder="مبلغ تأمين قابل للاسترداد" />
                      <SettingField label={lang === "ar" ? "توضيح التأمين (إنجليزي)" : "Insurance Tooltip (EN)"} settingKey="calculator.insuranceTooltipEn" placeholder="Refundable security deposit" />
                      <SettingField label={lang === "ar" ? "توضيح رسوم الخدمة (عربي)" : "Service Fee Tooltip (AR)"} settingKey="calculator.serviceFeeTooltipAr" placeholder="رسوم إدارة المنصة" />
                      <SettingField label={lang === "ar" ? "توضيح رسوم الخدمة (إنجليزي)" : "Service Fee Tooltip (EN)"} settingKey="calculator.serviceFeeTooltipEn" placeholder="Platform management fee" />
                      <SettingField label={lang === "ar" ? "توضيح الضريبة (عربي)" : "VAT Tooltip (AR)"} settingKey="calculator.vatTooltipAr" placeholder="ضريبة القيمة المضافة وفقاً لنظام هيئة الزكاة" />
                      <SettingField label={lang === "ar" ? "توضيح الضريبة (إنجليزي)" : "VAT Tooltip (EN)"} settingKey="calculator.vatTooltipEn" placeholder="Value Added Tax as per ZATCA" />
                    </div>
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
                  <SettingField label={t("settings.email")} settingKey="footer.email" placeholder="info@monthlykey.sa" />
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
                {/* Licence & Registration Numbers */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {lang === "ar" ? "التراخيص والتسجيل" : "Licences & Registration"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {lang === "ar" ? "أرقام التراخيص والتسجيل المطلوبة حسب الأنظمة السعودية — تظهر في أسفل الموقع" : "Required licence and registration numbers per Saudi regulations — displayed in the website footer"}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingField label={lang === "ar" ? "رقم ترخيص وزارة السياحة" : "Tourism Licence Number (MoT)"} settingKey="legal.tourismLicence" placeholder={lang === "ar" ? "أدخل رقم الترخيص السياحي" : "Enter tourism licence number"} />
                    <SettingField label={lang === "ar" ? "رقم السجل التجاري" : "Commercial Registration (CR)"} settingKey="legal.crNumber" placeholder={lang === "ar" ? "أدخل رقم السجل التجاري" : "Enter CR number"} />
                    <SettingField label={lang === "ar" ? "الرقم الضريبي (ضريبة القيمة المضافة)" : "VAT Registration Number"} settingKey="legal.vatNumber" placeholder={lang === "ar" ? "أدخل الرقم الضريبي" : "Enter VAT number"} />
                    <SettingField label={lang === "ar" ? "رقم ترخيص إيجار" : "Ejar Licence Number"} settingKey="legal.ejarLicence" placeholder={lang === "ar" ? "أدخل رقم ترخيص إيجار" : "Enter Ejar licence number"} />
                  </div>
                </div>

                {/* Terms & Privacy Content */}
                <BilingualField labelAr={t("settings.terms")} labelEn={t("settings.terms")} keyAr="terms.contentAr" keyEn="terms.contentEn" type="textarea" />
                <BilingualField labelAr={t("settings.privacy")} labelEn={t("settings.privacy")} keyAr="privacy.contentAr" keyEn="privacy.contentEn" type="textarea" />

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Section CMS */}
          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  {lang === "ar" ? "إدارة الخدمات" : "Services Management"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <BilingualField labelAr="عنوان قسم الخدمات" labelEn="Services Section Title" keyAr="services.titleAr" keyEn="services.titleEn" />
                <BilingualField labelAr="وصف قسم الخدمات" labelEn="Services Section Description" keyAr="services.descAr" keyEn="services.descEn" type="textarea" />
                
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold text-primary">
                      {lang === "ar" ? `الخدمة ${i}` : `Service ${i}`}
                    </h3>
                    <BilingualField labelAr="اسم الخدمة" labelEn="Service Name" keyAr={`service.${i}.titleAr`} keyEn={`service.${i}.titleEn`} />
                    <BilingualField labelAr="وصف الخدمة" labelEn="Service Description" keyAr={`service.${i}.descAr`} keyEn={`service.${i}.descEn`} type="textarea" />
                    <SettingField label={lang === "ar" ? "أيقونة (lucide icon name)" : "Icon (lucide icon name)"} settingKey={`service.${i}.icon`} placeholder="building-2" />
                  </div>
                ))}

                <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Homepage Content CMS */}
          <TabsContent value="homepage">
            <div className="space-y-6">
              {/* How It Works */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HomeIcon className="h-5 w-5" />
                    {lang === "ar" ? "كيف يعمل" : "How It Works"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="border rounded-lg p-4 space-y-4">
                      <h3 className="font-semibold text-primary">
                        {lang === "ar" ? `الخطوة ${i}` : `Step ${i}`}
                      </h3>
                      <BilingualField labelAr="العنوان" labelEn="Title" keyAr={`step.${i}.titleAr`} keyEn={`step.${i}.titleEn`} />
                      <BilingualField labelAr="الوصف" labelEn="Description" keyAr={`step.${i}.descAr`} keyEn={`step.${i}.descEn`} type="textarea" />
                    </div>
                  ))}
                  <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                    <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                    {t("settings.save")}
                  </Button>
                </CardContent>
              </Card>

              {/* Testimonials */}
              <Card>
                <CardHeader>
                  <CardTitle>{lang === "ar" ? "آراء العملاء" : "Testimonials"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="border rounded-lg p-4 space-y-4">
                      <h3 className="font-semibold text-primary">
                        {lang === "ar" ? `الشهادة ${i}` : `Testimonial ${i}`}
                      </h3>
                      <BilingualField labelAr="النص" labelEn="Text" keyAr={`testimonial.${i}.textAr`} keyEn={`testimonial.${i}.textEn`} type="textarea" />
                      <BilingualField labelAr="الاسم" labelEn="Name" keyAr={`testimonial.${i}.nameAr`} keyEn={`testimonial.${i}.nameEn`} />
                      <BilingualField labelAr="الدور" labelEn="Role" keyAr={`testimonial.${i}.roleAr`} keyEn={`testimonial.${i}.roleEn`} />
                      <SettingField label={lang === "ar" ? "التقييم (1-5)" : "Rating (1-5)"} settingKey={`testimonial.${i}.rating`} type="number" placeholder="5" />
                    </div>
                  ))}
                  <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                    <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                    {t("settings.save")}
                  </Button>
                </CardContent>
              </Card>

              {/* CTA Section */}
              <Card>
                <CardHeader>
                  <CardTitle>{lang === "ar" ? "قسم الدعوة للإجراء" : "Call to Action Section"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <BilingualField labelAr="عنوان CTA" labelEn="CTA Title" keyAr="cta.titleAr" keyEn="cta.titleEn" />
                  <BilingualField labelAr="وصف CTA" labelEn="CTA Description" keyAr="cta.descAr" keyEn="cta.descEn" type="textarea" />
                  <BilingualField labelAr="نص الزر" labelEn="Button Text" keyAr="cta.btnAr" keyEn="cta.btnEn" />
                  <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                    <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                    {t("settings.save")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payment Settings */}
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {lang === "ar" ? "إعدادات الدفع" : "Payment Settings"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    {lang === "ar" ? "PayPal الدفع عبر" : "PayPal Payment"}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {lang === "ar" 
                      ? "قم بإدخال بيانات PayPal الخاصة بك لتفعيل الدفع الإلكتروني. يمكنك الحصول على البيانات من developer.paypal.com" 
                      : "Enter your PayPal credentials to enable online payments. Get credentials from developer.paypal.com"}
                  </p>
                </div>

                <SettingField 
                  label={lang === "ar" ? "PayPal Client ID" : "PayPal Client ID"} 
                  settingKey="payment.paypalClientId" 
                  placeholder="AYSq3RDGsmBLJE-otTkBtM-jBRd1TCQwFf9RGfwddNXWz0uFU9ztymylOhRS" 
                />
                <SettingField 
                  label={lang === "ar" ? "PayPal Secret Key" : "PayPal Secret Key"} 
                  settingKey="payment.paypalSecret" 
                  placeholder="EGnHDxD_qRPdaLdZz8iCr8N7_MzF-YHPTkjs6NKYQvQSBngp4PTTVWkPZRbL" 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "الوضع" : "Mode"}</Label>
                    <Select 
                      value={settings["payment.paypalMode"] || "sandbox"} 
                      onValueChange={(v) => updateSetting("payment.paypalMode", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">{lang === "ar" ? "تجريبي (Sandbox)" : "Sandbox (Testing)"}</SelectItem>
                        <SelectItem value="live">{lang === "ar" ? "إنتاجي (Live)" : "Live (Production)"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <SettingField 
                    label={lang === "ar" ? "العملة" : "Currency"} 
                    settingKey="payment.currency" 
                    placeholder="SAR" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "تفعيل الدفع الإلكتروني" : "Enable Online Payment"}</Label>
                    <Select 
                      value={settings["payment.enabled"] || "false"} 
                      onValueChange={(v) => updateSetting("payment.enabled", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                        <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "الدفع عند الاستلام" : "Cash on Delivery"}</Label>
                    <Select 
                      value={settings["payment.cashEnabled"] || "true"} 
                      onValueChange={(v) => updateSetting("payment.cashEnabled", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                        <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
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
                  <SettingField label={lang === "ar" ? "رسالة ترحيبية افتراضية" : "Default Welcome Message"} settingKey="whatsapp.message" placeholder={lang === "ar" ? "مرحباً، أحتاج مساعدة من المفتاح الشهري" : "Hello, I need help with monthly rental"} />
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

          {/* Property Managers */}
          <TabsContent value="managers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  {lang === "ar" ? "إدارة مدراء العقارات" : "Property Managers"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" 
                    ? "أضف مدراء العقارات وعيّن كل مدير لمجموعة من الشقق. سيظهر اسم المدير وصورته وأرقام تواصله في صفحة العقار." 
                    : "Add property managers and assign each to a group of properties. Manager name, photo, and contact info will appear on the property page."}
                </p>

                {/* Add New Manager Form */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h3 className="font-semibold">{lang === "ar" ? "إضافة مدير جديد" : "Add New Manager"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingField label={lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"} settingKey="newManager.nameAr" />
                    <SettingField label={lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"} settingKey="newManager.name" />
                    <SettingField label={lang === "ar" ? "الهاتف" : "Phone"} settingKey="newManager.phone" />
                    <SettingField label={lang === "ar" ? "واتساب" : "WhatsApp"} settingKey="newManager.whatsapp" />
                    <SettingField label={lang === "ar" ? "البريد" : "Email"} settingKey="newManager.email" />
                    <SettingField label={lang === "ar" ? "المسمى الوظيفي (عربي)" : "Title (Arabic)"} settingKey="newManager.titleAr" />
                    <SettingField label={lang === "ar" ? "المسمى الوظيفي (إنجليزي)" : "Title (English)"} settingKey="newManager.title" />
                    <SettingField label={lang === "ar" ? "رابط الصورة" : "Photo URL"} settingKey="newManager.photoUrl" />
                  </div>
                  <BilingualField labelAr={lang === "ar" ? "نبذة" : "Bio"} labelEn={lang === "ar" ? "نبذة" : "Bio"} keyAr="newManager.bioAr" keyEn="newManager.bio" type="textarea" />
                  <Button onClick={() => {
                    const s = settings;
                    if (!s["newManager.name"] || !s["newManager.nameAr"] || !s["newManager.phone"]) {
                      toast.error(lang === "ar" ? "الاسم والهاتف مطلوبان" : "Name and phone are required");
                      return;
                    }
                    // Use tRPC to create manager
                    fetch('/api/trpc/propertyManager.create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ json: {
                        name: s["newManager.name"], nameAr: s["newManager.nameAr"],
                        phone: s["newManager.phone"], whatsapp: s["newManager.whatsapp"] || "",
                        email: s["newManager.email"] || "", photoUrl: s["newManager.photoUrl"] || "",
                        bio: s["newManager.bio"] || "", bioAr: s["newManager.bioAr"] || "",
                        title: s["newManager.title"] || "", titleAr: s["newManager.titleAr"] || "",
                      }})
                    }).then(() => {
                      toast.success(lang === "ar" ? "تم إضافة المدير" : "Manager added");
                      // Clear form
                      const cleared = { ...settings };
                      Object.keys(cleared).filter(k => k.startsWith('newManager.')).forEach(k => delete cleared[k]);
                      setSettings(cleared);
                    }).catch(() => toast.error("Error"));
                  }}>
                    <Plus className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                    {lang === "ar" ? "إضافة مدير" : "Add Manager"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {lang === "ar" 
                    ? "لتعيين مدير لعقارات محددة، استخدم صفحة إدارة العقارات واختر المدير لكل عقار." 
                    : "To assign a manager to specific properties, use the property management page and select the manager for each property."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inspection Requests */}
          <TabsContent value="inspections">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {lang === "ar" ? "إدارة طلبات المعاينة" : "Inspection Requests"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Time Slots Configuration */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {lang === "ar" ? "أوقات المعاينة المتاحة" : "Available Time Slots"}
                  </h3>
                  <SettingField 
                    label={lang === "ar" ? "الأوقات (مفصولة بفواصل)" : "Time Slots (comma separated)"}
                    settingKey="inspection.timeSlots"
                    placeholder='["09:00-10:00","10:00-11:00","14:00-15:00","15:00-16:00"]'
                  />
                  <p className="text-xs text-muted-foreground">
                    {lang === "ar" 
                      ? 'أدخل الأوقات بصيغة JSON مثل: ["09:00-10:00","14:00-15:00"]' 
                      : 'Enter time slots as JSON array: ["09:00-10:00","14:00-15:00"]'}
                  </p>
                </div>

                {/* Inspection Settings */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold">{lang === "ar" ? "إعدادات المعاينة" : "Inspection Settings"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingField 
                      label={lang === "ar" ? "الحد الأقصى للطلبات اليومية" : "Max Daily Requests"}
                      settingKey="inspection.maxDaily" type="number" placeholder="10"
                    />
                    <SettingField 
                      label={lang === "ar" ? "أيام الحجز المسبق المطلوبة" : "Advance Booking Days"}
                      settingKey="inspection.advanceDays" type="number" placeholder="1"
                    />
                  </div>
                  <BilingualField 
                    labelAr={lang === "ar" ? "رسالة تأكيد المعاينة" : "Confirmation Message"}
                    labelEn={lang === "ar" ? "رسالة تأكيد المعاينة" : "Confirmation Message"}
                    keyAr="inspection.confirmMsgAr" keyEn="inspection.confirmMsgEn" type="textarea"
                  />
                </div>

                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQ Management */}
          <TabsContent value="faq">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  {lang === "ar" ? "إدارة الأسئلة الشائعة" : "FAQ Management"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "أضف وعدّل الأسئلة الشائعة التي تظهر في صفحة FAQ. اتركها فارغة لاستخدام الأسئلة الافتراضية." : "Add and edit FAQ items shown on the FAQ page. Leave empty to use defaults."}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  let faqItems: Array<{questionAr: string; questionEn: string; answerAr: string; answerEn: string; category: string}> = [];
                  try { faqItems = JSON.parse(settings["faq.items"] || "[]"); } catch { faqItems = []; }
                  if (!Array.isArray(faqItems)) faqItems = [];
                  const updateFaqItems = (items: typeof faqItems) => updateSetting("faq.items", JSON.stringify(items));
                  return (
                    <>
                      {faqItems.map((item, idx) => (
                        <div key={idx} className="border rounded-lg p-4 space-y-3 relative">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">#{idx + 1}</Badge>
                            <div className="flex gap-2">
                              <Select value={item.category || "general"} onValueChange={(v) => { const next = [...faqItems]; next[idx] = {...item, category: v}; updateFaqItems(next); }}>
                                <SelectTrigger className="w-[120px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">{lang === "ar" ? "عام" : "General"}</SelectItem>
                                  <SelectItem value="booking">{lang === "ar" ? "الحجز" : "Booking"}</SelectItem>
                                  <SelectItem value="payment">{lang === "ar" ? "الدفع" : "Payment"}</SelectItem>
                                  <SelectItem value="rental">{lang === "ar" ? "الإيجار" : "Rental"}</SelectItem>
                                  <SelectItem value="landlord">{lang === "ar" ? "الملاك" : "Landlords"}</SelectItem>
                                  <SelectItem value="legal">{lang === "ar" ? "قانوني" : "Legal"}</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const next = faqItems.filter((_, i) => i !== idx); updateFaqItems(next); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">{lang === "ar" ? "السؤال (عربي)" : "Question (Arabic)"}</Label>
                              <Input value={item.questionAr} dir="rtl" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, questionAr: e.target.value}; updateFaqItems(next); }} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{lang === "ar" ? "السؤال (إنجليزي)" : "Question (English)"}</Label>
                              <Input value={item.questionEn} dir="ltr" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, questionEn: e.target.value}; updateFaqItems(next); }} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{lang === "ar" ? "الإجابة (عربي)" : "Answer (Arabic)"}</Label>
                              <Textarea value={item.answerAr} dir="rtl" className="min-h-[80px]" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, answerAr: e.target.value}; updateFaqItems(next); }} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{lang === "ar" ? "الإجابة (إنجليزي)" : "Answer (English)"}</Label>
                              <Textarea value={item.answerEn} dir="ltr" className="min-h-[80px]" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, answerEn: e.target.value}; updateFaqItems(next); }} />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" className="w-full" onClick={() => { updateFaqItems([...faqItems, { questionAr: "", questionEn: "", answerAr: "", answerEn: "", category: "general" }]); }}>
                        <Plus className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "إضافة سؤال جديد" : "Add New Question"}
                      </Button>
                      <div className="flex justify-end">
                        <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                          {t("settings.save")}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Mode */}
          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  {lang === "ar" ? "وضع الصيانة / قريباً" : "Maintenance / Coming Soon Mode"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed" style={{ borderColor: settings["maintenance.enabled"] === "true" ? "#ef4444" : "#22c55e" }}>
                  <div>
                    <h3 className="font-bold text-lg">{lang === "ar" ? "تفعيل وضع الصيانة" : "Enable Maintenance Mode"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "ar"
                        ? settings["maintenance.enabled"] === "true" ? "✅ الموقع مغلق حالياً - يظهر صفحة قريباً للزوار (المدير يستطيع الوصول)" : "❌ الموقع مفتوح للجميع"
                        : settings["maintenance.enabled"] === "true" ? "✅ Site is closed - visitors see coming soon page (admins can still access)" : "❌ Site is open to everyone"
                      }
                    </p>
                  </div>
                  <Button
                    variant={settings["maintenance.enabled"] === "true" ? "default" : "destructive"}
                    size="lg"
                    disabled={updateMutation.isPending}
                    onClick={() => {
                      const newVal = settings["maintenance.enabled"] === "true" ? "false" : "true";
                      setSettings(prev => ({ ...prev, "maintenance.enabled": newVal }));
                      // Auto-save immediately — critical toggle should persist without manual save
                      updateMutation.mutate({ settings: { ...settings, "maintenance.enabled": newVal } });
                    }}
                    className="min-w-[140px]"
                  >
                    {settings["maintenance.enabled"] === "true"
                      ? (lang === "ar" ? "فتح الموقع" : "Open Site")
                      : (lang === "ar" ? "إغلاق الموقع" : "Close Site")
                    }
                  </Button>
                </div>

                {/* Title AR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{lang === "ar" ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                    <Input
                      value={settings["maintenance.titleAr"] || ""}
                      onChange={(e) => updateSetting("maintenance.titleAr", e.target.value)}
                      placeholder="قريباً... الانطلاق"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <Label>{lang === "ar" ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
                    <Input
                      value={settings["maintenance.titleEn"] || ""}
                      onChange={(e) => updateSetting("maintenance.titleEn", e.target.value)}
                      placeholder="Coming Soon"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Subtitle AR/EN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{lang === "ar" ? "العنوان الفرعي (عربي)" : "Subtitle (Arabic)"}</Label>
                    <Input
                      value={settings["maintenance.subtitleAr"] || ""}
                      onChange={(e) => updateSetting("maintenance.subtitleAr", e.target.value)}
                      placeholder="نعمل على تجهيز تجربة مميزة لكم"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <Label>{lang === "ar" ? "العنوان الفرعي (إنجليزي)" : "Subtitle (English)"}</Label>
                    <Input
                      value={settings["maintenance.subtitleEn"] || ""}
                      onChange={(e) => updateSetting("maintenance.subtitleEn", e.target.value)}
                      placeholder="We're preparing an exceptional experience"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Message AR/EN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{lang === "ar" ? "الرسالة (عربي)" : "Message (Arabic)"}</Label>
                    <Textarea
                      value={settings["maintenance.messageAr"] || ""}
                      onChange={(e) => updateSetting("maintenance.messageAr", e.target.value)}
                      placeholder="ستكون رحلة مميزة معنا..."
                      dir="rtl"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{lang === "ar" ? "الرسالة (إنجليزي)" : "Message (English)"}</Label>
                    <Textarea
                      value={settings["maintenance.messageEn"] || ""}
                      onChange={(e) => updateSetting("maintenance.messageEn", e.target.value)}
                      placeholder="An exceptional journey awaits..."
                      dir="ltr"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <Label>{lang === "ar" ? "صورة الصفحة (اختياري)" : "Page Image (optional)"}</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {settings["maintenance.imageUrl"] && (
                      <div className="relative w-40 h-24 rounded-lg overflow-hidden border">
                        <img src={settings["maintenance.imageUrl"]} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => updateSetting("maintenance.imageUrl", "")}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <Button variant="outline" onClick={() => handleFileUpload("maintenance.imageUrl")}>
                      <Upload className="h-4 w-4 mr-2" />
                      {lang === "ar" ? "رفع صورة" : "Upload Image"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "ar" ? "ارفع صورة مخصصة تظهر في صفحة الصيانة" : "Upload a custom image to display on the maintenance page"}
                  </p>
                </div>

                {/* Countdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{lang === "ar" ? "تاريخ العد التنازلي" : "Countdown Date"}</Label>
                    <Input
                      type="datetime-local"
                      value={settings["maintenance.countdownDate"] || ""}
                      onChange={(e) => updateSetting("maintenance.countdownDate", e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={settings["maintenance.showCountdown"] === "true"}
                        onCheckedChange={(v) => updateSetting("maintenance.showCountdown", v ? "true" : "false")}
                      />
                      <Label>{lang === "ar" ? "إظهار العد التنازلي" : "Show Countdown"}</Label>
                    </div>
                  </div>
                </div>

                {/* Social Media Links */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{lang === "ar" ? "روابط التواصل الاجتماعي" : "Social Media Links"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {lang === "ar" ? "أضف روابط حساباتك لتظهر في صفحة الصيانة وتبقي الزوار على تواصل معك" : "Add your social media URLs to display on the maintenance page and keep visitors engaged"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-2">𝕏 Twitter / X</Label>
                      <Input
                        value={settings["social.twitter"] || ""}
                        onChange={(e) => updateSetting("social.twitter", e.target.value)}
                        placeholder="https://x.com/yourhandle"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">📷 Instagram</Label>
                      <Input
                        value={settings["social.instagram"] || ""}
                        onChange={(e) => updateSetting("social.instagram", e.target.value)}
                        placeholder="https://instagram.com/yourhandle"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">👻 Snapchat</Label>
                      <Input
                        value={settings["social.snapchat"] || ""}
                        onChange={(e) => updateSetting("social.snapchat", e.target.value)}
                        placeholder="https://snapchat.com/add/yourhandle"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">🎵 TikTok</Label>
                      <Input
                        value={settings["social.tiktok"] || ""}
                        onChange={(e) => updateSetting("social.tiktok", e.target.value)}
                        placeholder="https://tiktok.com/@yourhandle"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">💼 LinkedIn</Label>
                      <Input
                        value={settings["social.linkedin"] || ""}
                        onChange={(e) => updateSetting("social.linkedin", e.target.value)}
                        placeholder="https://linkedin.com/company/yourcompany"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">▶️ YouTube</Label>
                      <Input
                        value={settings["social.youtube"] || ""}
                        onChange={(e) => updateSetting("social.youtube", e.target.value)}
                        placeholder="https://youtube.com/@yourchannel"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Save button for other maintenance settings */}
                <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>

                {/* Preview hint */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {lang === "ar"
                      ? "ملاحظة: بصفتك مديراً، يمكنك الوصول للموقع حتى أثناء وضع الصيانة. الزوار سيرون صفحة قريباً فقط."
                      : "Note: As an admin, you can access the site even during maintenance mode. Visitors will only see the coming soon page."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
