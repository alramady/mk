import { useLocation, useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PaymentCancel() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const bookingId = params.get("bookingId");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
              <XCircle className="h-12 w-12 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-amber-600">
              {lang === "ar" ? "تم إلغاء الدفع" : "Payment Cancelled"}
            </h2>
            <p className="text-muted-foreground">
              {lang === "ar"
                ? "تم إلغاء عملية الدفع. يمكنك المحاولة مرة أخرى من لوحة التحكم."
                : "Payment was cancelled. You can try again from your dashboard."}
            </p>
            <div className="flex gap-3 justify-center">
              {bookingId && (
                <Button onClick={() => setLocation(`/booking/${bookingId}`)} className="btn-animate">
                  {lang === "ar" ? "إعادة المحاولة" : "Try Again"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setLocation("/tenant")}>
                {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
