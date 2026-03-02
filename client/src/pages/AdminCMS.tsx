import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Newspaper, Save, Upload, History, Eye, EyeOff, Search,
  ArrowLeft, ArrowRight, RotateCcw, Send, Image as ImageIcon,
  Trash2, Copy, Check, ChevronDown, ChevronUp, FileText,
  Globe, Pencil, Clock, User, FolderOpen, X, Plus,
} from "lucide-react";
import { Link } from "wouter";

// ─── Content Key Registry ───────────────────────────────────────────
// All CMS-managed content keys grouped by section
const CMS_SECTIONS = [
  {
    id: "hero",
    labelAr: "القسم الرئيسي (Hero)",
    labelEn: "Hero Section",
    keys: [
      { key: "hero.titleAr", labelAr: "العنوان (عربي)", labelEn: "Title (Arabic)", type: "text" },
      { key: "hero.titleEn", labelAr: "العنوان (إنجليزي)", labelEn: "Title (English)", type: "text" },
      { key: "hero.subtitleAr", labelAr: "العنوان الفرعي (عربي)", labelEn: "Subtitle (Arabic)", type: "textarea" },
      { key: "hero.subtitleEn", labelAr: "العنوان الفرعي (إنجليزي)", labelEn: "Subtitle (English)", type: "textarea" },
      { key: "hero.bgImage", labelAr: "صورة الخلفية", labelEn: "Background Image", type: "image" },
      { key: "hero.bgVideo", labelAr: "فيديو الخلفية", labelEn: "Background Video", type: "text" },
      { key: "hero.bgType", labelAr: "نوع الخلفية", labelEn: "Background Type", type: "select", options: ["image", "video"] },
      { key: "hero.overlayOpacity", labelAr: "شفافية التغطية", labelEn: "Overlay Opacity", type: "text" },
    ],
  },
  {
    id: "stats",
    labelAr: "الإحصائيات",
    labelEn: "Statistics",
    keys: [
      { key: "stats.properties", labelAr: "عدد العقارات", labelEn: "Properties Count", type: "text" },
      { key: "stats.propertiesLabelAr", labelAr: "تسمية العقارات (عربي)", labelEn: "Properties Label (Arabic)", type: "text" },
      { key: "stats.propertiesLabelEn", labelAr: "تسمية العقارات (إنجليزي)", labelEn: "Properties Label (English)", type: "text" },
      { key: "stats.tenants", labelAr: "عدد المستأجرين", labelEn: "Tenants Count", type: "text" },
      { key: "stats.tenantsLabelAr", labelAr: "تسمية المستأجرين (عربي)", labelEn: "Tenants Label (Arabic)", type: "text" },
      { key: "stats.tenantsLabelEn", labelAr: "تسمية المستأجرين (إنجليزي)", labelEn: "Tenants Label (English)", type: "text" },
      { key: "stats.cities", labelAr: "عدد المدن", labelEn: "Cities Count", type: "text" },
      { key: "stats.citiesLabelAr", labelAr: "تسمية المدن (عربي)", labelEn: "Cities Label (Arabic)", type: "text" },
      { key: "stats.citiesLabelEn", labelAr: "تسمية المدن (إنجليزي)", labelEn: "Cities Label (English)", type: "text" },
      { key: "stats.satisfaction", labelAr: "نسبة الرضا", labelEn: "Satisfaction Rate", type: "text" },
      { key: "stats.satisfactionLabelAr", labelAr: "تسمية الرضا (عربي)", labelEn: "Satisfaction Label (Arabic)", type: "text" },
      { key: "stats.satisfactionLabelEn", labelAr: "تسمية الرضا (إنجليزي)", labelEn: "Satisfaction Label (English)", type: "text" },
    ],
  },
  {
    id: "services",
    labelAr: "الخدمات",
    labelEn: "Services",
    keys: [
      { key: "services.titleAr", labelAr: "عنوان القسم (عربي)", labelEn: "Section Title (Arabic)", type: "text" },
      { key: "services.titleEn", labelAr: "عنوان القسم (إنجليزي)", labelEn: "Section Title (English)", type: "text" },
      { key: "services.subtitleAr", labelAr: "العنوان الفرعي (عربي)", labelEn: "Section Subtitle (Arabic)", type: "text" },
      { key: "services.subtitleEn", labelAr: "العنوان الفرعي (إنجليزي)", labelEn: "Section Subtitle (English)", type: "text" },
      { key: "homepage.services", labelAr: "قائمة الخدمات (JSON)", labelEn: "Services List (JSON)", type: "json" },
    ],
  },
  {
    id: "steps",
    labelAr: "خطوات الاستخدام",
    labelEn: "How It Works",
    keys: [
      { key: "steps.titleAr", labelAr: "عنوان القسم (عربي)", labelEn: "Section Title (Arabic)", type: "text" },
      { key: "steps.titleEn", labelAr: "عنوان القسم (إنجليزي)", labelEn: "Section Title (English)", type: "text" },
      { key: "steps.subtitleAr", labelAr: "العنوان الفرعي (عربي)", labelEn: "Section Subtitle (Arabic)", type: "text" },
      { key: "steps.subtitleEn", labelAr: "العنوان الفرعي (إنجليزي)", labelEn: "Section Subtitle (English)", type: "text" },
      { key: "homepage.steps", labelAr: "خطوات الاستخدام (JSON)", labelEn: "Steps List (JSON)", type: "json" },
    ],
  },
  {
    id: "featured",
    labelAr: "عقارات مميزة",
    labelEn: "Featured Properties",
    keys: [
      { key: "featured.titleAr", labelAr: "عنوان القسم (عربي)", labelEn: "Section Title (Arabic)", type: "text" },
      { key: "featured.titleEn", labelAr: "عنوان القسم (إنجليزي)", labelEn: "Section Title (English)", type: "text" },
      { key: "featured.subtitleAr", labelAr: "العنوان الفرعي (عربي)", labelEn: "Section Subtitle (Arabic)", type: "text" },
      { key: "featured.subtitleEn", labelAr: "العنوان الفرعي (إنجليزي)", labelEn: "Section Subtitle (English)", type: "text" },
    ],
  },
  {
    id: "testimonials",
    labelAr: "آراء العملاء",
    labelEn: "Testimonials",
    keys: [
      { key: "testimonials.titleAr", labelAr: "عنوان القسم (عربي)", labelEn: "Section Title (Arabic)", type: "text" },
      { key: "testimonials.titleEn", labelAr: "عنوان القسم (إنجليزي)", labelEn: "Section Title (English)", type: "text" },
      { key: "testimonials.subtitleAr", labelAr: "العنوان الفرعي (عربي)", labelEn: "Section Subtitle (Arabic)", type: "text" },
      { key: "testimonials.subtitleEn", labelAr: "العنوان الفرعي (إنجليزي)", labelEn: "Section Subtitle (English)", type: "text" },
      { key: "homepage.testimonials", labelAr: "آراء العملاء (JSON)", labelEn: "Testimonials (JSON)", type: "json" },
    ],
  },
  {
    id: "footer",
    labelAr: "التذييل",
    labelEn: "Footer",
    keys: [
      { key: "footer.aboutAr", labelAr: "نبذة (عربي)", labelEn: "About (Arabic)", type: "textarea" },
      { key: "footer.aboutEn", labelAr: "نبذة (إنجليزي)", labelEn: "About (English)", type: "textarea" },
      { key: "footer.email", labelAr: "البريد الإلكتروني", labelEn: "Email", type: "text" },
      { key: "footer.phone", labelAr: "الهاتف", labelEn: "Phone", type: "text" },
      { key: "footer.addressAr", labelAr: "العنوان (عربي)", labelEn: "Address (Arabic)", type: "text" },
      { key: "footer.addressEn", labelAr: "العنوان (إنجليزي)", labelEn: "Address (English)", type: "text" },
      { key: "footer.twitter", labelAr: "تويتر", labelEn: "Twitter/X", type: "text" },
      { key: "footer.instagram", labelAr: "إنستقرام", labelEn: "Instagram", type: "text" },
      { key: "footer.linkedin", labelAr: "لينكد إن", labelEn: "LinkedIn", type: "text" },
    ],
  },
  {
    id: "general",
    labelAr: "عام",
    labelEn: "General",
    keys: [
      { key: "site.nameAr", labelAr: "اسم الموقع (عربي)", labelEn: "Site Name (Arabic)", type: "text" },
      { key: "site.nameEn", labelAr: "اسم الموقع (إنجليزي)", labelEn: "Site Name (English)", type: "text" },
      { key: "site.descriptionAr", labelAr: "وصف الموقع (عربي)", labelEn: "Site Description (Arabic)", type: "textarea" },
      { key: "site.descriptionEn", labelAr: "وصف الموقع (إنجليزي)", labelEn: "Site Description (English)", type: "textarea" },
      { key: "site.logoUrl", labelAr: "الشعار", labelEn: "Logo", type: "image" },
      { key: "site.faviconUrl", labelAr: "أيقونة الموقع", labelEn: "Favicon", type: "image" },
      { key: "site.primaryColor", labelAr: "اللون الأساسي", labelEn: "Primary Color", type: "color" },
      { key: "site.accentColor", labelAr: "اللون الثانوي", labelEn: "Accent Color", type: "color" },
    ],
  },
  {
    id: "legal",
    labelAr: "قانوني",
    labelEn: "Legal",
    keys: [
      { key: "terms.contentAr", labelAr: "الشروط والأحكام (عربي)", labelEn: "Terms & Conditions (Arabic)", type: "richtext" },
      { key: "terms.contentEn", labelAr: "الشروط والأحكام (إنجليزي)", labelEn: "Terms & Conditions (English)", type: "richtext" },
      { key: "privacy.contentAr", labelAr: "سياسة الخصوصية (عربي)", labelEn: "Privacy Policy (Arabic)", type: "richtext" },
      { key: "privacy.contentEn", labelAr: "سياسة الخصوصية (إنجليزي)", labelEn: "Privacy Policy (English)", type: "richtext" },
    ],
  },
];

