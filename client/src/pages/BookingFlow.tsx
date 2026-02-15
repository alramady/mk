import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, CreditCard, FileText, CheckCircle, ArrowLeft, ArrowRight,
  Loader2, MapPin, BedDouble, Bath, Maximize2
} from "lucide-react";
import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export default function BookingFlow() {
  const { t, lang, dir } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [, params] = useRoute("/book/:id");
  const [, setLocation] = useLocation();
  const propertyId = Number(params?.id);

  const property = trpc.property.getById.useQuery({ id: propertyId }, { enabled: !!propertyId });
  const { get: setting } = useSiteSettings();

  // Dynamic rental duration limits from CMS settings
  const platformMinMonths = parseInt(setting("rental.minMonths", "1")) || 1;
  const platformMaxMonths = parseInt(setting("rental.maxMonths", "12")) || 12;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    moveInDate: "",
    durationMonths: platformMinMonths,
    tenantNotes: "",
  });

  const paymentSettings = trpc.payment.getPaymentSettings.useQuery();
  const createPayPalOrder = trpc.payment.createPayPalOrder.useMutation();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "paypal">("cash");

  const createBooking = trpc.booking.create.useMutation({
    onSuccess: async (data) => {
      if (paymentMethod === "paypal" && paymentSettings.data?.enabled && paymentSettings.data?.hasCredentials) {
        // Create PayPal order and redirect
        try {
          const order = await createPayPalOrder.mutateAsync({
            bookingId: data.id!,
            amount: totalAmount,
            description: `Monthly Key - ${title} (${form.durationMonths} ${lang === "ar" ? "شهر" : "months"})`,
            origin: window.location.origin,
          });
          if (order.approvalUrl) {
            window.location.href = order.approvalUrl;
            return;
          }
        } catch (err: any) {
          toast.error(err.message || "PayPal error");
        }
      }
      setStep(4);
      toast.success(lang === "ar" ? "تم إرسال طلب الحجز بنجاح" : "Booking request submitted successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const prop = property.data;
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  // Calculate costs - dynamic from CMS settings
  const serviceFeePercent = parseFloat(setting("fees.serviceFeePercent", "5")) || 5;
  const vatPercent = parseFloat(setting("fees.vatPercent", "15")) || 15;
  const depositPercent = parseFloat(setting("fees.depositPercent", "10")) || 10;
  const monthlyRent = prop ? Number(prop.monthlyRent) : 0;
  const totalRent = monthlyRent * form.durationMonths;
  const securityDeposit = Math.round(totalRent * (depositPercent / 100));
  const serviceFee = Math.round(monthlyRent * (serviceFeePercent / 100));
  const vatAmount = Math.round(serviceFee * (vatPercent / 100));
  const totalAmount = totalRent + securityDeposit + serviceFee + vatAmount;

  const moveOutDate = useMemo(() => {
    if (!form.moveInDate) return "";
    const d = new Date(form.moveInDate);
    d.setMonth(d.getMonth() + form.durationMonths);
    return d.toISOString().split("T")[0];
  }, [form.moveInDate, form.durationMonths]);

  if (property.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
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
    if (!form.moveInDate) {
      toast.error(lang === "ar" ? "يرجى تحديد تاريخ الانتقال" : "Please select move-in date");
      return;
    }
    createBooking.mutate({
      propertyId,
      moveInDate: form.moveInDate,
      moveOutDate,
      durationMonths: form.durationMonths,
      tenantNotes: form.tenantNotes || undefined,
    });
  };

  const steps = [
    { num: 1, label: lang === "ar" ? "تفاصيل الإقامة" : "Stay Details", icon: Calendar },
    { num: 2, label: lang === "ar" ? "مراجعة التكاليف" : "Review Costs", icon: CreditCard },
    { num: 3, label: lang === "ar" ? "تأكيد الحجز" : "Confirm Booking", icon: FileText },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/property/${propertyId}`)} className="mb-4">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <h1 className="text-2xl font-heading font-bold mb-6">{t("booking.title")}</h1>

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${step >= s.num ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <s.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className={`w-8 h-0.5 ${step > s.num ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Property summary card */}
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
              <img src={prop.photos?.[0] || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200&h=200&fit=crop"} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{title}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" />{city}
              </div>
              <div className="text-primary font-bold mt-1">{monthlyRent.toLocaleString()} {t("payment.sar")}{t("property.perMonth")}</div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Stay Details */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>{lang === "ar" ? "تفاصيل الإقامة" : "Stay Details"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("booking.moveIn")}</Label>
                <Input
                  type="date"
                  value={form.moveInDate}
                  onChange={e => setForm(p => ({ ...p, moveInDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  dir="ltr"
                />
              </div>
              <div>
                <Label>{t("booking.duration")}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Array.from({ length: Math.min(prop.maxStayMonths ?? platformMaxMonths, platformMaxMonths) - Math.max(prop.minStayMonths ?? platformMinMonths, platformMinMonths) + 1 }, (_, i) => i + Math.max(prop.minStayMonths ?? platformMinMonths, platformMinMonths)).map(m => (
                    <Button
                      key={m}
                      variant={form.durationMonths === m ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForm(p => ({ ...p, durationMonths: m }))}
                    >
                      {m} {t("booking.months")}
                    </Button>
                  ))}
                </div>
              </div>
              {moveOutDate && (
                <div className="bg-secondary p-3 rounded-lg text-sm">
                  <span className="text-muted-foreground">{t("booking.moveOut")}:</span>{" "}
                  <span className="font-medium">{new Date(moveOutDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              )}
              <div>
                <Label>{lang === "ar" ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
                <Textarea
                  value={form.tenantNotes}
                  onChange={e => setForm(p => ({ ...p, tenantNotes: e.target.value }))}
                  placeholder={lang === "ar" ? "أي ملاحظات خاصة للمالك..." : "Any special notes for the landlord..."}
                  rows={3}
                />
              </div>
              <Button className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold" onClick={() => setStep(2)} disabled={!form.moveInDate}>
                {t("common.next")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Cost Review */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>{lang === "ar" ? "مراجعة التكاليف" : "Cost Review"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("property.monthlyRent")} x {form.durationMonths} {t("booking.months")}</span>
                  <span className="font-medium">{totalRent.toLocaleString()} {t("payment.sar")}</span>
                </div>
                {securityDeposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("property.securityDeposit")} ({depositPercent}%)</span>
                    <span className="font-medium">{securityDeposit.toLocaleString()} {t("payment.sar")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("payment.serviceFee")} ({serviceFeePercent}%)</span>
                  <span className="font-medium">{serviceFee.toLocaleString()} {t("payment.sar")}</span>
                </div>
                {vatAmount > 0 && (
                  <div className="flex justify-between">
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
              <div className="bg-secondary p-3 rounded-lg text-sm text-muted-foreground">
                {lang === "ar"
                  ? "سيتم تحصيل المبلغ بعد موافقة المالك على طلب الحجز. رسوم الخدمة وضريبة القيمة المضافة قابلة للتعديل من إدارة المنصة."
                  : "Payment will be collected after the landlord approves your booking. Service fee and VAT rates are configurable by platform admin."}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("common.back")}</Button>
                <Button className="flex-1 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold" onClick={() => setStep(3)}>{t("common.next")}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>{lang === "ar" ? "تأكيد الحجز" : "Confirm Booking"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("booking.moveIn")}</span>
                  <span className="font-medium">{new Date(form.moveInDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("booking.moveOut")}</span>
                  <span className="font-medium">{new Date(moveOutDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("booking.duration")}</span>
                  <span className="font-medium">{form.durationMonths} {t("booking.months")}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>{t("common.total")}</span>
                  <span className="text-primary">{totalAmount.toLocaleString()} {t("payment.sar")}</span>
                </div>
              </div>
              {/* Payment Method Selection */}
              {paymentSettings.data?.enabled && paymentSettings.data?.hasCredentials && (
                <div className="space-y-3">
                  <Label className="font-semibold">{lang === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {paymentSettings.data?.cashEnabled !== false && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`border-2 rounded-lg p-4 text-start transition-all ${
                          paymentMethod === "cash" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            paymentMethod === "cash" ? "border-primary" : "border-muted-foreground"
                          }`}>
                            {paymentMethod === "cash" && <div className="w-3 h-3 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <p className="font-semibold">{lang === "ar" ? "الدفع عند الاستلام" : "Cash on Delivery"}</p>
                            <p className="text-xs text-muted-foreground">{lang === "ar" ? "ادفع عند تسليم المفتاح" : "Pay when you receive the key"}</p>
                          </div>
                        </div>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("paypal")}
                      className={`border-2 rounded-lg p-4 text-start transition-all ${
                        paymentMethod === "paypal" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          paymentMethod === "paypal" ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {paymentMethod === "paypal" && <div className="w-3 h-3 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="font-semibold">PayPal</p>
                          <p className="text-xs text-muted-foreground">{lang === "ar" ? "ادفع إلكترونياً عبر PayPal" : "Pay online via PayPal"}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-sm">
                {lang === "ar"
                  ? "بالنقر على 'تأكيد الحجز'، أنت توافق على شروط وأحكام المنصة وسياسة الإلغاء."
                  : "By clicking 'Confirm Booking', you agree to the platform's terms and conditions and cancellation policy."}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>{t("common.back")}</Button>
                <Button
                  className="flex-1 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold"
                  onClick={handleSubmit}
                  disabled={createBooking.isPending}
                >
                  {createBooking.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t("booking.confirm")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle className="h-16 w-16 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-heading font-bold mb-2">
                {lang === "ar" ? "تم إرسال طلب الحجز بنجاح!" : "Booking Request Submitted!"}
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {lang === "ar"
                  ? "سيقوم المالك بمراجعة طلبك والرد عليك قريباً. يمكنك متابعة حالة الحجز من لوحة التحكم."
                  : "The landlord will review your request and respond shortly. You can track the booking status from your dashboard."}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>{t("dashboard.tenant")}</Button>
                <Button onClick={() => setLocation("/search")} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold">{t("nav.search")}</Button>
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
