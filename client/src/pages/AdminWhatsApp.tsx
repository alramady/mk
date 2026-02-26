import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import SEOHead from "@/components/SEOHead";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  ArrowRight, ArrowLeft, Loader2, MessageCircle, Send, Phone, User,
  CheckCheck, Clock, AlertCircle, Search, Filter, ChevronDown, ChevronUp,
  ExternalLink, Copy, Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// WhatsApp green color
const WA_GREEN = "#25D366";

export default function AdminWhatsApp() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  const isRtl = lang === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  // State
  const [activeTab, setActiveTab] = useState<"send" | "logs" | "templates">("send");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedType, setSelectedType] = useState<string>("custom");
  const [isSending, setIsSending] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [logFilter, setLogFilter] = useState<{ type?: string; status?: string }>({});
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const templates = trpc.whatsapp.templates.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const stats = trpc.whatsapp.stats.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const logs = trpc.whatsapp.list.useQuery(
    { limit: 50, offset: 0, messageType: logFilter.type, status: logFilter.status },
    { enabled: isAuthenticated && user?.role === "admin" && activeTab === "logs" }
  );
  const users = trpc.admin.users.useQuery(
    { limit: 100, search: userSearch },
    { enabled: isAuthenticated && user?.role === "admin" && showUserPicker }
  );
  const sendMutation = trpc.whatsapp.send.useMutation();

  // Loading / Auth
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full"><CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{isRtl ? "غير مصرح" : "Unauthorized"}</h2>
        </CardContent></Card>
      </div>
    );
  }

  const handleSelectUser = (u: any) => {
    setRecipientPhone(u.phone || u.whatsapp || "");
    setRecipientName(u.displayName || u.name || u.nameAr || "");
    setShowUserPicker(false);
  };

  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplate(tpl.id);
    setSelectedType(tpl.type);
    const body = isRtl ? tpl.bodyAr : tpl.bodyEn;
    setMessageBody(body);
  };

  const handleSendClickToChat = () => {
    if (!recipientPhone || !messageBody) {
      toast({ title: isRtl ? "خطأ" : "Error", description: isRtl ? "يرجى إدخال رقم الهاتف والرسالة" : "Please enter phone and message", variant: "destructive" });
      return;
    }
    // Format phone for WhatsApp
    let phone = recipientPhone.replace(/[^0-9]/g, "");
    if (phone.startsWith("05")) phone = "966" + phone.substring(1);
    if (phone.startsWith("5") && phone.length === 9) phone = "966" + phone;
    if (!phone.startsWith("966")) phone = "966" + phone;

    const encoded = encodeURIComponent(messageBody);
    const waUrl = `https://wa.me/${phone}?text=${encoded}`;

    // Log the message
    sendMutation.mutate({
      recipientPhone: phone,
      recipientName: recipientName || undefined,
      messageType: selectedType as any,
      templateName: selectedTemplate || undefined,
      messageBody,
      channel: "click_to_chat",
    }, {
      onSuccess: () => {
        toast({ title: isRtl ? "تم" : "Done", description: isRtl ? "تم فتح واتساب وتسجيل الرسالة" : "WhatsApp opened and message logged" });
        logs.refetch();
        stats.refetch();
      },
    });

    // Open WhatsApp
    window.open(waUrl, "_blank");
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageBody);
    toast({ title: isRtl ? "تم النسخ" : "Copied", description: isRtl ? "تم نسخ الرسالة" : "Message copied to clipboard" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: any; label: string; labelAr: string }> = {
      sent: { color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Send, label: "Sent", labelAr: "مرسلة" },
      delivered: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCheck, label: "Delivered", labelAr: "وصلت" },
      read: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCheck, label: "Read", labelAr: "مقروءة" },
      failed: { color: "bg-red-500/10 text-red-600 border-red-500/20", icon: AlertCircle, label: "Failed", labelAr: "فشلت" },
      pending: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock, label: "Pending", labelAr: "قيد الانتظار" },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return (
      <Badge variant="outline" className={`${s.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {isRtl ? s.labelAr : s.label}
      </Badge>
    );
  };

  const typeBadge = (type: string) => {
    const map: Record<string, { labelAr: string; label: string }> = {
      property_share: { label: "Property Share", labelAr: "مشاركة عقار" },
      booking_reminder: { label: "Booking", labelAr: "حجز" },
      follow_up: { label: "Follow Up", labelAr: "متابعة" },
      custom: { label: "Custom", labelAr: "مخصصة" },
      welcome: { label: "Welcome", labelAr: "ترحيب" },
      payment_reminder: { label: "Payment", labelAr: "دفع" },
    };
    const m = map[type] || { label: type, labelAr: type };
    return <Badge variant="secondary" className="text-xs">{isRtl ? m.labelAr : m.label}</Badge>;
  };

  const statsData = stats.data || { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, last24h: 0, last7d: 0 };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background">
      <SEOHead title="WhatsApp Messages" titleAr="رسائل واتساب" path="/admin/whatsapp" noindex />
      <Navbar />
      <div className="container py-8 flex-1 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 hover:bg-primary/10">
                <BackIcon className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: `${WA_GREEN}20` }}>
                  <MessageCircle className="h-6 w-6" style={{ color: WA_GREEN }} />
                </div>
                <h1 className="text-2xl font-heading font-bold">{isRtl ? "رسائل واتساب" : "WhatsApp Messages"}</h1>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{isRtl ? "إرسال وإدارة رسائل واتساب للمستأجرين والملاك" : "Send and manage WhatsApp messages to tenants and landlords"}</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: isRtl ? "إجمالي الرسائل" : "Total Messages", value: statsData.totalMessages, color: "text-foreground" },
            { label: isRtl ? "آخر 24 ساعة" : "Last 24h", value: statsData.last24h, color: "text-blue-500" },
            { label: isRtl ? "آخر 7 أيام" : "Last 7 Days", value: statsData.last7d, color: "text-green-500" },
            { label: isRtl ? "فشلت" : "Failed", value: statsData.failed, color: "text-red-500" },
          ].map((s, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border/40 pb-3">
          {[
            { id: "send" as const, label: isRtl ? "إرسال رسالة" : "Send Message", icon: Send },
            { id: "logs" as const, label: isRtl ? "سجل الرسائل" : "Message Logs", icon: Clock },
            { id: "templates" as const, label: isRtl ? "القوالب" : "Templates", icon: Copy },
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              className={`gap-2 ${activeTab === tab.id ? "bg-[#25D366] hover:bg-[#20BD5A] text-white" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Send Tab */}
        {activeTab === "send" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5" style={{ color: WA_GREEN }} />
                    {isRtl ? "المستلم" : "Recipient"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-1.5 block">{isRtl ? "رقم الهاتف" : "Phone Number"}</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder={isRtl ? "05XXXXXXXX" : "05XXXXXXXX"}
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          className="text-left"
                          dir="ltr"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setShowUserPicker(!showUserPicker)}
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-1.5 block">{isRtl ? "اسم المستلم" : "Recipient Name"}</label>
                      <Input
                        placeholder={isRtl ? "اسم المستلم (اختياري)" : "Name (optional)"}
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className={isRtl ? "text-right" : "text-left"}
                      />
                    </div>
                  </div>

                  {/* User Picker Dropdown */}
                  {showUserPicker && (
                    <div className="border border-border/60 rounded-lg p-3 bg-muted/30 max-h-48 overflow-y-auto">
                      <Input
                        placeholder={isRtl ? "ابحث عن مستخدم..." : "Search users..."}
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="mb-2 text-sm"
                      />
                      {users.isLoading ? (
                        <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                      ) : (
                        <div className="space-y-1">
                          {(users.data || []).filter((u: any) => u.phone || u.whatsapp).map((u: any) => (
                            <button
                              key={u.id}
                              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition text-sm text-start"
                              onClick={() => handleSelectUser(u)}
                            >
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                                {(u.displayName || u.name || "?")[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{u.displayName || u.name || u.nameAr}</p>
                                <p className="text-xs text-muted-foreground" dir="ltr">{u.phone || u.whatsapp}</p>
                              </div>
                              <Badge variant="secondary" className="text-xs">{u.role}</Badge>
                            </button>
                          ))}
                          {(users.data || []).filter((u: any) => u.phone || u.whatsapp).length === 0 && (
                            <p className="text-center text-xs text-muted-foreground py-2">{isRtl ? "لا يوجد مستخدمين بأرقام هاتف" : "No users with phone numbers"}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageCircle className="h-5 w-5" style={{ color: WA_GREEN }} />
                    {isRtl ? "الرسالة" : "Message"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template Selector */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{isRtl ? "اختر قالب" : "Choose Template"}</label>
                    <div className="flex flex-wrap gap-2">
                      {(templates.data || []).map((tpl: any) => (
                        <Button
                          key={tpl.id}
                          variant={selectedTemplate === tpl.id ? "default" : "outline"}
                          size="sm"
                          className={`text-xs ${selectedTemplate === tpl.id ? "bg-[#25D366] hover:bg-[#20BD5A] text-white" : ""}`}
                          onClick={() => handleSelectTemplate(tpl)}
                        >
                          {isRtl ? tpl.nameAr : tpl.nameEn}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Message Body */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{isRtl ? "نص الرسالة" : "Message Body"}</label>
                    <Textarea
                      placeholder={isRtl ? "اكتب رسالتك هنا..." : "Type your message here..."}
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      rows={6}
                      className={`resize-none ${isRtl ? "text-right" : "text-left"}`}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {isRtl
                        ? `المتغيرات المتاحة: {name}, {property}, {rent}, {date}, {link}, {location}`
                        : `Available variables: {name}, {property}, {rent}, {date}, {link}, {location}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1 gap-2 text-white font-semibold"
                      style={{ background: WA_GREEN }}
                      onClick={handleSendClickToChat}
                      disabled={!recipientPhone || !messageBody}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {isRtl ? "فتح واتساب وإرسال" : "Open WhatsApp & Send"}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleCopyMessage} disabled={!messageBody}>
                      <Copy className="h-4 w-4" />
                      {isRtl ? "نسخ" : "Copy"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div className="lg:col-span-2">
              <Card className="border-border/40 sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg">{isRtl ? "معاينة الرسالة" : "Message Preview"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl overflow-hidden" style={{ background: "#ECE5DD" }}>
                    {/* WhatsApp Header */}
                    <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#075E54" }}>
                      <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{recipientName || (isRtl ? "المستلم" : "Recipient")}</p>
                        <p className="text-white/70 text-xs" dir="ltr">{recipientPhone || "05XXXXXXXX"}</p>
                      </div>
                    </div>
                    {/* Message Bubble */}
                    <div className="p-4 min-h-[200px]">
                      {messageBody ? (
                        <div className={`max-w-[85%] ${isRtl ? "mr-auto" : "ml-auto"}`}>
                          <div className="bg-[#DCF8C6] rounded-lg px-3 py-2 shadow-sm">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap" style={{ direction: isRtl ? "rtl" : "ltr" }}>
                              {messageBody}
                            </p>
                            <p className="text-[10px] text-gray-500 text-end mt-1 flex items-center justify-end gap-1">
                              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[160px]">
                          <p className="text-gray-500 text-sm">{isRtl ? "اكتب رسالة للمعاينة" : "Type a message to preview"}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4" />
                {isRtl ? "فلترة" : "Filter"}
                {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              {logFilter.type && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setLogFilter(f => ({ ...f, type: undefined }))}>
                  {logFilter.type} ×
                </Badge>
              )}
              {logFilter.status && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setLogFilter(f => ({ ...f, status: undefined }))}>
                  {logFilter.status} ×
                </Badge>
              )}
            </div>
            {showFilters && (
              <Card className="border-border/40">
                <CardContent className="p-4 flex flex-wrap gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">{isRtl ? "النوع" : "Type"}</label>
                    <div className="flex flex-wrap gap-1">
                      {["property_share", "booking_reminder", "follow_up", "custom", "welcome", "payment_reminder"].map(t => (
                        <Button key={t} variant={logFilter.type === t ? "default" : "outline"} size="sm" className="text-xs"
                          onClick={() => setLogFilter(f => ({ ...f, type: f.type === t ? undefined : t }))}>{t}</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">{isRtl ? "الحالة" : "Status"}</label>
                    <div className="flex flex-wrap gap-1">
                      {["sent", "delivered", "read", "failed", "pending"].map(s => (
                        <Button key={s} variant={logFilter.status === s ? "default" : "outline"} size="sm" className="text-xs"
                          onClick={() => setLogFilter(f => ({ ...f, status: f.status === s ? undefined : s }))}>{s}</Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Messages Table */}
            <Card className="border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="p-3 text-start font-medium">{isRtl ? "المستلم" : "Recipient"}</th>
                      <th className="p-3 text-start font-medium">{isRtl ? "النوع" : "Type"}</th>
                      <th className="p-3 text-start font-medium">{isRtl ? "الرسالة" : "Message"}</th>
                      <th className="p-3 text-start font-medium">{isRtl ? "القناة" : "Channel"}</th>
                      <th className="p-3 text-start font-medium">{isRtl ? "الحالة" : "Status"}</th>
                      <th className="p-3 text-start font-medium">{isRtl ? "التاريخ" : "Date"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.isLoading ? (
                      <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                    ) : (logs.data?.messages || []).length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>{isRtl ? "لا توجد رسائل بعد" : "No messages yet"}</p>
                      </td></tr>
                    ) : (
                      (logs.data?.messages || []).map((msg: any) => (
                        <tr key={msg.id} className="border-b border-border/20 hover:bg-muted/20 transition">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${WA_GREEN}20`, color: WA_GREEN }}>
                                {(msg.recipientName || "?")[0]}
                              </div>
                              <div>
                                <p className="font-medium text-xs">{msg.recipientName || "-"}</p>
                                <p className="text-xs text-muted-foreground" dir="ltr">{msg.recipientPhone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">{typeBadge(msg.messageType)}</td>
                          <td className="p-3">
                            <p className="text-xs truncate max-w-[200px]">{msg.messageBody}</p>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {msg.channel === "click_to_chat" ? "Click-to-Chat" : "Cloud API"}
                            </Badge>
                          </td>
                          <td className="p-3">{statusBadge(msg.status)}</td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString(isRtl ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {logs.data && logs.data.total > 0 && (
                <div className="p-3 border-t border-border/40 text-xs text-muted-foreground text-center">
                  {isRtl ? `عرض ${Math.min(50, logs.data.total)} من ${logs.data.total} رسالة` : `Showing ${Math.min(50, logs.data.total)} of ${logs.data.total} messages`}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(templates.data || []).map((tpl: any) => (
              <Card key={tpl.id} className="border-border/40 hover:border-[#25D366]/40 transition cursor-pointer group"
                onClick={() => { handleSelectTemplate(tpl); setActiveTab("send"); }}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{isRtl ? tpl.nameAr : tpl.nameEn}</h3>
                    <Badge variant="secondary" className="text-xs">{isRtl ? tpl.nameAr.split(" ")[0] : tpl.type}</Badge>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed" style={{ direction: isRtl ? "rtl" : "ltr" }}>
                    {(isRtl ? tpl.bodyAr : tpl.bodyEn) || (isRtl ? "رسالة مخصصة — اكتب رسالتك" : "Custom message — write your own")}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" className="text-xs gap-1 opacity-0 group-hover:opacity-100 transition" style={{ color: WA_GREEN }}>
                      <Send className="h-3 w-3" />
                      {isRtl ? "استخدم القالب" : "Use Template"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
