import SEOHead from "@/components/SEOHead";
import DashboardLayout from "@/components/DashboardLayout";
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
import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import {
  Settings, Image, Palette, DollarSign, FileText, Users, Shield, BarChart3,
  ArrowRight, ArrowLeft, Save, Upload, RefreshCw, Globe, MapPin, BookOpen, Building2,
  ChevronDown, ChevronUp, Eye, Trash2, Plus, Search, MessageCircle, Phone,
  CreditCard, LayoutGrid, Home as HomeIcon, Video, Calendar, Clock, HelpCircle, ToggleLeft, ToggleRight, Copy, Lock, Download, ImageIcon, Share2
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [fieldsLoadedCount, setFieldsLoadedCount] = useState(0);

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
      setFieldsLoadedCount(Object.keys(map).filter(k => map[k] && map[k].trim() !== '').length);
    }
  }, [settingsQuery.data]);

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveSettings = () => {
    updateMutation.mutate({ settings });
    setDirty(false);
    setLastSavedAt(new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US'));
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

  // Check if current user is root admin
  const isCurrentUserRootAdmin = useMemo(() => {
    if (!user || !permsQuery.data) return false;
    const data = permsQuery.data as any[];
    if (!Array.isArray(data)) return false;
    // Use loose equality (==) to handle string vs number id mismatch
    return data.some((p: any) => String(p.userId) === String(user.id) && p.isRootAdmin);
  }, [user, permsQuery.data]);

  // Bank card refs for copy-as-image
  const bankCardRef = useRef<HTMLDivElement>(null);
  const bankCard2Ref = useRef<HTMLDivElement>(null);

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
      <SEOHead title="Settings | المفتاح الشهري - Monthly Key" />
        <p className="text-lg text-muted-foreground">{lang === "ar" ? "غير مصرح" : "Unauthorized"}</p>
      </div>
    );
  }

  const SettingField = ({ label, settingKey, type = "text", placeholder, disabled = false }: { label: string; settingKey: string; type?: string; placeholder?: string; disabled?: boolean }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {type === "textarea" ? (
        <Textarea
          value={settings[settingKey] || ""}
          onChange={(e) => updateSetting(settingKey, e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px]"
          dir={settingKey.endsWith("Ar") ? "rtl" : settingKey.endsWith("En") ? "ltr" : dir}
          disabled={disabled}
        />
      ) : type === "color" ? (
        <div className="flex gap-3 items-center">
          <input
            type="color"
            value={settings[settingKey] || "#15803d"}
            onChange={(e) => updateSetting(settingKey, e.target.value)}
            className="w-12 h-10 rounded border cursor-pointer"
            disabled={disabled}
          />
          <Input
            value={settings[settingKey] || ""}
            onChange={(e) => updateSetting(settingKey, e.target.value)}
            placeholder="#15803d"
            className="flex-1"
            disabled={disabled}
          />
        </div>
      ) : (
        <Input
          type={type}
          value={settings[settingKey] || ""}
          onChange={(e) => updateSetting(settingKey, e.target.value)}
          placeholder={placeholder}
          dir={settingKey.endsWith("Ar") ? "rtl" : settingKey.endsWith("En") ? "ltr" : undefined}
          disabled={disabled}
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
    <DashboardLayout>
    <div className="bg-background w-full">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
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
            <div className="flex items-center gap-3 flex-wrap">
              {/* DB source indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <div className={`h-2 w-2 rounded-full ${settingsQuery.isLoading ? 'bg-yellow-500 animate-pulse' : settingsQuery.isError ? 'bg-red-500' : 'bg-green-500'}`} />
                <span>{t("settings.dbSource" as any)}</span>
                <span className="font-mono">{fieldsLoadedCount} {t("settings.fieldsLoaded" as any)}</span>
              </div>
              {lastSavedAt && (
                <div className="text-xs text-muted-foreground">
                  {t("settings.lastSavedAt" as any)}: {lastSavedAt}
                </div>
              )}
              {dirty && (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 dark:bg-amber-950/30">
                  {t("settings.unsavedChanges" as any)}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <RefreshCw className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"} ${seedMutation.isPending ? "animate-spin" : ""}`} />
                {t("settings.seedDefaults")}
              </Button>
              {dirty && (
                <Button size="sm" onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
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
            <TabsTrigger value="cities" className="gap-2"><Building2 className="h-4 w-4" />{lang === "ar" ? "المدن" : "Cities"}</TabsTrigger>
            <TabsTrigger value="districts" className="gap-2"><MapPin className="h-4 w-4" />{t("districts.title")}</TabsTrigger>
            <TabsTrigger value="services" className="gap-2"><LayoutGrid className="h-4 w-4" />{lang === "ar" ? "الخدمات" : "Services"}</TabsTrigger>
            <TabsTrigger value="homepage" className="gap-2"><HomeIcon className="h-4 w-4" />{lang === "ar" ? "الصفحة الرئيسية" : "Homepage"}</TabsTrigger>
            <TabsTrigger value="payment" className="gap-2"><CreditCard className="h-4 w-4" />{lang === "ar" ? "الدفع" : "Payment"}</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="h-4 w-4" />{lang === "ar" ? "واتساب" : "WhatsApp"}</TabsTrigger>
            <TabsTrigger value="inspections" className="gap-2"><Calendar className="h-4 w-4" />{lang === "ar" ? "طلبات المعاينة" : "Inspections"}</TabsTrigger>
            <TabsTrigger value="faq" className="gap-2"><HelpCircle className="h-4 w-4" />{lang === "ar" ? "الأسئلة الشائعة" : "FAQ"}</TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2"><Shield className="h-4 w-4" />{lang === "ar" ? "وضع الصيانة" : "Maintenance Mode"}</TabsTrigger>
            <TabsTrigger value="datamgmt" className="gap-2"><Trash2 className="h-4 w-4" />{lang === "ar" ? "إدارة البيانات" : "Data Management"}</TabsTrigger>
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
                        <img loading="lazy" src={settings["site.logoUrl"]} alt="Logo" className="h-16 w-16 object-contain rounded border" />
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
                        <img loading="lazy" src={settings["site.faviconUrl"]} alt="Favicon" className="h-10 w-10 object-contain rounded border" />
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
                        <img loading="lazy" src={settings["hero.bgImage"]} alt="Hero BG" className="h-24 w-40 object-cover rounded border" />
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
                    {/* Poster / Fallback Image for Video */}
                    <div className="mt-4 space-y-2">
                      <Label>{lang === "ar" ? "صورة البوستر (تظهر أثناء تحميل الفيديو)" : "Poster Image (shown while video loads)"}</Label>
                      <div className="flex items-center gap-4">
                        {settings["hero.bgImage"] && (
                          <img loading="lazy" src={settings["hero.bgImage"]} alt="Poster" className="h-20 w-36 object-cover rounded border" />
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleFileUpload("hero.bgImage")}>
                          <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                          {lang === "ar" ? "رفع صورة بوستر" : "Upload Poster"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seasonal Theme Presets */}
                <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                  <Label className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    {lang === "ar" ? "قوالب موسمية جاهزة" : "Seasonal Presets"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {lang === "ar" ? "اختر قالب موسمي لتطبيقه على الهيرو بضغطة واحدة" : "Choose a seasonal preset to apply to the hero section"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        id: "default",
                        emoji: "🏙️",
                        labelAr: "الرياض (افتراضي)",
                        labelEn: "Riyadh (Default)",
                        titleAr: "خبير الإيجار الشهري — الآن في السعودية",
                        titleEn: "Monthly Rental Expert — Now in Saudi Arabia",
                        subtitleAr: "إدارة إيجارات شهرية متميزة | الرياض",
                        subtitleEn: "Premium monthly rental management | Riyadh",
                        bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-riyadh-crHAsSyPKDbbHqpiKFQyPb.png",
                        overlayOpacity: "40",
                      },
                      {
                        id: "riyadh-season",
                        emoji: "🎉",
                        labelAr: "موسم الرياض",
                        labelEn: "Riyadh Season",
                        titleAr: "موسم الرياض — احجز إقامتك الشهرية",
                        titleEn: "Riyadh Season — Book Your Monthly Stay",
                        subtitleAr: "عروض حصرية لموسم الرياض | شقق وفلل مفروشة",
                        subtitleEn: "Exclusive Riyadh Season offers | Furnished apartments & villas",
                        bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/riyadh-season-hero-dghiP7dbg9qJ7wMhv8ZKke.png",
                        overlayOpacity: "30",
                      },
                      {
                        id: "ramadan",
                        emoji: "🌙",
                        labelAr: "رمضان",
                        labelEn: "Ramadan",
                        titleAr: "رمضان كريم — إيجارك الشهري بأفضل الأسعار",
                        titleEn: "Ramadan Kareem — Best Monthly Rental Deals",
                        subtitleAr: "عروض رمضان الحصرية | الرياض",
                        subtitleEn: "Exclusive Ramadan Offers | Riyadh",
                        bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/ramadan-hero-46fiPSfUNcQjDW4JoZqJZr.png",
                        overlayOpacity: "35",
                      },
                      {
                        id: "eid-al-fitr",
                        emoji: "✨",
                        labelAr: "عيد الفطر",
                        labelEn: "Eid Al Fitr",
                        titleAr: "عيد فطر مبارك — إقامتك الشهرية بأفضل العروض",
                        titleEn: "Eid Mubarak — Best Monthly Stay Deals",
                        subtitleAr: "احتفل بالعيد في أرقى العقارات | الرياض",
                        subtitleEn: "Celebrate Eid in premium properties | Riyadh",
                        bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/eid-al-fitr-hero-3GkXiKgkYxsaZXTy2HGSe4.png",
                        overlayOpacity: "30",
                      },
                      {
                        id: "eid-al-adha",
                        emoji: "🕋",
                        labelAr: "عيد الأضحى",
                        labelEn: "Eid Al Adha",
                        titleAr: "عيد أضحى مبارك — إقامة شهرية مميزة",
                        titleEn: "Eid Al Adha Mubarak — Premium Monthly Stays",
                        subtitleAr: "احتفل بعيد الأضحى في أفضل العقارات | الرياض",
                        subtitleEn: "Celebrate Eid Al Adha in the finest properties | Riyadh",
                        bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/eid-al-adha-hero-huTRkuFTD4Njg2Tec9zFiq.png",
                        overlayOpacity: "30",
                      },
                      {
                        id: "national-day",
                        emoji: "🇸🇦",
                        labelAr: "اليوم الوطني",
                        labelEn: "National Day",
                        titleAr: "اليوم الوطني السعودي — عروض حصرية",
                        titleEn: "Saudi National Day — Exclusive Offers",
                        subtitleAr: "احتفل باليوم الوطني مع أفضل الإيجارات الشهرية",
                        subtitleEn: "Celebrate National Day with the best monthly rentals",
                        bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/national-day-hero-RwPuYjSu9VJ28Q6JMB42m4.png",
                        overlayOpacity: "30",
                      },
                      {
                        id: "founding-day",
                        emoji: "🏰",
                        labelAr: "يوم التأسيس",
                        labelEn: "Founding Day",
                        titleAr: "يوم التأسيس — إقامة شهرية بروح التراث",
                        titleEn: "Founding Day — Monthly Stay with Heritage Spirit",
                        subtitleAr: "احتفل بيوم التأسيس في أرقى العقارات | الرياض",
                        subtitleEn: "Celebrate Founding Day in premium properties | Riyadh",
                        bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/founding-day-hero-A5uqE2DCV8i4CK8joSxCa8.png",
                        overlayOpacity: "30",
                      },
                    ].map((preset) => {
                      const isActive = settings["hero.bgImage"] === preset.bgImage
                        && settings["hero.titleAr"] === preset.titleAr;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            updateSetting("hero.titleAr", preset.titleAr);
                            updateSetting("hero.titleEn", preset.titleEn);
                            updateSetting("hero.subtitleAr", preset.subtitleAr);
                            updateSetting("hero.subtitleEn", preset.subtitleEn);
                            updateSetting("hero.bgType", "image");
                            updateSetting("hero.bgImage", preset.bgImage);
                            updateSetting("hero.bgVideo", "");
                            updateSetting("hero.overlayOpacity", preset.overlayOpacity);
                            toast.info(lang === "ar"
                              ? `تم تطبيق قالب ${preset.labelAr} — اضغط حفظ`
                              : `${preset.labelEn} preset applied — click Save`);
                          }}
                          className={`relative group rounded-lg overflow-hidden border-2 transition-all hover:shadow-lg ${
                            isActive
                              ? "border-[#3ECFC0] ring-2 ring-[#3ECFC0]/30"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          {/* Preview image */}
                          <div className="relative h-28 w-full">
                            <img
                              src={preset.bgImage}
                              alt={lang === "ar" ? preset.labelAr : preset.labelEn}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${Number(preset.overlayOpacity) / 100})` }} />
                            {/* Preview text overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-2">
                              <p className="text-[10px] font-bold text-center leading-tight line-clamp-2 drop-shadow-md">
                                {lang === "ar" ? preset.titleAr : preset.titleEn}
                              </p>
                              <p className="text-[8px] text-white/70 mt-0.5 text-center line-clamp-1">
                                {lang === "ar" ? preset.subtitleAr : preset.subtitleEn}
                              </p>
                            </div>
                            {/* Active badge */}
                            {isActive && (
                              <div className="absolute top-1.5 end-1.5 bg-[#3ECFC0] text-[#0B1E2D] text-[9px] font-bold px-1.5 py-0.5 rounded">
                                {lang === "ar" ? "نشط" : "Active"}
                              </div>
                            )}
                          </div>
                          {/* Label bar */}
                          <div className="px-2 py-1.5 bg-card text-card-foreground text-xs font-medium text-center">
                            {preset.emoji} {lang === "ar" ? preset.labelAr : preset.labelEn}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                    {lang === "ar" ? "تحكم في المدد المسموحة والتسميات وطريقة احتساب التأمين" : "Control allowed durations, labels, and insurance calculation method"}
                  </p>
                  <div className="space-y-4">
                    {/* Insurance Configuration — Admin-only controls */}
                    <div className="p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 space-y-4">
                      <h4 className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Shield className="h-4 w-4" />
                        {lang === "ar" ? "⚙️ إعدادات التأمين (مرئي للأدمن فقط)" : "⚙️ Insurance Settings (Admin-only)"}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {lang === "ar"
                          ? "عند تفعيل إخفاء التأمين، سيتم دمج مبلغ التأمين في سعر الإيجار الظاهر للمستأجر. الإجمالي يبقى نفسه."
                          : "When hidden, insurance amount is merged into the displayed rent total. Grand total stays the same."}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Insurance Mode: percentage or fixed */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            {lang === "ar" ? "طريقة احتساب التأمين" : "Insurance Calculation Mode"}
                          </Label>
                          <select
                            value={settings["calculator.insuranceMode"] || "percentage"}
                            onChange={(e) => updateSetting("calculator.insuranceMode", e.target.value)}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="percentage">{lang === "ar" ? "نسبة مئوية (%)" : "Percentage (%)"}</option>
                            <option value="fixed">{lang === "ar" ? "مبلغ ثابت (SAR)" : "Fixed Amount (SAR)"}</option>
                          </select>
                        </div>
                        {/* Conditional: show % field or fixed amount field */}
                        {(settings["calculator.insuranceMode"] || "percentage") === "percentage" ? (
                          <SettingField
                            label={lang === "ar" ? "نسبة التأمين %" : "Insurance Rate %"}
                            settingKey="fees.depositPercent"
                            type="number"
                            placeholder="10"
                          />
                        ) : (
                          <SettingField
                            label={lang === "ar" ? "مبلغ التأمين الثابت (SAR)" : "Fixed Insurance Amount (SAR)"}
                            settingKey="calculator.insuranceFixedAmount"
                            type="number"
                            placeholder="1000"
                          />
                        )}
                      </div>
                      {/* Hide insurance from tenant toggle */}
                      <div className="flex items-center justify-between p-3 rounded-md border bg-background">
                        <div>
                          <Label className="text-sm font-medium">
                            {lang === "ar" ? "إخفاء التأمين عن المستأجر" : "Hide Insurance from Tenant"}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {lang === "ar"
                              ? "يدمج التأمين في سعر الإيجار بدون علم المستأجر"
                              : "Merges insurance into rent price without tenant knowing"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateSetting(
                            "calculator.hideInsuranceFromTenant",
                            settings["calculator.hideInsuranceFromTenant"] === "true" ? "false" : "true"
                          )}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings["calculator.hideInsuranceFromTenant"] === "true"
                              ? "bg-amber-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings["calculator.hideInsuranceFromTenant"] === "true"
                                ? (dir === "rtl" ? "-translate-x-6" : "translate-x-6")
                                : (dir === "rtl" ? "-translate-x-1" : "translate-x-1")
                            }`}
                          />
                        </button>
                      </div>
                    </div>

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

                {/* ─── Moyasar Payment Section ─── */}
                <div className="border-t border-border pt-6 mt-6" />
                <MoyasarStatusIndicator />
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                    {lang === "ar" ? "الدفع عبر Moyasar" : "Moyasar Payment"}
                  </h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {lang === "ar" 
                      ? "بوابة الدفع الأساسية للسعودية: بطاقات مدى + Apple Pay + Google Pay. احصل على البيانات من dashboard.moyasar.com" 
                      : "Primary payment gateway for KSA: mada cards + Apple Pay + Google Pay. Get credentials from dashboard.moyasar.com"}
                  </p>
                </div>
                <SettingField 
                  label={lang === "ar" ? "Moyasar Publishable Key" : "Moyasar Publishable Key"} 
                  settingKey="moyasar.publishableKey" 
                  placeholder="pk_test_..." 
                />
                <SettingField 
                  label={lang === "ar" ? "Moyasar Secret Key" : "Moyasar Secret Key"} 
                  settingKey="moyasar.secretKey" 
                  placeholder="sk_test_..." 
                />
                <SettingField 
                  label={lang === "ar" ? "Moyasar Webhook Secret" : "Moyasar Webhook Secret"} 
                  settingKey="moyasar.webhookSecret" 
                  placeholder="whsec_..." 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "الوضع" : "Mode"}</Label>
                    <Select 
                      value={settings["moyasar.mode"] || "test"} 
                      onValueChange={(v) => updateSetting("moyasar.mode", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="test">{lang === "ar" ? "تجريبي (Test)" : "Test (Sandbox)"}</SelectItem>
                        <SelectItem value="live">{lang === "ar" ? "إنتاجي (Live)" : "Live (Production)"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "العملة" : "Currency"}</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-muted-foreground">
                      SAR
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "تفعيل Moyasar" : "Enable Moyasar"}</Label>
                    <Select 
                      value={settings["moyasar.enabled"] || "false"} 
                      onValueChange={(v) => updateSetting("moyasar.enabled", v)}
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
                {/* Payment Method Toggles */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-sm">
                    {lang === "ar" ? "طرق الدفع المتاحة" : "Available Payment Methods"}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{lang === "ar" ? "بطاقات مدى" : "mada Cards"}</Label>
                      <Select 
                        value={settings["moyasar.enableMadaCards"] || "true"} 
                        onValueChange={(v) => updateSetting("moyasar.enableMadaCards", v)}
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
                      <Label>Apple Pay</Label>
                      <Select 
                        value={settings["moyasar.enableApplePay"] || "false"} 
                        onValueChange={(v) => updateSetting("moyasar.enableApplePay", v)}
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
                      <Label>Google Pay</Label>
                      <Select 
                        value={settings["moyasar.enableGooglePay"] || "false"} 
                        onValueChange={(v) => updateSetting("moyasar.enableGooglePay", v)}
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
                  <p className="text-xs text-muted-foreground">
                    {lang === "ar" 
                      ? "طرق الدفع تظهر فقط إذا كانت مفعلة ومفاتيح Moyasar مُعدّة. Tabby و Tamara سيتم إضافتهما في المرحلة الثانية." 
                      : "Payment methods appear only if enabled AND Moyasar keys are configured. Tabby & Tamara will be added in Phase 2."}
                  </p>
                </div>

                {/* ─── Bank Transfer Info Section ─── */}
                <div className="border-t border-border pt-6 mt-6" />
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {lang === "ar" ? "معلومات الحساب البنكي للتحويل" : "Bank Transfer Information"}
                    {!isCurrentUserRootAdmin && (
                      <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" />{lang === "ar" ? "للقراءة فقط" : "Read Only"}</Badge>
                    )}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {lang === "ar" 
                      ? isCurrentUserRootAdmin 
                        ? "أدخل معلومات حسابك البنكي لإرسالها للعملاء عند اختيار التحويل البنكي. يمكنك مشاركة بطاقة البنك مع العملاء." 
                        : "فقط المدير الرئيسي يمكنه تعديل معلومات البنك. يمكنك مشاركة البطاقة فقط."
                      : isCurrentUserRootAdmin
                        ? "Enter your bank account details to share with clients who choose bank transfer."
                        : "Only the root admin can edit bank details. You can share the card only."}
                  </p>
                </div>

                {/* ─── Bank Account 1 ─── */}
                <h4 className="text-sm font-semibold mt-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {lang === "ar" ? "الحساب البنكي الأول" : "Bank Account 1"}
                </h4>
                <SettingField 
                  label={lang === "ar" ? "اسم البنك (عربي)" : "Bank Name (Arabic)"} 
                  settingKey="bank.nameAr" 
                  placeholder={lang === "ar" ? "مثال: البنك الأهلي السعودي" : "e.g. Al Ahli Bank"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "اسم البنك (إنجليزي)" : "Bank Name (English)"} 
                  settingKey="bank.nameEn" 
                  placeholder={lang === "ar" ? "مثال: Saudi National Bank" : "e.g. Saudi National Bank"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "اسم صاحب الحساب" : "Account Holder Name"} 
                  settingKey="bank.accountHolder" 
                  placeholder={lang === "ar" ? "الاسم كما يظهر في الحساب البنكي" : "Name as it appears on the bank account"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "رقم الآيبان (IBAN)" : "IBAN Number"} 
                  settingKey="bank.iban" 
                  placeholder="SA0000000000000000000000"
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "رقم الحساب" : "Account Number"} 
                  settingKey="bank.accountNumber" 
                  placeholder={lang === "ar" ? "رقم الحساب البنكي" : "Bank account number"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "رمز السويفت (SWIFT)" : "SWIFT Code"} 
                  settingKey="bank.swiftCode" 
                  placeholder="NCBKSAJE"
                  disabled={!isCurrentUserRootAdmin}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "تفعيل التحويل البنكي" : "Enable Bank Transfer"}</Label>
                    <Select 
                      value={settings["bank.transferEnabled"] || "false"} 
                      onValueChange={(v) => updateSetting("bank.transferEnabled", v)}
                      disabled={!isCurrentUserRootAdmin}
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

                  {/* Bank Page Image */}
                  <div className="space-y-2">
                    <Label>{lang === "ar" ? "صورة صفحة البنك" : "Bank Page Image"}</Label>
                    <p className="text-xs text-muted-foreground">
                      {lang === "ar" ? "الصورة التي تظهر في صفحة مشاركة البنك (monthlykey.com/bank)" : "Image shown on the bank share page (monthlykey.com/bank)"}
                    </p>
                    <div className="flex items-center gap-4">
                      {settings["bank.pageImage"] && (
                        <img loading="lazy" src={settings["bank.pageImage"]} alt="Bank Page" className="h-16 w-16 object-contain rounded-xl border border-border" />
                      )}
                      <Button variant="outline" onClick={() => handleFileUpload("bank.pageImage")} disabled={!isCurrentUserRootAdmin}>
                        <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "رفع صورة" : "Upload Image"}
                      </Button>
                      {settings["bank.pageImage"] && isCurrentUserRootAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => updateSetting("bank.pageImage", "")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bank Card 1 Preview */}
                {settings["bank.iban"] && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-3">
                      {lang === "ar" ? "معاينة بطاقة البنك الأول" : "Bank Card 1 Preview"}
                    </h4>
                    <div ref={bankCardRef} className="max-w-md mx-auto bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-2xl p-4 sm:p-6 text-white shadow-xl border border-slate-700/50 overflow-hidden">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/></svg>
                          <span className="text-xs text-slate-400 uppercase tracking-wider">
                            {lang === "ar" ? "معلومات التحويل البنكي" : "Bank Transfer Details"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">Monthly Key</div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            {lang === "ar" ? "البنك" : "Bank"}
                          </div>
                          <div className="text-xs sm:text-sm font-semibold break-words">
                            {(lang === "ar" ? settings["bank.nameAr"] : settings["bank.nameEn"]) || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            {lang === "ar" ? "اسم المستفيد" : "Beneficiary"}
                          </div>
                          <div className="text-xs sm:text-sm font-semibold break-words">
                            {settings["bank.accountHolder"] || "—"}
                          </div>
                        </div>
                        <div className="group/iban cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank.iban"] || ""); toast.success(lang === "ar" ? "تم نسخ الآيبان" : "IBAN copied"); }}>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">IBAN <Copy className="h-3 w-3 opacity-0 group-hover/iban:opacity-100 transition-opacity" /></div>
                          <div className="text-xs sm:text-sm font-mono tracking-wider text-amber-300 break-all">
                            {settings["bank.iban"] || "—"}
                          </div>
                        </div>
                        {settings["bank.accountNumber"] && (
                          <div className="group/acc cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank.accountNumber"] || ""); toast.success(lang === "ar" ? "تم نسخ رقم الحساب" : "Account number copied"); }}>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                              {lang === "ar" ? "رقم الحساب" : "Account No."} <Copy className="h-3 w-3 opacity-0 group-hover/acc:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-xs sm:text-sm font-mono break-all">{settings["bank.accountNumber"]}</div>
                          </div>
                        )}
                        {settings["bank.swiftCode"] && (
                          <div className="group/swift cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank.swiftCode"] || ""); toast.success(lang === "ar" ? "تم نسخ رمز السويفت" : "SWIFT code copied"); }}>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">SWIFT <Copy className="h-3 w-3 opacity-0 group-hover/swift:opacity-100 transition-opacity" /></div>
                            <div className="text-sm font-mono">{settings["bank.swiftCode"]}</div>
                          </div>
                        )}
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          {lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt"}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const bankText = [
                            `${lang === "ar" ? "البنك" : "Bank"}: ${(lang === "ar" ? settings["bank.nameAr"] : settings["bank.nameEn"]) || ""}`,
                            `${lang === "ar" ? "اسم المستفيد" : "Beneficiary"}: ${settings["bank.accountHolder"] || ""}`,
                            `IBAN: ${settings["bank.iban"] || ""}`,
                            settings["bank.accountNumber"] ? `${lang === "ar" ? "رقم الحساب" : "Account No."}: ${settings["bank.accountNumber"]}` : "",
                            settings["bank.swiftCode"] ? `SWIFT: ${settings["bank.swiftCode"]}` : "",
                            "",
                            lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt",
                          ].filter(Boolean).join("\n");
                          navigator.clipboard.writeText(bankText);
                          toast.success(lang === "ar" ? "تم نسخ معلومات البنك" : "Bank info copied to clipboard");
                        }}
                      >
                        <Copy className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "نسخ كنص" : "Copy as Text"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          try {
                            const canvas = document.createElement("canvas");
                            const scale = 2;
                            const w = 500; const h = 380;
                            canvas.width = w * scale; canvas.height = h * scale;
                            const ctx = canvas.getContext("2d");
                            if (!ctx) return;
                            ctx.scale(scale, scale);
                            // Background gradient
                            const grad = ctx.createLinearGradient(0, 0, w, h);
                            grad.addColorStop(0, "#1e293b"); grad.addColorStop(0.5, "#0f172a"); grad.addColorStop(1, "#020617");
                            ctx.fillStyle = grad;
                            ctx.beginPath();
                            ctx.roundRect(0, 0, w, h, 16);
                            ctx.fill();
                            // Border
                            ctx.strokeStyle = "rgba(51,65,85,0.5)"; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.roundRect(0, 0, w, h, 16); ctx.stroke();
                            // Header
                            ctx.fillStyle = "#fbbf24"; ctx.font = "bold 14px sans-serif";
                            ctx.textAlign = "left";
                            ctx.fillText("\u25A0 " + (lang === "ar" ? "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0628\u0646\u0643\u064a" : "Bank Transfer Details"), 24, 36);
                            ctx.fillStyle = "#475569"; ctx.font = "11px sans-serif";
                            ctx.textAlign = "right";
                            ctx.fillText("Monthly Key", w - 24, 36);
                            ctx.textAlign = "left";
                            let y = 70;
                            const drawField = (label: string, value: string, color = "#ffffff") => {
                              ctx.fillStyle = "#64748b"; ctx.font = "10px sans-serif";
                              ctx.fillText(label.toUpperCase(), 24, y); y += 16;
                              ctx.fillStyle = color; ctx.font = "bold 14px monospace";
                              ctx.fillText(value, 24, y); y += 30;
                            };
                            drawField(lang === "ar" ? "\u0627\u0644\u0628\u0646\u0643" : "Bank", (lang === "ar" ? settings["bank.nameAr"] : settings["bank.nameEn"]) || "\u2014");
                            drawField(lang === "ar" ? "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f" : "Beneficiary", settings["bank.accountHolder"] || "\u2014");
                            drawField("IBAN", settings["bank.iban"] || "\u2014", "#fcd34d");
                            if (settings["bank.accountNumber"]) drawField(lang === "ar" ? "\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628" : "Account No.", settings["bank.accountNumber"]);
                            if (settings["bank.swiftCode"]) drawField("SWIFT", settings["bank.swiftCode"]);
                            // Footer line
                            ctx.strokeStyle = "rgba(51,65,85,0.5)"; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.moveTo(24, h - 40); ctx.lineTo(w - 24, h - 40); ctx.stroke();
                            ctx.fillStyle = "#475569"; ctx.font = "10px sans-serif";
                            ctx.fillText(lang === "ar" ? "\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u062b\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u064a\u0635\u0627\u0644 \u0627\u0644\u062f\u0641\u0639" : "Please transfer then send payment receipt", 24, h - 18);
                            // Download
                            const a = document.createElement("a");
                            a.href = canvas.toDataURL("image/png");
                            a.download = "bank-card.png";
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            toast.success(lang === "ar" ? "\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0643\u0635\u0648\u0631\u0629" : "Card downloaded as image");
                          } catch (err) {
                            console.error("Canvas error:", err);
                            toast.error(lang === "ar" ? "\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0648\u0631\u0629" : "Failed to download image");
                          }
                        }}
                      >
                        <Download className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "\u062a\u062d\u0645\u064a\u0644 \u0643\u0635\u0648\u0631\u0629" : "Download as Image"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = window.location.origin + "/bank";
                          navigator.clipboard.writeText(url);
                          toast.success(lang === "ar" ? "تم نسخ رابط المشاركة" : "Share link copied");
                        }}
                      >
                        <Share2 className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "نسخ رابط المشاركة" : "Copy Share Link"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* ─── Bank Account 2 ─── */}
                <div className="border-t border-border pt-6 mt-6" />
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {lang === "ar" ? "الحساب البنكي الثاني (اختياري)" : "Bank Account 2 (Optional)"}
                </h4>
                <SettingField 
                  label={lang === "ar" ? "اسم البنك (عربي)" : "Bank Name (Arabic)"} 
                  settingKey="bank2.nameAr" 
                  placeholder={lang === "ar" ? "مثال: بنك الراجحي" : "e.g. Al Rajhi Bank"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "اسم البنك (إنجليزي)" : "Bank Name (English)"} 
                  settingKey="bank2.nameEn" 
                  placeholder={lang === "ar" ? "مثال: Al Rajhi Bank" : "e.g. Al Rajhi Bank"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "اسم صاحب الحساب" : "Account Holder Name"} 
                  settingKey="bank2.accountHolder" 
                  placeholder={lang === "ar" ? "الاسم كما يظهر في الحساب البنكي" : "Name as it appears on the bank account"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "رقم الآيبان (IBAN)" : "IBAN Number"} 
                  settingKey="bank2.iban" 
                  placeholder="SA0000000000000000000000"
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "رقم الحساب" : "Account Number"} 
                  settingKey="bank2.accountNumber" 
                  placeholder={lang === "ar" ? "رقم الحساب البنكي" : "Bank account number"}
                  disabled={!isCurrentUserRootAdmin}
                />
                <SettingField 
                  label={lang === "ar" ? "رمز السويفت (SWIFT)" : "SWIFT Code"} 
                  settingKey="bank2.swiftCode" 
                  placeholder="RJHISARI"
                  disabled={!isCurrentUserRootAdmin}
                />

                {/* Bank Card 2 Preview */}
                {settings["bank2.iban"] && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-3">
                      {lang === "ar" ? "معاينة بطاقة البنك الثاني" : "Bank Card 2 Preview"}
                    </h4>
                    <div ref={bankCard2Ref} className="max-w-md mx-auto bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 rounded-2xl p-4 sm:p-6 text-white shadow-xl border border-emerald-700/50 overflow-hidden">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/></svg>
                          <span className="text-xs text-emerald-400 uppercase tracking-wider">
                            {lang === "ar" ? "معلومات التحويل البنكي" : "Bank Transfer Details"}
                          </span>
                        </div>
                        <div className="text-xs text-emerald-500">Monthly Key</div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">
                            {lang === "ar" ? "البنك" : "Bank"}
                          </div>
                          <div className="text-xs sm:text-sm font-semibold break-words">
                            {(lang === "ar" ? settings["bank2.nameAr"] : settings["bank2.nameEn"]) || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">
                            {lang === "ar" ? "اسم المستفيد" : "Beneficiary"}
                          </div>
                          <div className="text-xs sm:text-sm font-semibold break-words">
                            {settings["bank2.accountHolder"] || "—"}
                          </div>
                        </div>
                        <div className="group/iban2 cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank2.iban"] || ""); toast.success(lang === "ar" ? "تم نسخ الآيبان" : "IBAN copied"); }}>
                          <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">IBAN <Copy className="h-3 w-3 opacity-0 group-hover/iban2:opacity-100 transition-opacity" /></div>
                          <div className="text-xs sm:text-sm font-mono tracking-wider text-emerald-300 break-all">
                            {settings["bank2.iban"] || "—"}
                          </div>
                        </div>
                        {settings["bank2.accountNumber"] && (
                          <div className="group/acc2 cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank2.accountNumber"] || ""); toast.success(lang === "ar" ? "تم نسخ رقم الحساب" : "Account number copied"); }}>
                            <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                              {lang === "ar" ? "رقم الحساب" : "Account No."} <Copy className="h-3 w-3 opacity-0 group-hover/acc2:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-xs sm:text-sm font-mono break-all">{settings["bank2.accountNumber"]}</div>
                          </div>
                        )}
                        {settings["bank2.swiftCode"] && (
                          <div className="group/swift2 cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank2.swiftCode"] || ""); toast.success(lang === "ar" ? "تم نسخ رمز السويفت" : "SWIFT code copied"); }}>
                            <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">SWIFT <Copy className="h-3 w-3 opacity-0 group-hover/swift2:opacity-100 transition-opacity" /></div>
                            <div className="text-sm font-mono">{settings["bank2.swiftCode"]}</div>
                          </div>
                        )}
                      </div>
                      <div className="mt-6 pt-4 border-t border-emerald-700/50 flex items-center justify-between">
                        <span className="text-[10px] text-emerald-500">
                          {lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt"}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const bankText = [
                            `${lang === "ar" ? "البنك" : "Bank"}: ${(lang === "ar" ? settings["bank2.nameAr"] : settings["bank2.nameEn"]) || ""}`,
                            `${lang === "ar" ? "اسم المستفيد" : "Beneficiary"}: ${settings["bank2.accountHolder"] || ""}`,
                            `IBAN: ${settings["bank2.iban"] || ""}`,
                            settings["bank2.accountNumber"] ? `${lang === "ar" ? "رقم الحساب" : "Account No."}: ${settings["bank2.accountNumber"]}` : "",
                            settings["bank2.swiftCode"] ? `SWIFT: ${settings["bank2.swiftCode"]}` : "",
                            "",
                            lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt",
                          ].filter(Boolean).join("\n");
                          navigator.clipboard.writeText(bankText);
                          toast.success(lang === "ar" ? "تم نسخ معلومات البنك" : "Bank info copied to clipboard");
                        }}
                      >
                        <Copy className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "نسخ كنص" : "Copy as Text"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          try {
                            const canvas = document.createElement("canvas");
                            const scale = 2;
                            const w = 500; const h = 380;
                            canvas.width = w * scale; canvas.height = h * scale;
                            const ctx = canvas.getContext("2d");
                            if (!ctx) return;
                            ctx.scale(scale, scale);
                            const grad = ctx.createLinearGradient(0, 0, w, h);
                            grad.addColorStop(0, "#064e3b"); grad.addColorStop(0.5, "#022c22"); grad.addColorStop(1, "#0f172a");
                            ctx.fillStyle = grad;
                            ctx.beginPath(); ctx.roundRect(0, 0, w, h, 16); ctx.fill();
                            ctx.strokeStyle = "rgba(6,95,70,0.5)"; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.roundRect(0, 0, w, h, 16); ctx.stroke();
                            ctx.fillStyle = "#34d399"; ctx.font = "bold 14px sans-serif";
                            ctx.textAlign = "left";
                            ctx.fillText("\u25A0 " + (lang === "ar" ? "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0628\u0646\u0643\u064a" : "Bank Transfer Details"), 24, 36);
                            ctx.fillStyle = "#065f46"; ctx.font = "11px sans-serif";
                            ctx.textAlign = "right";
                            ctx.fillText("Monthly Key", w - 24, 36);
                            ctx.textAlign = "left";
                            let y = 70;
                            const drawField = (label: string, value: string, color = "#ffffff") => {
                              ctx.fillStyle = "#34d399"; ctx.font = "10px sans-serif";
                              ctx.fillText(label.toUpperCase(), 24, y); y += 16;
                              ctx.fillStyle = color; ctx.font = "bold 14px monospace";
                              ctx.fillText(value, 24, y); y += 30;
                            };
                            drawField(lang === "ar" ? "\u0627\u0644\u0628\u0646\u0643" : "Bank", (lang === "ar" ? settings["bank2.nameAr"] : settings["bank2.nameEn"]) || "\u2014");
                            drawField(lang === "ar" ? "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f" : "Beneficiary", settings["bank2.accountHolder"] || "\u2014");
                            drawField("IBAN", settings["bank2.iban"] || "\u2014", "#6ee7b7");
                            if (settings["bank2.accountNumber"]) drawField(lang === "ar" ? "\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628" : "Account No.", settings["bank2.accountNumber"]);
                            if (settings["bank2.swiftCode"]) drawField("SWIFT", settings["bank2.swiftCode"]);
                            ctx.strokeStyle = "rgba(6,95,70,0.5)"; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.moveTo(24, h - 40); ctx.lineTo(w - 24, h - 40); ctx.stroke();
                            ctx.fillStyle = "#065f46"; ctx.font = "10px sans-serif";
                            ctx.fillText(lang === "ar" ? "\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u062b\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u064a\u0635\u0627\u0644 \u0627\u0644\u062f\u0641\u0639" : "Please transfer then send payment receipt", 24, h - 18);
                            const a = document.createElement("a");
                            a.href = canvas.toDataURL("image/png");
                            a.download = "bank-card-2.png";
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            toast.success(lang === "ar" ? "\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0643\u0635\u0648\u0631\u0629" : "Card downloaded as image");
                          } catch (err) {
                            console.error("Canvas error:", err);
                            toast.error(lang === "ar" ? "\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0648\u0631\u0629" : "Failed to download image");
                          }
                        }}
                      >
                        <Download className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "\u062a\u062d\u0645\u064a\u0644 \u0643\u0635\u0648\u0631\u0629" : "Download as Image"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = window.location.origin + "/bank";
                          navigator.clipboard.writeText(url);
                          toast.success(lang === "ar" ? "تم نسخ رابط المشاركة" : "Share link copied");
                        }}
                      >
                        <Share2 className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {lang === "ar" ? "نسخ رابط المشاركة" : "Copy Share Link"}
                      </Button>
                    </div>
                  </div>
                )}

                {isCurrentUserRootAdmin && (
                  <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto mt-4">
                    <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                    {t("settings.save")}
                  </Button>
                )}
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
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed" style={{ borderColor: settings["whatsapp.enabled"] === "true" ? "#25D366" : "#94a3b8" }}>
                  <div>
                    <h3 className="font-bold text-lg">{lang === "ar" ? "تفعيل زر واتساب" : "Enable WhatsApp Button"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "ar"
                        ? settings["whatsapp.enabled"] === "true" ? "✅ زر واتساب مفعّل ويظهر للزوار" : "❌ زر واتساب معطّل ولا يظهر للزوار"
                        : settings["whatsapp.enabled"] === "true" ? "✅ WhatsApp button is active and visible to visitors" : "❌ WhatsApp button is disabled and hidden"
                      }
                    </p>
                  </div>
                  <Button
                    variant={settings["whatsapp.enabled"] === "true" ? "default" : "outline"}
                    size="lg"
                    disabled={updateMutation.isPending}
                    onClick={() => {
                      const newVal = settings["whatsapp.enabled"] === "true" ? "false" : "true";
                      setSettings(prev => ({ ...prev, "whatsapp.enabled": newVal }));
                      updateMutation.mutate({ settings: { ...settings, "whatsapp.enabled": newVal } });
                    }}
                    className="min-w-[140px]"
                    style={settings["whatsapp.enabled"] === "true" ? { backgroundColor: "#25D366", color: "white" } : {}}
                  >
                    {settings["whatsapp.enabled"] === "true"
                      ? (lang === "ar" ? "تعطيل" : "Disable")
                      : (lang === "ar" ? "تفعيل" : "Enable")
                    }
                  </Button>
                </div>
                {/* ── Basic Config ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingField label={lang === "ar" ? "رقم واتساب (E.164 مع رمز الدولة)" : "WhatsApp Number (E.164 with country code)"} settingKey="whatsapp.number" placeholder="+966504466528" />
                  <SettingField label={lang === "ar" ? "اسم العلامة التجارية (عربي)" : "Brand Name (Arabic)"} settingKey="whatsapp.brandNameAr" placeholder="واتساب" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingField label={lang === "ar" ? "نص الزر (عربي)" : "Button Text (Arabic)"} settingKey="whatsapp.textAr" placeholder="تواصل معنا" />
                  <SettingField label={lang === "ar" ? "نص الزر (إنجليزي)" : "Button Text (English)"} settingKey="whatsapp.textEn" placeholder="Chat with us" />
                </div>

                {/* ── Visibility per Route ── */}
                <div className="border rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-sm">{lang === "ar" ? "إظهار الزر حسب الصفحة" : "Show Button per Page"}</h4>
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "الزر مخفي دائماً في صفحات تسجيل الدخول والتسجيل ولوحة الإدارة" : "Button is always hidden on login, register, OTP, auth, and admin pages"}</p>
                  {[
                    { key: "whatsapp.showOnHome", labelAr: "الصفحة الرئيسية", labelEn: "Home Page" },
                    { key: "whatsapp.showOnSearch", labelAr: "صفحة البحث", labelEn: "Search Page" },
                    { key: "whatsapp.showOnPropertyDetail", labelAr: "تفاصيل العقار", labelEn: "Property Detail" },
                  ].map(({ key, labelAr, labelEn }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 accent-[#25D366]"
                        checked={settings[key] === "true"}
                        onChange={() => {
                          const newVal = settings[key] === "true" ? "false" : "true";
                          setSettings(prev => ({ ...prev, [key]: newVal }));
                          setDirty(true);
                        }}
                      />
                      <span className="text-sm">{lang === "ar" ? labelAr : labelEn}</span>
                    </label>
                  ))}
                </div>

                {/* ── Per-Context Message Templates ── */}
                <div className="border rounded-xl p-4 space-y-4">
                  <h4 className="font-semibold text-sm">{lang === "ar" ? "قوالب الرسائل حسب السياق" : "Message Templates per Context"}</h4>
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "رسالة مختلفة لكل صفحة. إذا تُركت فارغة، تُستخدم الرسالة الافتراضية." : "Different message per page. If left empty, the default message is used."}</p>

                  <SettingField label={lang === "ar" ? "رسالة افتراضية (عربي)" : "Default Message (Arabic)"} settingKey="whatsapp.defaultMessageAr" placeholder="مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري" />
                  <SettingField label={lang === "ar" ? "رسالة افتراضية (إنجليزي)" : "Default Message (English)"} settingKey="whatsapp.defaultMessageEn" placeholder="Hello, I need help regarding monthly rental" />

                  <hr className="border-dashed" />
                  <SettingField label={lang === "ar" ? "رسالة الصفحة الرئيسية (عربي)" : "Home Page Message (Arabic)"} settingKey="whatsapp.homeMessageTemplateAr" placeholder="مرحباً، أبحث عن شقة للإيجار الشهري." />
                  <SettingField label={lang === "ar" ? "رسالة الصفحة الرئيسية (إنجليزي)" : "Home Page Message (English)"} settingKey="whatsapp.homeMessageTemplateEn" placeholder="Hello, I'm looking for a monthly rental." />

                  <hr className="border-dashed" />
                  <SettingField label={lang === "ar" ? "رسالة صفحة البحث (عربي)" : "Search Page Message (Arabic)"} settingKey="whatsapp.searchMessageTemplateAr" placeholder="مرحباً، أبحث عن عقار للإيجار الشهري." />
                  <SettingField label={lang === "ar" ? "رسالة صفحة البحث (إنجليزي)" : "Search Page Message (English)"} settingKey="whatsapp.searchMessageTemplateEn" placeholder="Hello, I'm searching for a monthly rental." />

                  <hr className="border-dashed" />
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "المتغيرات المتاحة لصفحة العقار: {{property_title}} {{property_id}} {{city}} {{url}}" : "Available placeholders for property page: {{property_title}} {{property_id}} {{city}} {{url}}"}</p>
                  <SettingField label={lang === "ar" ? "رسالة تفاصيل العقار (عربي)" : "Property Detail Message (Arabic)"} settingKey="whatsapp.propertyMessageTemplateAr" placeholder="مرحباً، أنا مهتم بالعقار: {{property_title}} في {{city}}" />
                  <SettingField label={lang === "ar" ? "رسالة تفاصيل العقار (إنجليزي)" : "Property Detail Message (English)"} settingKey="whatsapp.propertyMessageTemplateEn" placeholder="Hello, I'm interested in: {{property_title}} in {{city}}" />
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

          {/* Cities Management */}
          <TabsContent value="cities">
            <CitiesManagement lang={lang} dir={dir} isRtl={isRtl} />
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
                        <img loading="lazy" src={settings["maintenance.imageUrl"]} alt="" className="w-full h-full object-cover" />
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

          {/* Data Management - Root Admin Only */}
          <TabsContent value="datamgmt">
            <DataManagementTab lang={lang} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </DashboardLayout>
  );
}

/* ─── Data Management Tab Component ─── */
function DataManagementTab({ lang }: { lang: string }) {
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [purgeResult, setPurgeResult] = useState<Record<string, number> | null>(null);

  const purgeMutation = trpc.admin.purgeTestData.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message || (lang === "ar" ? "تم مسح البيانات بنجاح" : "Data purged successfully"));
      setPurgeResult(data.purged);
      setConfirmPhrase("");
      setSelectedCategories([]);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const categories = [
    { key: "financial", labelAr: "المدفوعات والسجل المالي", labelEn: "Payments & Financial Ledger", tables: "payments, payment_ledger, payment_method_settings" },
    { key: "bookings", labelAr: "الحجوزات والتمديدات", labelEn: "Bookings & Extensions", tables: "bookings, booking_extensions" },
    { key: "maintenance", labelAr: "طلبات الصيانة", labelEn: "Maintenance Requests", tables: "maintenanceRequests, maintenance_updates, emergency_maintenance" },
    { key: "messages", labelAr: "المحادثات والرسائل", labelEn: "Conversations & Messages", tables: "conversations, messages, whatsapp_messages" },
    { key: "reviews", labelAr: "التقييمات", labelEn: "Reviews", tables: "reviews" },
    { key: "notifications", labelAr: "الإشعارات", labelEn: "Notifications", tables: "notifications, push_subscriptions" },
    { key: "activities", labelAr: "سجل النشاط والتدقيق", labelEn: "Activity & Audit Log", tables: "userActivities, audit_log" },
    { key: "shomoos", labelAr: "سجلات شموس", labelEn: "Shomoos Submissions", tables: "shomoos_submissions" },
    { key: "otp", labelAr: "رموز التحقق", labelEn: "OTP Codes", tables: "otp_codes" },
  ];

  const toggleCategory = (key: string) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => {
    setSelectedCategories(["all"]);
  };

  const clearSelection = () => {
    setSelectedCategories([]);
    setPurgeResult(null);
  };

  const handlePurge = () => {
    if (selectedCategories.length === 0) {
      toast.error(lang === "ar" ? "اختر فئة واحدة على الأقل" : "Select at least one category");
      return;
    }
    purgeMutation.mutate({
      confirmPhrase,
      categories: selectedCategories as any,
    });
  };

  const requiredPhrase = "أؤكد مسح البيانات التجريبية";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          {lang === "ar" ? "مسح البيانات التجريبية" : "Purge Test Data"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "هذه الأداة تمسح البيانات التجريبية (المدفوعات، الحجوزات، إلخ) بدون التأثير على المستخدمين أو العقارات أو الإعدادات. متاحة فقط للمسؤول الرئيسي (Root Admin)."
            : "This tool purges test data (payments, bookings, etc.) without affecting users, properties, or settings. Available only to Root Admin."}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
            {lang === "ar"
              ? "⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه. سيتم حذف البيانات نهائياً."
              : "⚠️ Warning: This action is irreversible. Data will be permanently deleted."}
          </p>
        </div>

        {/* Category Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">
            {lang === "ar" ? "اختر البيانات المراد مسحها:" : "Select data to purge:"}
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-start transition-colors ${
                  selectedCategories.includes(cat.key) || selectedCategories.includes("all")
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Checkbox
                  checked={selectedCategories.includes(cat.key) || selectedCategories.includes("all")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{lang === "ar" ? cat.labelAr : cat.labelEn}</p>
                  <p className="text-xs text-muted-foreground font-mono">{cat.tables}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              {lang === "ar" ? "تحديد الكل" : "Select All"}
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              {lang === "ar" ? "إلغاء التحديد" : "Clear Selection"}
            </Button>
          </div>
        </div>

        {/* Confirmation Phrase */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            {lang === "ar" ? "اكتب عبارة التأكيد:" : "Type confirmation phrase:"}
          </Label>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? `اكتب: "${requiredPhrase}"` : `Type: "${requiredPhrase}"`}
          </p>
          <Input
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={requiredPhrase}
            dir="rtl"
            className="font-medium"
          />
        </div>

        {/* Purge Button */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          onClick={handlePurge}
          disabled={
            purgeMutation.isPending ||
            selectedCategories.length === 0 ||
            confirmPhrase !== requiredPhrase
          }
        >
          {purgeMutation.isPending ? (
            <RefreshCw className="h-4 w-4 me-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 me-2" />
          )}
          {lang === "ar" ? "مسح البيانات التجريبية" : "Purge Test Data"}
        </Button>

        {/* Results */}
        {purgeResult && (
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
              {lang === "ar" ? "✅ تم المسح بنجاح:" : "✅ Purge completed:"}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(purgeResult).map(([table, count]) => (
                <div key={table} className="text-xs flex justify-between">
                  <span className="font-mono text-muted-foreground">{table}</span>
                  <span className={count === -1 ? "text-yellow-600" : count > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                    {count === -1 ? (lang === "ar" ? "غير موجود" : "N/A") : `${count} ${lang === "ar" ? "سجل" : "rows"}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What is NOT affected */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
            {lang === "ar" ? "ℹ️ لن يتأثر بالمسح:" : "ℹ️ NOT affected by purge:"}
          </p>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
            <li>{lang === "ar" ? "المستخدمين وحساباتهم" : "Users and accounts"}</li>
            <li>{lang === "ar" ? "العقارات والمباني والوحدات" : "Properties, buildings, and units"}</li>
            <li>{lang === "ar" ? "المدن والأحياء" : "Cities and districts"}</li>
            <li>{lang === "ar" ? "إعدادات الموقع والتكاملات" : "Site settings and integrations"}</li>
            <li>{lang === "ar" ? "الصلاحيات والأدوار" : "Permissions and roles"}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Moyasar Status Indicator Component ─── */
function MoyasarStatusIndicator() {
  const { lang } = useI18n();
  const statusQuery = trpc.finance.moyasarPayment.getConfigStatus.useQuery(
    undefined,
    { staleTime: 30_000, refetchOnWindowFocus: true }
  );

  if (statusQuery.isLoading) {
    return (
      <div className="rounded-lg border border-border p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-48" />
      </div>
    );
  }

  const data = statusQuery.data;
  if (!data) return null;

  const statusColors: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    NOT_CONFIGURED: {
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-700 dark:text-red-300",
      dot: "bg-red-500",
      border: "border-red-200 dark:border-red-800",
    },
    CONFIGURED: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
      border: "border-amber-200 dark:border-amber-800",
    },
    LIVE: {
      bg: "bg-green-50 dark:bg-green-950/30",
      text: "text-green-700 dark:text-green-300",
      dot: "bg-green-500",
      border: "border-green-200 dark:border-green-800",
    },
  };

  const colors = statusColors[data.status] || statusColors.NOT_CONFIGURED;
  const statusLabel = lang === "ar" ? data.statusAr : data.statusEn;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${colors.dot} animate-pulse`} />
          <div>
            <h4 className={`font-semibold text-sm ${colors.text}`}>
              {lang === "ar" ? "حالة Moyasar" : "Moyasar Status"}
            </h4>
            <p className={`text-xs ${colors.text} opacity-80`}>{statusLabel}</p>
          </div>
        </div>
        <div className="text-end">
          <Badge variant={data.status === "LIVE" ? "default" : data.status === "CONFIGURED" ? "secondary" : "destructive"}
            className="text-[10px] px-2 py-0.5">
            {data.status === "LIVE" ? (lang === "ar" ? "مباشر" : "LIVE")
              : data.status === "CONFIGURED" ? (lang === "ar" ? "تجريبي" : "TEST")
              : (lang === "ar" ? "غير مُعد" : "OFF")}
          </Badge>
        </div>
      </div>
      {data.status !== "NOT_CONFIGURED" && (
        <div className={`mt-3 pt-3 border-t ${colors.border} text-xs ${colors.text} opacity-70 space-y-1`}>
          <p>
            <span className="font-medium">{lang === "ar" ? "Webhook URL:" : "Webhook URL:"}</span>{" "}
            <code className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px]">https://monthlykey.com{data.webhookUrl}</code>
          </p>
          <p>
            <span className="font-medium">{lang === "ar" ? "الوضع:" : "Mode:"}</span>{" "}
            {data.mode === "live" ? (lang === "ar" ? "إنتاجي" : "Production") : (lang === "ar" ? "تجريبي" : "Sandbox")}
          </p>
        </div>
      )}
      {data.status === "NOT_CONFIGURED" && (
        <p className={`mt-2 text-xs ${colors.text} opacity-70`}>
          {lang === "ar"
            ? "أدخل مفاتيح Moyasar أدناه لتفعيل الدفع الإلكتروني. شعارات الدفع تظهر حالياً ك\u0640 \"\u0642\u0631\u064a\u0628\u0627\u064b\"."
            : 'Enter your Moyasar keys below to enable online payments. Payment badges currently show as "Coming Soon".'}
        </p>
      )}
    </div>
  );
}

/* ─── Cities Management Component ─── */
function CitiesManagement({ lang, dir, isRtl }: { lang: string; dir: string; isRtl: boolean }) {
  const citiesQuery = trpc.cities.all.useQuery({ activeOnly: false });
  const toggleMutation = trpc.cities.toggle.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم التحديث" : "Updated"); citiesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const createMutation = trpc.cities.create.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تمت الإضافة" : "City added"); citiesQuery.refetch(); setShowAdd(false); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateMutation = trpc.cities.update.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم التحديث" : "Updated"); citiesQuery.refetch(); setEditingId(null); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMutation = trpc.cities.delete.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم الحذف" : "Deleted"); citiesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const uploadPhotoMutation = trpc.cities.uploadPhoto.useMutation({
    onSuccess: (data: any) => {
      toast.success(lang === "ar" ? "تم رفع الصورة" : "Photo uploaded");
      setForm(prev => ({ ...prev, imageUrl: data.url }));
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nameEn: "", nameAr: "", region: "", regionAr: "", imageUrl: "", isActive: true, sortOrder: 0 });

  const resetForm = () => setForm({ nameEn: "", nameAr: "", region: "", regionAr: "", imageUrl: "", isActive: true, sortOrder: 0 });

  const startEdit = (city: any) => {
    setEditingId(city.id);
    setForm({
      nameEn: city.nameEn || "",
      nameAr: city.nameAr || "",
      region: city.region || "",
      regionAr: city.regionAr || "",
      imageUrl: city.imageUrl || "",
      isActive: city.isActive !== false,
      sortOrder: city.sortOrder || 0,
    });
  };

  const handlePhotoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadPhotoMutation.mutate({ base64, filename: file.name, contentType: file.type });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const cities = citiesQuery.data || [];
  const activeCount = cities.filter((c: any) => c.isActive !== false).length;
  const inactiveCount = cities.filter((c: any) => c.isActive === false).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {lang === "ar" ? "إدارة المدن" : "Cities Management"}
            <Badge variant="secondary">{cities.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">{activeCount} {lang === "ar" ? "نشطة" : "Active"}</Badge>
            <Badge variant="outline" className="text-amber-600 border-amber-300">{inactiveCount} {lang === "ar" ? "قريباً" : "Coming Soon"}</Badge>
            <Button size="sm" onClick={() => { setShowAdd(true); resetForm(); }}>
              <Plus className="h-4 w-4 me-1" />
              {lang === "ar" ? "إضافة مدينة" : "Add City"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar"
            ? "المدن النشطة تظهر في البحث والصفحة الرئيسية. المدن غير النشطة تظهر كـ\"قريباً\"."
            : "Active cities appear in search and homepage. Inactive cities show as \"Coming Soon\"."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add City Form */}
        {showAdd && (
          <div className="border rounded-lg p-4 bg-accent/30 space-y-3">
            <h4 className="font-semibold text-sm">{lang === "ar" ? "إضافة مدينة جديدة" : "Add New City"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="Riyadh" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} placeholder="الرياض" dir="rtl" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (إنجليزي)" : "Region (English)"}</Label>
                <Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} placeholder="Riyadh" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (عربي)" : "Region (Arabic)"}</Label>
                <Input value={form.regionAr} onChange={e => setForm(p => ({ ...p, regionAr: e.target.value }))} placeholder="منطقة الرياض" dir="rtl" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={form.isActive} onCheckedChange={(v) => setForm(p => ({ ...p, isActive: !!v }))} />
                <Label className="text-xs">{lang === "ar" ? "نشطة (تظهر في البحث)" : "Active (visible in search)"}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">{lang === "ar" ? "الترتيب" : "Sort"}</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className="w-20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {form.imageUrl && <img loading="lazy" src={form.imageUrl} alt="" className="h-12 w-16 object-cover rounded" />}
              <Button variant="outline" size="sm" onClick={handlePhotoUpload} disabled={uploadPhotoMutation.isPending}>
                <Upload className="h-3 w-3 me-1" />
                {lang === "ar" ? "رفع صورة" : "Upload Photo"}
              </Button>
              <Input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder={lang === "ar" ? "أو أدخل رابط الصورة" : "Or enter image URL"} className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.nameEn || !form.nameAr}>
                <Save className="h-3 w-3 me-1" />
                {lang === "ar" ? "حفظ" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {/* Cities Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-start p-2.5">#</th>
                <th className="text-start p-2.5">{lang === "ar" ? "الصورة" : "Image"}</th>
                <th className="text-start p-2.5">{lang === "ar" ? "الاسم (EN)" : "Name (EN)"}</th>
                <th className="text-start p-2.5">{lang === "ar" ? "الاسم (AR)" : "Name (AR)"}</th>
                <th className="text-start p-2.5">{lang === "ar" ? "المنطقة" : "Region"}</th>
                <th className="text-center p-2.5">{lang === "ar" ? "الحالة" : "Status"}</th>
                <th className="text-center p-2.5">{lang === "ar" ? "الترتيب" : "Sort"}</th>
                <th className="text-end p-2.5">{lang === "ar" ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {(cities as any[]).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((city: any) => (
                <tr key={city.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="p-2.5 text-muted-foreground">{city.id}</td>
                  <td className="p-2.5">
                    {city.imageUrl ? (
                      <img loading="lazy" src={city.imageUrl} alt="" className="h-8 w-12 object-cover rounded" />
                    ) : (
                      <div className="h-8 w-12 bg-muted rounded flex items-center justify-center">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 font-medium" dir="ltr">{city.nameEn}</td>
                  <td className="p-2.5 font-medium" dir="rtl">{city.nameAr}</td>
                  <td className="p-2.5 text-muted-foreground text-xs">
                    {lang === "ar" ? (city.regionAr || city.region) : city.region}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: city.id, isActive: !city.isActive })}
                      disabled={toggleMutation.isPending}
                      className="inline-flex items-center gap-1"
                      title={city.isActive ? (lang === "ar" ? "تعطيل (قريباً)" : "Deactivate (Coming Soon)") : (lang === "ar" ? "تفعيل" : "Activate")}
                    >
                      {city.isActive !== false ? (
                        <Badge variant="default" className="bg-green-600 cursor-pointer hover:bg-green-700 text-[10px]">
                          {lang === "ar" ? "نشطة" : "Active"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50 text-[10px]">
                          {lang === "ar" ? "قريباً" : "Coming Soon"}
                        </Badge>
                      )}
                    </button>
                  </td>
                  <td className="p-2.5 text-center text-muted-foreground">{city.sortOrder || 0}</td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === city.id ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: city.id, ...form })} disabled={updateMutation.isPending}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(city)}>
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(lang === "ar" ? `حذف ${city.nameAr}؟` : `Delete ${city.nameEn}?`)) {
                                deleteMutation.mutate({ id: city.id });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline Edit Form */}
        {editingId && (
          <div className="border rounded-lg p-4 bg-accent/30 space-y-3">
            <h4 className="font-semibold text-sm">{lang === "ar" ? "تعديل المدينة" : "Edit City"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} dir="rtl" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (إنجليزي)" : "Region (English)"}</Label>
                <Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (عربي)" : "Region (Arabic)"}</Label>
                <Input value={form.regionAr} onChange={e => setForm(p => ({ ...p, regionAr: e.target.value }))} dir="rtl" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={form.isActive} onCheckedChange={(v) => setForm(p => ({ ...p, isActive: !!v }))} />
                <Label className="text-xs">{lang === "ar" ? "نشطة" : "Active"}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">{lang === "ar" ? "الترتيب" : "Sort"}</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className="w-20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {form.imageUrl && <img loading="lazy" src={form.imageUrl} alt="" className="h-12 w-16 object-cover rounded" />}
              <Button variant="outline" size="sm" onClick={handlePhotoUpload} disabled={uploadPhotoMutation.isPending}>
                <Upload className="h-3 w-3 me-1" />
                {lang === "ar" ? "رفع صورة" : "Upload Photo"}
              </Button>
              <Input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder={lang === "ar" ? "رابط الصورة" : "Image URL"} className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateMutation.mutate({ id: editingId, ...form })} disabled={updateMutation.isPending}>
                <Save className="h-3 w-3 me-1" />
                {lang === "ar" ? "حفظ التعديلات" : "Save Changes"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
