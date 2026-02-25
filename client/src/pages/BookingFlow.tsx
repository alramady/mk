import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Calendar as CalendarIcon, FileText, CheckCircle, ArrowLeft, ArrowRight,
  Loader2, MapPin, BedDouble, Bath, Maximize2, Clock
} from "lucide-react";
import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

export default function BookingFlow() {
  const { t, lang, dir } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [, params] = useRoute("/book/:id");
  const [, setLocation] = useLocation();
  const propertyId = Number(params?.id);

  const property = trpc.property.getById.useQuery({ id: propertyId }, { enabled: !!propertyId });
  const { get: setting } = useSiteSettings();

  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [durationMonths, setDurationMonths] = useState(1);
  const [tenantNotes, setTenantNotes] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  const createBooking = trpc.booking.create.useMutation({
    onSuccess: () => {
      setStep(3);
      toast.success(lang === "ar" ? "تم إرسال طلب الحجز بنجاح! سيتم مراجعته من الإدارة" : "Booking request submitted! It will be reviewed by admin");
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const prop = property.data;
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  // Calculate costs
  const serviceFeePercent = parseFloat(setting("fees.serviceFeePercent", "5")) || 5;
  const vatPercent = parseFloat(setting("fees.vatPercent", "15")) || 15;
  const depositPercent = parseFloat(setting("fees.depositPercent", "10")) || 10;
  const monthlyRent = prop ? Number(prop.monthlyRent) : 0;
  const totalRent = monthlyRent * durationMonths;
  const securityDeposit = Math.round(totalRent * (depositPercent / 100));
  const serviceFee = Math.round(monthlyRent * (serviceFeePercent / 100));
  const vatAmount = Math.round(serviceFee * (vatPercent / 100));
  const totalAmount = totalRent + securityDeposit + serviceFee + vatAmount;

  const moveInDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const moveOutDate = useMemo(() => {
    if (!selectedDate) return "";
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + durationMonths);
    return format(d, "yyyy-MM-dd");
  }, [selectedDate, durationMonths]);

  if (property.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
      <SEOHead title="Book Property" titleAr="حجز عقار" path="/book" noindex={true} />
        <Navbar />
        <div className="container py-8"><Skeleton className="h-96 w-full" /></div>
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">{lang === "ar" ? "العقار غير موجود" : "Property not found"}</p>
          <Button className="mt-4" onClick={() => setLocation("/search")}>{t("common.back")}</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const title = lang === "ar" ? prop.titleAr : prop.titleEn;
  const city = lang === "ar" ? prop.cityAr : prop.city;

  const handleSubmit = () => {
    if (!selectedDate) {
      toast.error(lang === "ar" ? "يرجى تحديد تاريخ الدخول" : "Please select move-in date");
      return;
    }
    createBooking.mutate({
      propertyId,
      moveInDate: moveInDateStr,
      moveOutDate,
      durationMonths,
      tenantNotes: tenantNotes || undefined,
    });
  };

  const steps = [
    { num: 1, label: lang === "ar" ? "تفاصيل الإقامة" : "Stay Details", icon: CalendarIcon },
    { num: 2, label: lang === "ar" ? "مراجعة وتأكيد" : "Review & Confirm", icon: FileText },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <Navbar />
      <div className="container py-6 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/property/${propertyId}`)} className="mb-4 hover:bg-muted/80">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <h1 className="text-2xl font-heading font-bold mb-2">{t("booking.title")}</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {lang === "ar" ? "أرسل طلب حجز وسيتم مراجعته من الإدارة" : "Submit a booking request for admin review"}
        </p>

        {/* Step indicator */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  step >= s.num 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  <s.icon className="h-4 w-4" />
                  <span>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-0.5 rounded-full transition-colors duration-300 ${step > s.num ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Property summary card */}
        <Card className="mb-6 overflow-hidden border-0 shadow-md">
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className="w-28 h-28 shrink-0 bg-muted">
                <img src={prop.photos?.[0] || "https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/WYIAhwahEMjJJckK.jpg"} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 p-4 flex flex-col justify-center">
                <h3 className="font-semibold text-base">{title}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3.5 w-3.5" />{city}
                </div>
                <div className="text-primary font-bold mt-2 text-lg">
                  {monthlyRent.toLocaleString()} {t("payment.sar")}
                  <span className="text-muted-foreground font-normal text-sm">{t("property.perMonth")}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Stay Details */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Date Picker Card */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <Label className="text-base font-semibold mb-3 block">
                  <CalendarIcon className="h-4 w-4 inline-block me-2 text-primary" />
                  {t("booking.moveIn")}
                </Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-start h-12 text-base font-normal border-2 transition-colors ${
                        selectedDate ? "border-primary/30 bg-primary/5" : "border-border"
                      }`}
                    >
                      <CalendarIcon className="h-5 w-5 me-3 text-primary" />
                      {selectedDate ? (
                        <span className="font-medium">
                          {format(selectedDate, "dd MMMM yyyy", { locale: lang === "ar" ? ar : enUS })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {lang === "ar" ? "اختر تاريخ الدخول..." : "Select move-in date..."}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setDateOpen(false);
                      }}
                      disabled={(date) => date < today}
                      locale={lang === "ar" ? ar : enUS}
                      dir={dir}
                    />
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>

            {/* Duration Card */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <Label className="text-base font-semibold mb-3 block">
                  <Clock className="h-4 w-4 inline-block me-2 text-primary" />
                  {t("booking.duration")}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2].map(m => (
                    <button
                      key={m}
                      onClick={() => setDurationMonths(m)}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                        durationMonths === m
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/15"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`text-2xl font-bold mb-1 ${durationMonths === m ? "text-primary" : "text-foreground"}`}>
                        {m}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {m === 1 ? (lang === "ar" ? "شهر واحد" : "Month") : (lang === "ar" ? "شهرين" : "Months")}
                      </div>
                      {durationMonths === m && (
                        <div className="absolute top-2 end-2">
                          <CheckCircle className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Move-out preview */}
            {selectedDate && moveOutDate && (
              <Card className="border-0 shadow-md bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">{t("booking.moveIn")}</span>
                    </div>
                    <span className="font-semibold">
                      {format(selectedDate, "dd MMM yyyy", { locale: lang === "ar" ? ar : enUS })}
                    </span>
                  </div>
                  <div className="border-s-2 border-dashed border-primary/30 ms-1 my-2 h-4" />
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">{t("booking.moveOut")}</span>
                    </div>
                    <span className="font-semibold">
                      {format(new Date(moveOutDate), "dd MMM yyyy", { locale: lang === "ar" ? ar : enUS })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <Label className="text-base font-semibold mb-3 block">
                  {lang === "ar" ? "ملاحظات (اختياري)" : "Notes (optional)"}
                </Label>
                <Textarea
                  value={tenantNotes}
                  onChange={e => setTenantNotes(e.target.value)}
                  placeholder={lang === "ar" ? "أي ملاحظات خاصة للمالك..." : "Any special notes for the landlord..."}
                  rows={3}
                  className="resize-none border-2"
                />
              </CardContent>
            </Card>

            <Button 
              className="w-full h-12 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold text-base shadow-lg shadow-[#3ECFC0]/25" 
              onClick={() => setStep(2)} 
              disabled={!selectedDate}
            >
              {t("common.next")}
              {dir === "rtl" ? <ArrowLeft className="h-4 w-4 ms-2" /> : <ArrowRight className="h-4 w-4 ms-2" />}
            </Button>
          </div>
        )}

        {/* Step 2: Review & Confirm */}
        {step === 2 && (
          <div className="space-y-5">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{lang === "ar" ? "ملخص الحجز" : "Booking Summary"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stay details */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">{t("booking.moveIn")}</span>
                    <span className="font-medium">{selectedDate && format(selectedDate, "dd MMMM yyyy", { locale: lang === "ar" ? ar : enUS })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">{t("booking.moveOut")}</span>
                    <span className="font-medium">{moveOutDate && format(new Date(moveOutDate), "dd MMMM yyyy", { locale: lang === "ar" ? ar : enUS })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">{t("booking.duration")}</span>
                    <Badge variant="secondary" className="font-medium">
                      {durationMonths === 1 ? (lang === "ar" ? "شهر واحد" : "1 Month") : (lang === "ar" ? "شهرين" : "2 Months")}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Cost breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("property.monthlyRent")} x {durationMonths}</span>
                    <span className="font-medium">{totalRent.toLocaleString()} {t("payment.sar")}</span>
                  </div>
                  {securityDeposit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("property.securityDeposit")} ({depositPercent}%)</span>
                      <span className="font-medium">{securityDeposit.toLocaleString()} {t("payment.sar")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("payment.serviceFee")} ({serviceFeePercent}%)</span>
                    <span className="font-medium">{serviceFee.toLocaleString()} {t("payment.sar")}</span>
                  </div>
                  {vatAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === "ar" ? `ضريبة القيمة المضافة (${vatPercent}%)` : `VAT (${vatPercent}%)`}</span>
                      <span className="font-medium">{vatAmount.toLocaleString()} {t("payment.sar")}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t("common.total")}</span>
                    <span className="text-primary">{totalAmount.toLocaleString()} {t("payment.sar")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info notice */}
            <Card className="border-0 shadow-md bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4 flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    {lang === "ar" ? "يتطلب موافقة الإدارة" : "Requires Admin Approval"}
                  </p>
                  <p className="text-amber-700 dark:text-amber-400">
                    {lang === "ar"
                      ? "سيتم مراجعة طلبك من الإدارة. بعد الموافقة ستتمكن من إتمام عملية الدفع عبر PayPal أو Apple Pay أو Google Pay."
                      : "Your request will be reviewed by admin. After approval, you'll be able to complete payment via PayPal, Apple Pay, or Google Pay."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 border-2" onClick={() => setStep(1)}>
                {t("common.back")}
              </Button>
              <Button
                className="flex-1 h-12 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold text-base shadow-lg shadow-[#3ECFC0]/25"
                onClick={handleSubmit}
                disabled={createBooking.isPending}
              >
                {createBooking.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {lang === "ar" ? "إرسال طلب الحجز" : "Submit Booking Request"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <Card className="text-center py-12 border-0 shadow-lg">
            <CardContent>
              <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-heading font-bold mb-2">
                {lang === "ar" ? "تم إرسال طلب الحجز بنجاح!" : "Booking Request Submitted!"}
              </h2>
              <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                {lang === "ar"
                  ? "سيقوم فريق الإدارة بمراجعة طلبك والرد عليك قريباً."
                  : "The admin team will review your request and respond shortly."}
              </p>
              <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                {lang === "ar"
                  ? "بعد الموافقة على طلبك، ستتمكن من إتمام الدفع عبر PayPal أو Apple Pay أو Google Pay من لوحة التحكم الخاصة بك."
                  : "Once approved, you'll be able to complete payment via PayPal, Apple Pay, or Google Pay from your dashboard."}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setLocation("/dashboard")} className="border-2">
                  {t("dashboard.tenant")}
                </Button>
                <Button onClick={() => setLocation("/search")} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold">
                  {t("nav.search")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}
