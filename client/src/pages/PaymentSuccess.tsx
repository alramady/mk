import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PaymentSuccess() {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const bookingId = params.get("bookingId");
  const token = params.get("token");
  const payerId = params.get("PayerID");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const captureMutation = trpc.payment.capturePayPalOrder.useMutation();

  useEffect(() => {
    if (!bookingId || !token) {
      setStatus("error");
      setErrorMsg(lang === "ar" ? "بيانات الدفع غير مكتملة" : "Incomplete payment data");
      return;
    }

    // Capture the PayPal order
    captureMutation.mutate(
      { orderId: token, bookingId: parseInt(bookingId) },
      {
        onSuccess: (result) => {
          if (result.status === "COMPLETED") {
            setStatus("success");
          } else {
            setStatus("error");
            setErrorMsg(lang === "ar" ? "لم يتم إكمال الدفع" : "Payment was not completed");
          }
        },
        onError: (err) => {
          setStatus("error");
          setErrorMsg(err.message);
        },
      }
    );
  }, [bookingId, token]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            {status === "loading" && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                <h2 className="text-xl font-bold font-heading">
                  {lang === "ar" ? "جاري تأكيد الدفع..." : "Confirming payment..."}
                </h2>
                <p className="text-muted-foreground">
                  {lang === "ar" ? "يرجى الانتظار" : "Please wait"}
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-green-600">
                  {lang === "ar" ? "تم الدفع بنجاح!" : "Payment Successful!"}
                </h2>
                <p className="text-muted-foreground">
                  {lang === "ar"
                    ? "تم تأكيد الدفع وسيتم تحديث حالة الحجز"
                    : "Payment confirmed. Your booking status will be updated."}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => setLocation("/tenant")} className="btn-animate">
                    {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/")}>
                    {lang === "ar" ? "الرئيسية" : "Home"}
                  </Button>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-red-600">
                  {lang === "ar" ? "فشل الدفع" : "Payment Failed"}
                </h2>
                <p className="text-muted-foreground">{errorMsg}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => setLocation("/tenant")} className="btn-animate">
                    {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/")}>
                    {lang === "ar" ? "الرئيسية" : "Home"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
