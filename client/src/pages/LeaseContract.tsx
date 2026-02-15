import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useParams, useLocation } from "wouter";
import { FileText, Download, Printer, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";

export default function LeaseContract() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [contractHtml, setContractHtml] = useState<string | null>(null);
  const [contractNumber, setContractNumber] = useState<string>("");

  const generateMutation = trpc.lease.generate.useMutation({
    onSuccess: (data) => {
      setContractHtml(data.html);
      setContractNumber(data.contractNumber);
    },
  });

  const handleGenerate = () => {
    if (!bookingId) return;
    generateMutation.mutate({ bookingId: parseInt(bookingId) });
  };

  const handlePrint = () => {
    if (!contractHtml) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(contractHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleDownload = () => {
    if (!contractHtml) return;
    const blob = new Blob([contractHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractNumber || "lease-contract"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Navbar />
      <main className="flex-1 container py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/tenant")}
          className="mb-4 gap-2"
        >
          <ArrowRight className={`w-4 h-4 ${lang === "en" ? "rotate-180" : ""}`} />
          {lang === "ar" ? "العودة للوحة التحكم" : "Back to Dashboard"}
        </Button>

        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {lang === "ar" ? "عقد الإيجار الرقمي" : "Digital Lease Contract"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {lang === "ar"
                  ? "إنشاء وتصدير عقد إيجار ثنائي اللغة متوافق مع الأنظمة"
                  : "Generate and export a bilingual lease contract compliant with Ejar system"}
              </p>
            </div>
          </div>

          {!contractHtml ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  {lang === "ar" ? "إنشاء عقد إيجار" : "Generate Lease Contract"}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {lang === "ar"
                    ? `سيتم إنشاء عقد إيجار رقمي للحجز رقم #${bookingId} يتضمن جميع التفاصيل والشروط والأحكام باللغتين العربية والإنجليزية.`
                    : `A digital lease contract will be generated for booking #${bookingId} including all details, terms and conditions in both Arabic and English.`}
                </p>
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 gap-2"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {lang === "ar" ? "جاري الإنشاء..." : "Generating..."}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {lang === "ar" ? "إنشاء العقد" : "Generate Contract"}
                    </>
                  )}
                </Button>
                {generateMutation.isError && (
                  <p className="text-red-500 mt-4 text-sm">
                    {lang === "ar" ? "حدث خطأ أثناء إنشاء العقد. تأكد من صحة رقم الحجز." : "Error generating contract. Please verify the booking ID."}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div>
              {/* Action buttons */}
              <div className="flex gap-3 mb-4">
                <Button onClick={handlePrint} variant="outline" className="gap-2">
                  <Printer className="w-4 h-4" />
                  {lang === "ar" ? "طباعة" : "Print"}
                </Button>
                <Button onClick={handleDownload} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  {lang === "ar" ? "تحميل HTML" : "Download HTML"}
                </Button>
                <Button
                  onClick={() => {
                    setContractHtml(null);
                    setContractNumber("");
                  }}
                  variant="ghost"
                  className="gap-2"
                >
                  {lang === "ar" ? "إعادة إنشاء" : "Regenerate"}
                </Button>
              </div>

              {/* Contract preview */}
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <iframe
                    srcDoc={contractHtml}
                    className="w-full border-0"
                    style={{ minHeight: "900px" }}
                    title="Lease Contract"
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