export default function AdminCMS() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const isRtl = dir === "rtl";

  // Queries
  const inventoryQuery = trpc.cms.inventory.useQuery();
  const pendingDraftsQuery = trpc.cms.pendingDrafts.useQuery();
  const mediaQuery = trpc.cms.mediaList.useQuery({ page: 1, limit: 50 });

  // Mutations
  const saveDraftMutation = trpc.cms.saveDraft.useMutation({
    onSuccess: () => { toast.success(isRtl ? "تم حفظ المسودة" : "Draft saved"); inventoryQuery.refetch(); pendingDraftsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const publishMutation = trpc.cms.publish.useMutation({
    onSuccess: (d) => { toast.success(isRtl ? `تم النشر (v${d.publishedVersion})` : `Published (v${d.publishedVersion})`); inventoryQuery.refetch(); pendingDraftsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkPublishMutation = trpc.cms.bulkPublish.useMutation({
    onSuccess: (d) => { toast.success(isRtl ? `تم نشر ${d.published} تغيير` : `Published ${d.published} changes`); inventoryQuery.refetch(); pendingDraftsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const imageUploadMutation = trpc.siteSettings.uploadAsset.useMutation({
    onSuccess: (data) => {
      setEditValue(data.url);
      toast.success(isRtl ? "تم رفع الصورة" : "Image uploaded");
      inventoryQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleImageUpload = (purpose: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error(isRtl ? "الحد الأقصى 5MB" : "Max 5MB"); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        imageUploadMutation.mutate({ base64, filename: file.name, contentType: file.type, purpose });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const mediaUploadMutation = trpc.cms.mediaUpload.useMutation({
    onSuccess: () => { toast.success(isRtl ? "تم رفع الملف" : "File uploaded"); mediaQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const mediaDeleteMutation = trpc.cms.mediaDelete.useMutation({
    onSuccess: () => { toast.success(isRtl ? "تم الحذف" : "Deleted"); mediaQuery.refetch(); },
  });

  // Local state
  const [activeTab, setActiveTab] = useState("content");
  const [activeSection, setActiveSection] = useState("hero");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editNote, setEditNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  // Version history query (only when historyKey is set)
  const historyQuery = trpc.cms.history.useQuery(
    { key: historyKey ?? "" },
    { enabled: !!historyKey }
  );

  const rollbackMutation = trpc.cms.rollback.useMutation({
    onSuccess: () => { toast.success(isRtl ? "تم الاستعادة" : "Rolled back"); inventoryQuery.refetch(); historyQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const liveSettings = inventoryQuery.data?.keys ?? {};
  const drafts = inventoryQuery.data?.drafts ?? {};
  const pendingDrafts = pendingDraftsQuery.data ?? [];

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return CMS_SECTIONS;
    const q = searchQuery.toLowerCase();
    return CMS_SECTIONS.map(section => ({
      ...section,
      keys: section.keys.filter(k =>
        k.key.toLowerCase().includes(q) ||
        k.labelAr.toLowerCase().includes(q) ||
        k.labelEn.toLowerCase().includes(q) ||
        (liveSettings[k.key] ?? "").toLowerCase().includes(q)
      ),
    })).filter(s => s.keys.length > 0);
  }, [searchQuery, liveSettings]);

  const startEditing = (key: string) => {
    const draftVal = drafts[key]?.value;
    setEditingKey(key);
    setEditValue(draftVal ?? liveSettings[key] ?? "");
    setEditNote("");
  };

  const handleSaveDraft = () => {
    if (!editingKey) return;
    saveDraftMutation.mutate({ key: editingKey, value: editValue, note: editNote || undefined });
    setEditingKey(null);
  };

  const handlePublishKey = (key: string) => {
    publishMutation.mutate({ key });
  };

  const handlePublishAll = () => {
    const draftKeys = pendingDrafts.map((d: any) => d.settingKey);
    if (draftKeys.length === 0) { toast.info(isRtl ? "لا توجد مسودات" : "No drafts to publish"); return; }
    bulkPublishMutation.mutate({ keys: draftKeys });
  };

  const handleMediaUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error(isRtl ? "الحد الأقصى 5MB" : "Max 5MB"); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        mediaUploadMutation.mutate({
          base64,
          filename: file.name,
          contentType: file.type,
          folder: "general",
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isRtl ? "تم النسخ" : "Copied");
  };

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
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Newspaper className="h-6 w-6 text-[#3ECFC0]" />
                    {isRtl ? "إدارة المحتوى (CMS)" : "Content Management System"}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isRtl
                      ? "تحرير ومراجعة ونشر جميع محتويات الموقع — مع تاريخ التعديلات والمسودات"
                      : "Edit, review, and publish all site content — with version history and drafts"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingDrafts.length > 0 && (
                  <Button
                    onClick={handlePublishAll}
                    className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]"
                    disabled={bulkPublishMutation.isPending}
                  >
                    <Send className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                    {isRtl ? `نشر الكل (${pendingDrafts.length})` : `Publish All (${pendingDrafts.length})`}
                  </Button>
                )}
                <Badge variant="outline" className="text-xs">
                  {Object.keys(liveSettings).length} {isRtl ? "حقل" : "fields"}
                </Badge>
                {pendingDrafts.length > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                    {pendingDrafts.length} {isRtl ? "مسودة" : "drafts"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="content" className="gap-2">
                <Pencil className="h-4 w-4" />
                {isRtl ? "المحتوى" : "Content"}
              </TabsTrigger>
              <TabsTrigger value="drafts" className="gap-2">
                <Clock className="h-4 w-4" />
                {isRtl ? "المسودات" : "Drafts"}
                {pendingDrafts.length > 0 && (
                  <Badge className="ms-1 bg-amber-500/20 text-amber-600 text-[10px] px-1.5">{pendingDrafts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                {isRtl ? "مكتبة الوسائط" : "Media Library"}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                {isRtl ? "السجل" : "History"}
              </TabsTrigger>
            </TabsList>

            {/* ─── Content Tab ─── */}
            <TabsContent value="content">
              <div className="flex gap-4">
                {/* Section sidebar */}
                <div className="w-56 shrink-0 space-y-1">
                  <div className="relative mb-3">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={isRtl ? "بحث..." : "Search..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="ps-9 h-9"
                    />
                  </div>
                  {(searchQuery ? filteredSections : CMS_SECTIONS).map(section => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === section.id
                          ? "bg-[#3ECFC0]/10 text-[#3ECFC0] font-medium"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {isRtl ? section.labelAr : section.labelEn}
                      {section.keys.some(k => drafts[k.key]) && (
                        <Badge className="ms-2 bg-amber-500/20 text-amber-600 text-[9px] px-1">
                          {isRtl ? "مسودة" : "draft"}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>

                {/* Content area */}
                <div className="flex-1 min-w-0">
                  {(searchQuery ? filteredSections : CMS_SECTIONS)
                    .filter(s => s.id === activeSection)
                    .map(section => (
                      <Card key={section.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">
                            {isRtl ? section.labelAr : section.labelEn}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {section.keys.map(keyDef => {
                            const isEditing = editingKey === keyDef.key;
                            const hasDraft = !!drafts[keyDef.key];
                            const liveValue = liveSettings[keyDef.key] ?? "";
                            const draftValue = drafts[keyDef.key]?.value ?? "";

                            return (
                              <div key={keyDef.key} className={`border rounded-lg p-4 ${hasDraft ? "border-amber-500/50 bg-amber-50/5" : ""}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium">
                                      {isRtl ? keyDef.labelAr : keyDef.labelEn}
                                    </Label>
                                    <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {keyDef.key}
                                    </code>
                                    {hasDraft && (
                                      <Badge className="bg-amber-500/20 text-amber-600 text-[9px]">
                                        {isRtl ? "مسودة" : "draft"}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => { setHistoryKey(keyDef.key); setActiveTab("history"); }}
                                      className="h-7 text-xs"
                                    >
                                      <History className="h-3 w-3 me-1" />
                                      {isRtl ? "السجل" : "History"}
                                    </Button>
                                    {hasDraft && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePublishKey(keyDef.key)}
                                        className="h-7 text-xs text-green-600 border-green-500/30"
                                        disabled={publishMutation.isPending}
                                      >
                                        <Send className="h-3 w-3 me-1" />
                                        {isRtl ? "نشر" : "Publish"}
                                      </Button>
                                    )}
                                    {!isEditing && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => startEditing(keyDef.key)}
                                        className="h-7 text-xs"
                                      >
                                        <Pencil className="h-3 w-3 me-1" />
                                        {isRtl ? "تحرير" : "Edit"}
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {isEditing ? (
                                  <div className="space-y-3">
                                    {keyDef.type === "textarea" || keyDef.type === "richtext" || keyDef.type === "json" ? (
                                      <Textarea
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="min-h-[120px] font-mono text-sm"
                                        dir={keyDef.key.endsWith("Ar") ? "rtl" : "ltr"}
                                      />
                                    ) : keyDef.type === "color" ? (
                                      <div className="flex gap-3 items-center">
                                        <input
                                          type="color"
                                          value={editValue || "#3ECFC0"}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          className="w-12 h-10 rounded border cursor-pointer"
                                        />
                                        <Input
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          className="flex-1"
                                        />
                                      </div>
                                    ) : keyDef.type === "image" ? (
                                      <div className="space-y-2">
                                        <div className="flex gap-2">
                                          <Input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            placeholder="https://..."
                                            className="flex-1"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0 gap-1.5"
                                            disabled={imageUploadMutation.isPending}
                                            onClick={() => handleImageUpload(keyDef.key)}
                                          >
                                            <Upload className="h-4 w-4" />
                                            {imageUploadMutation.isPending ? (isRtl ? "جاري الرفع..." : "Uploading...") : (isRtl ? "رفع صورة" : "Upload")}
                                          </Button>
                                        </div>
                                        {editValue && (
                                          <img src={editValue.startsWith('/') ? `https://monthlykey.com${editValue}` : editValue} alt="" className="max-h-32 rounded border object-cover" />
                                        )}
                                      </div>
                                    ) : keyDef.type === "select" ? (
                                      <select
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 bg-background"
                                      >
                                        {keyDef.options?.map(opt => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <Input
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        dir={keyDef.key.endsWith("Ar") ? "rtl" : "ltr"}
                                      />
                                    )}
                                    <div className="flex items-center gap-2">
                                      <Input
                                        placeholder={isRtl ? "ملاحظة التعديل (اختياري)" : "Change note (optional)"}
                                        value={editNote}
                                        onChange={(e) => setEditNote(e.target.value)}
                                        className="flex-1 h-8 text-xs"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={handleSaveDraft}
                                        disabled={saveDraftMutation.isPending}
                                        className="h-8 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]"
                                      >
                                        <Save className="h-3 w-3 me-1" />
                                        {isRtl ? "حفظ مسودة" : "Save Draft"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingKey(null)}
                                        className="h-8"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {keyDef.type === "image" && liveValue ? (
                                      <div className="flex items-center gap-3">
                                        <img src={liveValue.startsWith('/') ? `https://monthlykey.com${liveValue}` : liveValue} alt="" className="max-h-24 rounded border object-cover" />
                                        <code className="text-[10px] text-muted-foreground break-all max-w-xs">{liveValue.length > 60 ? liveValue.substring(0, 60) + '...' : liveValue}</code>
                                      </div>
                                    ) : keyDef.type === "color" && liveValue ? (
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded border" style={{ backgroundColor: liveValue }} />
                                        <code className="text-xs">{liveValue}</code>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground truncate max-w-xl" dir={keyDef.key.endsWith("Ar") ? "rtl" : "ltr"}>
                                        {liveValue || <span className="italic opacity-50">{isRtl ? "(فارغ)" : "(empty)"}</span>}
                                      </p>
                                    )}
                                    {hasDraft && draftValue !== liveValue && (
                                      <div className="mt-1 p-2 bg-amber-50/10 border border-amber-500/20 rounded text-xs">
                                        <span className="text-amber-600 font-medium">{isRtl ? "مسودة:" : "Draft:"}</span>{" "}
                                        <span className="text-muted-foreground">{draftValue.substring(0, 100)}{draftValue.length > 100 ? "..." : ""}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            </TabsContent>

            {/* ─── Drafts Tab ─── */}
            <TabsContent value="drafts">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    {isRtl ? "المسودات المعلقة" : "Pending Drafts"}
                  </CardTitle>
                  {pendingDrafts.length > 0 && (
                    <Button
                      onClick={handlePublishAll}
                      className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]"
                      disabled={bulkPublishMutation.isPending}
                    >
                      <Send className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                      {isRtl ? "نشر الكل" : "Publish All"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {pendingDrafts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Check className="h-12 w-12 mx-auto mb-3 text-green-500/50" />
                      <p>{isRtl ? "لا توجد مسودات معلقة — كل شيء منشور" : "No pending drafts — everything is published"}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingDrafts.map((draft: any) => (
                        <div key={draft.id} className="border rounded-lg p-4 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{draft.settingKey}</code>
                              <Badge className="text-[9px]">v{draft.version}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {draft.value?.substring(0, 80)}{(draft.value?.length ?? 0) > 80 ? "..." : ""}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><User className="h-3 w-3" />{draft.changedByName}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(draft.createdAt).toLocaleString(isRtl ? "ar-SA" : "en-US")}</span>
                              {draft.changeNote && <span className="italic">"{draft.changeNote}"</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ms-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePublishKey(draft.settingKey)}
                              className="text-green-600 border-green-500/30"
                              disabled={publishMutation.isPending}
                            >
                              <Send className="h-3 w-3 me-1" />
                              {isRtl ? "نشر" : "Publish"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Media Library Tab ─── */}
            <TabsContent value="media">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-[#3ECFC0]" />
                    {isRtl ? "مكتبة الوسائط" : "Media Library"}
                  </CardTitle>
                  <Button onClick={handleMediaUpload} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
                    <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                    {isRtl ? "رفع ملف" : "Upload"}
                  </Button>
                </CardHeader>
                <CardContent>
                  {(mediaQuery.data?.items ?? []).length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{isRtl ? "لا توجد ملفات — ارفع أول ملف" : "No files yet — upload your first file"}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {(mediaQuery.data?.items ?? []).map((item: any) => (
                        <div key={item.id} className="group relative border rounded-lg overflow-hidden">
                          {item.contentType?.startsWith("image/") ? (
                            <img src={item.url} alt={item.alt || item.filename} className="w-full h-32 object-cover" />
                          ) : (
                            <div className="w-full h-32 bg-muted flex items-center justify-center">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-xs truncate">{item.filename}</p>
                            <p className="text-[10px] text-muted-foreground">{item.size ? `${(item.size / 1024).toFixed(0)}KB` : ""}</p>
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(item.url)}
                              className="text-white hover:text-white hover:bg-white/20"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => mediaDeleteMutation.mutate({ id: item.id })}
                              className="text-red-400 hover:text-red-300 hover:bg-white/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── History Tab ─── */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-[#3ECFC0]" />
                    {isRtl ? "تاريخ التعديلات" : "Version History"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Label className="text-sm mb-2 block">{isRtl ? "اختر مفتاح المحتوى" : "Select content key"}</Label>
                    <select
                      value={historyKey ?? ""}
                      onChange={(e) => setHistoryKey(e.target.value || null)}
                      className="w-full max-w-md border rounded-lg px-3 py-2 bg-background text-sm"
                    >
                      <option value="">{isRtl ? "— اختر —" : "— Select —"}</option>
                      {CMS_SECTIONS.flatMap(s => s.keys).map(k => (
                        <option key={k.key} value={k.key}>{k.key} — {isRtl ? k.labelAr : k.labelEn}</option>
                      ))}
                    </select>
                  </div>

                  {historyKey && historyQuery.isLoading && (
                    <div className="text-center py-8 text-muted-foreground">{isRtl ? "جاري التحميل..." : "Loading..."}</div>
                  )}

                  {historyKey && !historyQuery.isLoading && (historyQuery.data ?? []).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>{isRtl ? "لا يوجد تاريخ لهذا المفتاح" : "No history for this key"}</p>
                    </div>
                  )}

                  {historyKey && (historyQuery.data ?? []).length > 0 && (
                    <div className="space-y-3">
                      {(historyQuery.data ?? []).map((v: any) => (
                        <div key={v.id} className={`border rounded-lg p-4 ${
                          v.status === "published" ? "border-green-500/30 bg-green-50/5" :
                          v.status === "draft" ? "border-amber-500/30 bg-amber-50/5" :
                          "border-muted"
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={
                                v.status === "published" ? "bg-green-500/20 text-green-600" :
                                v.status === "draft" ? "bg-amber-500/20 text-amber-600" :
                                "bg-muted text-muted-foreground"
                              }>
                                v{v.version} — {v.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />{v.changedByName}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />{new Date(v.createdAt).toLocaleString(isRtl ? "ar-SA" : "en-US")}
                              </span>
                            </div>
                            {v.status === "archived" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => rollbackMutation.mutate({ versionId: v.id })}
                                className="h-7 text-xs"
                                disabled={rollbackMutation.isPending}
                              >
                                <RotateCcw className="h-3 w-3 me-1" />
                                {isRtl ? "استعادة" : "Rollback"}
                              </Button>
                            )}
                          </div>
                          {v.changeNote && (
                            <p className="text-xs text-muted-foreground italic mb-1">"{v.changeNote}"</p>
                          )}
                          <p className="text-sm text-muted-foreground truncate">
                            {v.value?.substring(0, 150)}{(v.value?.length ?? 0) > 150 ? "..." : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
