import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, CheckCircle, ArrowLeft, ArrowRight,
  Loader2, Shield, Smartphone, Wallet, Clock, AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import SEOHead from "@/components/SEOHead";

type MethodKey = string;

const methodIcons: Record<string, any> = {
  mada_card: CreditCard,
  apple_pay: Smartphone,
  google_pay: Wallet,
  paypal: Wallet,
  cash: Wallet,
};

const methodColors: Record<string, { color: string; bgColor: string }> = {
  mada_card: { color: "text-[#1A6B4E]", bgColor: "bg-[#1A6B4E]/10 border-[#1A6B4E]/20 hover:border-[#1A6B4E]/50" },
  apple_pay: { color: "text-black dark:text-white", bgColor: "bg-black/5 dark:bg-white/10 border-black/20 dark:border-white/20 hover:border-black/50 dark:hover:border-white/50" },
  google_pay: { color: "text-[#4285F4]", bgColor: "bg-[#4285F4]/10 border-[#4285F4]/20 hover:border-[#4285F4]/50" },
  paypal: { color: "text-[#003087]", bgColor: "bg-[#003087]/10 border-[#003087]/20 hover:border-[#003087]/50" },
  cash: { color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-400" },
};

export default function PaymentPage() {
  const { t, lang, dir } = useI18n();
  const { isAuthenticated, loading } = useAuth();
  const [, params] = useRoute("/pay/:id");
  const [, setLocation] = useLocation();
  const bookingId = Number(params?.id);
  const { get: setting } = useSiteSettings();

  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);
  const [processing, setProcessing] = useState(false);

  // Card form state (for mada)
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const booking = trpc.booking.getById.useQuery({ id: bookingId }, { enabled: !!bookingId });

  // Fetch available payment methods dynamically from server
  const methodsQuery = trpc.finance.moyasarPayment.getAvailableMethods.useQuery();
  const createPaymentMutation = trpc.finance.moyasarPayment.createPayment.useMutation();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const b = booking.data;

  if (booking.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8 max-w-2xl">
          <Skeleton className="h-12 w-48 mb-6" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!b) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">{lang === "ar" ? "الحجز غير موجود" : "Booking not found"}</p>
          <Button className="mt-4" onClick={() => setLocation("/dashboard")}>{t("dashboard.tenant")}</Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (b.status !== "approved") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {lang === "ar" ? "الحجز غير جاهز للدفع" : "Booking Not Ready for Payment"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {b.status === "pending"
              ? (lang === "ar" ? "طلب الحجز قيد المراجعة. سيتم إخطارك عند الموافقة." : "Booking request is under review. You'll be notified once approved.")
              : (lang === "ar" ? "حالة الحجز الحالية لا تسمح بالدفع." : "Current booking status does not allow payment.")}
          </p>
          <Button onClick={() => setLocation("/dashboard")} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 font-semibold">
            {t("dashboard.tenant")}
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const monthlyRent = Number(b.monthlyRent);
  const totalAmount = Number(b.totalAmount);
  const methods = methodsQuery.data?.methods || [];

  const handlePay = async () => {
    if (!selectedMethod) {
      toast.error(lang === "ar" ? "يرجى اختيار طريقة الدفع" : "Please select a payment method");
      return;
    }

    const method = methods.find((m: any) => m.key === selectedMethod);
    if (!method) return;

    // Cash on delivery
    if (method.provider === "manual") {
      toast.success(
        lang === "ar"
          ? "تم تأكيد الدفع عند الاستلام. تواصل مع الإدارة لترتيب التسليم."
          : "Cash on delivery confirmed. Contact admin to arrange handover."
      );
      setLocation("/dashboard");
      return;
    }

    // PayPal — existing flow
    if (method.provider === "paypal") {
      toast.info(
        lang === "ar"
          ? "سيتم توجيهك إلى PayPal لإتمام الدفع."
          : "You will be redirected to PayPal to complete payment."
      );
      return;
    }

    // Moyasar payment
    if (method.provider === "moyasar") {
      setProcessing(true);
      try {
        let sourceType: "creditcard" | "applepay" | "googlepay" = "creditcard";
        if (selectedMethod === "apple_pay") sourceType = "applepay";
        else if (selectedMethod === "google_pay") sourceType = "googlepay";

        if (sourceType === "creditcard") {
          if (!cardNumber || !cardName || !cardExpiry || !cardCvc) {
            toast.error(lang === "ar" ? "يرجى إدخال بيانات البطاقة كاملة" : "Please fill in all card details");
            setProcessing(false);
            return;
          }
        }

        const callbackUrl = `${window.location.origin}/payment-callback/${bookingId}`;

        const result = await createPaymentMutation.mutateAsync({
          bookingId,
          amount: totalAmount,
          description: lang === "ar" ? `دفع حجز #${bookingId}` : `Booking #${bookingId} payment`,
          callbackUrl,
          sourceType,
        });

        // Moyasar returns transactionUrl for 3DS redirect (mada cards)
        if (result.transactionUrl) {
          window.location.href = result.transactionUrl;
        } else if (result.status === "paid" || result.status === "initiated") {
          // For Apple Pay / Google Pay that complete instantly
          setLocation(`/payment-callback/${bookingId}?id=${result.paymentId}&status=${result.status}`);
        } else {
          toast.error(lang === "ar" ? "فشل إنشاء عملية الدفع" : "Failed to create payment");
        }
      } catch (err: any) {
        toast.error(err.message || (lang === "ar" ? "حدث خطأ أثناء الدفع" : "Payment error occurred"));
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <SEOHead title="Payment" titleAr="الدفع" path="/pay" noindex={true} />
      <Navbar />
      <div className="container py-6 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} className="mb-4 hover:bg-muted/80">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <h1 className="text-2xl font-heading font-bold mb-2">
          {lang === "ar" ? "إتمام الدفع" : "Complete Payment"}
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          {lang === "ar" ? "تم الموافقة على حجزك — اختر طريقة الدفع لإتمام العملية" : "Your booking is approved — select a payment method to proceed"}
        </p>

        {/* Booking Summary */}
        <Card className="mb-6 border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{lang === "ar" ? "ملخص الحجز" : "Booking Summary"}</CardTitle>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                <CheckCircle className="h-3 w-3 me-1" />
                {lang === "ar" ? "تمت الموافقة" : "Approved"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{lang === "ar" ? "رقم الحجز" : "Booking #"}</span>
                <span className="font-medium">#{b.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("booking.moveIn")}</span>
                <span className="font-medium">{format(new Date(b.moveInDate), "dd MMM yyyy", { locale: lang === "ar" ? ar : enUS })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("booking.moveOut")}</span>
                <span className="font-medium">{format(new Date(b.moveOutDate), "dd MMM yyyy", { locale: lang === "ar" ? ar : enUS })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("booking.duration")}</span>
                <span className="font-medium">
                  {b.durationMonths === 1 ? (lang === "ar" ? "شهر واحد" : "1 Month") : (lang === "ar" ? "شهرين" : "2 Months")}
                </span>
              </div>
            </div>

            <Separator />

            {(() => {
              const hideIns = setting("calculator.hideInsuranceFromTenant", "false") === "true";
              const rentTotal = monthlyRent * b.durationMonths;
              const deposit = b.securityDeposit ? Number(b.securityDeposit) : 0;
              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("property.monthlyRent")} x {b.durationMonths}</span>
                    <span className="font-medium">{(hideIns ? rentTotal + deposit : rentTotal).toLocaleString()} {t("payment.sar")}</span>
                  </div>
                  {!hideIns && deposit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("property.securityDeposit")}</span>
                      <span className="font-medium">{deposit.toLocaleString()} {t("payment.sar")}</span>
                    </div>
                  )}
                </>
              );
            })()}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>{t("common.total")}</span>
              <span className="text-primary">{totalAmount.toLocaleString()} {t("payment.sar")}</span>
            </div>

            {/* Ledger / Invoice Info */}
            {(b as any).ledgerEntries?.length > 0 && (
              <>
                <Separator />
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {lang === "ar" ? "بيانات الفاتورة" : "Invoice Details"}
                    </span>
                  </div>
                  {(b as any).ledgerEntries.map((entry: any) => (
                    <div key={entry.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{lang === "ar" ? "رقم الفاتورة" : "Invoice #"}</span>
                        <span className="font-mono font-medium text-xs">{entry.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{lang === "ar" ? "المبلغ" : "Amount"}</span>
                        <span className="font-medium">{Number(entry.amount).toLocaleString()} {entry.currency}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{lang === "ar" ? "الحالة" : "Status"}</span>
                        <Badge variant={entry.status === 'PAID' ? 'default' : 'secondary'} className={entry.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {entry.status === 'PAID' ? (lang === "ar" ? "مدفوع" : "Paid") : entry.status === 'DUE' ? (lang === "ar" ? "مستحق" : "Due") : entry.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{lang === "ar" ? "النوع" : "Type"}</span>
                        <span className="font-medium">{entry.type === 'INITIAL_RENT' ? (lang === "ar" ? "إيجار أولي" : "Initial Rent") : entry.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="mb-6 border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {lang === "ar" ? "اختر طريقة الدفع" : "Select Payment Method"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {methodsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : methods.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {lang === "ar"
                    ? "لا توجد طرق دفع متاحة حالياً. تواصل مع الإدارة."
                    : "No payment methods available. Contact admin."}
                </p>
              </div>
            ) : (
              methods.map(method => {
                const Icon = methodIcons[method.key] || CreditCard;
                const colors = methodColors[method.key] || { color: "text-primary", bgColor: "bg-primary/10 border-primary/20 hover:border-primary/50" };
                return (
                  <button
                    key={method.key}
                    onClick={() => setSelectedMethod(method.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-start ${
                      selectedMethod === method.key
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/15 ring-1 ring-primary/20"
                        : colors.bgColor
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedMethod === method.key ? "bg-primary/10" : "bg-muted/50"
                    }`}>
                      <Icon className={`h-6 w-6 ${selectedMethod === method.key ? "text-primary" : colors.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base">
                        {lang === "ar" ? method.labelAr : method.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {method.provider === "moyasar" && (lang === "ar" ? "عبر Moyasar — آمن ومشفر" : "via Moyasar — secure & encrypted")}
                        {method.provider === "paypal" && (lang === "ar" ? "ادفع بأمان عبر حسابك في PayPal" : "Pay securely with your PayPal account")}
                        {method.provider === "manual" && (lang === "ar" ? "ادفع نقداً عند استلام المفاتيح" : "Pay in cash when you receive the keys")}
                      </div>
                    </div>
                    {selectedMethod === method.key && (
                      <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Card Form — only for mada_card */}
        {selectedMethod === "mada_card" && (
          <Card className="mb-6 border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#1A6B4E]" />
                {lang === "ar" ? "بيانات البطاقة" : "Card Details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{lang === "ar" ? "رقم البطاقة" : "Card Number"}</Label>
                <Input
                  placeholder="5123 4567 8901 2346"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 19))}
                  dir="ltr"
                  className="font-mono text-lg tracking-wider"
                />
              </div>
              <div className="space-y-2">
                <Label>{lang === "ar" ? "اسم حامل البطاقة" : "Cardholder Name"}</Label>
                <Input
                  placeholder="AHMED MOHAMMED"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{lang === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</Label>
                  <Input
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={(e) => {
                      let v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                      if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                      setCardExpiry(v);
                    }}
                    dir="ltr"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CVC</Label>
                  <Input
                    placeholder="123"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                    dir="ltr"
                    className="font-mono"
                    type="password"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                {lang === "ar"
                  ? "بياناتك مشفرة ومحمية عبر Moyasar. لا يتم تخزين بيانات البطاقة على خوادمنا."
                  : "Your data is encrypted via Moyasar. Card details are never stored on our servers."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Security notice */}
        <Card className="mb-6 border-0 shadow-sm bg-muted/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? "جميع المعاملات مشفرة ومحمية. لن يتم مشاركة بياناتك المالية مع أي طرف ثالث."
                : "All transactions are encrypted and secure. Your financial data will not be shared with third parties."}
            </p>
          </CardContent>
        </Card>

        {/* Pay Button */}
        <Button
          className="w-full h-14 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-bold text-lg shadow-lg shadow-[#3ECFC0]/25 mb-6"
          onClick={handlePay}
          disabled={!selectedMethod || processing}
        >
          {processing ? (
            <>
              <Loader2 className="h-5 w-5 me-2 animate-spin" />
              {lang === "ar" ? "جاري المعالجة..." : "Processing..."}
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5 me-2" />
              {lang === "ar" ? `ادفع ${totalAmount.toLocaleString()} ر.س` : `Pay ${totalAmount.toLocaleString()} SAR`}
            </>
          )}
        </Button>
      </div>
      <Footer />
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}
