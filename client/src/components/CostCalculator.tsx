/**
 * CostCalculator — fully backend-driven cost calculator component.
 * Fetches config (allowed months, rates, labels, tooltips) from calculator.getConfig
 * and calls calculator.calculate for server-side validated calculations.
 * No hardcoded values — everything comes from the backend.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calculator, X, ArrowLeft, Info, Shield, Receipt, Percent,
  DollarSign, Calendar, TrendingUp, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface CostCalculatorProps {
  monthlyRent: number;
  propertyTitle?: string;
  onClose: () => void;
  onBook?: () => void;
  bookLabel?: string;
}

export default function CostCalculator({
  monthlyRent,
  propertyTitle,
  onClose,
  onBook,
  bookLabel,
}: CostCalculatorProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  // Fetch calculator config from backend
  const configQuery = trpc.calculator.getConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min cache
    refetchOnWindowFocus: false,
  });

  const config = configQuery.data;
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);

  // Auto-select first allowed month when config loads
  useEffect(() => {
    if (config && config.allowedMonths.length > 0 && selectedMonths === null) {
      setSelectedMonths(config.allowedMonths[0]);
    }
  }, [config, selectedMonths]);

  // Server-side calculation
  const calcMutation = trpc.calculator.calculate.useMutation();

  // Trigger calculation when months change
  useEffect(() => {
    if (selectedMonths && monthlyRent > 0) {
      calcMutation.mutate({ monthlyRent, selectedMonths });
    }
  }, [selectedMonths, monthlyRent]);

  const result = calcMutation.data;
  const currency = isAr
    ? (config?.currencySymbolAr || "ر.س")
    : (config?.currencySymbolEn || "SAR");

  // Loading state
  if (configQuery.isLoading) {
    return (
      <Card className="shadow-lg border-[#C9A96E]/30 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0B1E2D] to-[#132d42] p-4">
          <div className="flex items-center gap-2 text-white">
            <Calculator className="h-5 w-5 text-[#C9A96E]" />
            <Skeleton className="h-6 w-32 bg-white/20" />
          </div>
        </div>
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (configQuery.isError) {
    return (
      <Card className="shadow-lg border-red-300 overflow-hidden">
        <CardContent className="p-5 text-center space-y-3">
          <p className="text-red-500 text-sm">
            {isAr ? "تعذر تحميل إعدادات الحاسبة" : "Failed to load calculator config"}
          </p>
          <Button variant="outline" size="sm" onClick={() => configQuery.refetch()}>
            {isAr ? "إعادة المحاولة" : "Retry"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const labels = config?.labels;

  return (
    <Card className="shadow-lg border-[#C9A96E]/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0B1E2D] to-[#132d42] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Calculator className="h-5 w-5 text-[#C9A96E]" />
            <span className="font-heading font-bold text-lg">
              {isAr ? "حاسبة التكاليف" : "Cost Calculator"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
        {propertyTitle && (
          <p className="text-white/60 text-xs mt-1 truncate">{propertyTitle}</p>
        )}
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Monthly Rent Display */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#3ECFC0]/10 border border-[#3ECFC0]/20">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#3ECFC0]" />
            <span className="text-sm font-medium">
              {isAr ? "الإيجار الشهري" : "Monthly Rent"}
            </span>
          </div>
          <span className="font-bold text-[#3ECFC0]">
            {monthlyRent.toLocaleString()} {currency}
          </span>
        </div>

        {/* Duration Selection — button chips instead of slider */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[#C9A96E]" />
            <span className="text-sm font-medium">
              {isAr ? "مدة الإيجار" : "Rental Duration"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {config?.allowedMonths.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonths(m)}
                className={`
                  px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                  ${selectedMonths === m
                    ? "bg-[#3ECFC0] text-[#0B1E2D] shadow-md shadow-[#3ECFC0]/30 scale-105"
                    : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                  }
                `}
              >
                {m} {m === 1 ? (isAr ? "شهر" : "month") : (isAr ? "أشهر" : "months")}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Cost Breakdown */}
        {calcMutation.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : calcMutation.isError ? (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm text-center">
            {calcMutation.error?.message || (isAr ? "خطأ في الحساب" : "Calculation error")}
          </div>
        ) : result ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              {isAr ? "تفاصيل التكلفة" : "Cost Breakdown"}
            </h4>

            <div className="space-y-2.5 text-sm">
              {/* Rent Total */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {isAr
                    ? `الإيجار (${result.selectedMonths} ${result.selectedMonths === 1 ? "شهر" : "أشهر"})`
                    : `Rent (${result.selectedMonths} ${result.selectedMonths === 1 ? "month" : "months"})`}
                </span>
                <span className="font-medium">
                  {result.rentTotal.toLocaleString()} {currency}
                </span>
              </div>

              {/* Insurance/Deposit */}
              <div className="flex justify-between items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                        <Shield className="h-3.5 w-3.5 text-[#C9A96E]" />
                        {isAr ? labels?.insuranceAr : labels?.insuranceEn} ({result.appliedRates.insuranceRate}%)
                        <Info className="h-3 w-3 text-muted-foreground/50" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px] text-xs">
                      {isAr ? labels?.insuranceTooltipAr : labels?.insuranceTooltipEn}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-medium">
                  {result.insuranceAmount.toLocaleString()} {currency}
                </span>
              </div>

              {/* Service Fee */}
              <div className="flex justify-between items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                        <Receipt className="h-3.5 w-3.5 text-[#C9A96E]" />
                        {isAr ? labels?.serviceFeeAr : labels?.serviceFeeEn} ({result.appliedRates.serviceFeeRate}%)
                        <Info className="h-3 w-3 text-muted-foreground/50" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px] text-xs">
                      {isAr ? labels?.serviceFeeTooltipAr : labels?.serviceFeeTooltipEn}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-medium">
                  {result.serviceFeeAmount.toLocaleString()} {currency}
                </span>
              </div>

              <Separator className="my-1" />

              {/* Subtotal */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {isAr ? "المجموع الفرعي" : "Subtotal"}
                </span>
                <span className="font-medium">
                  {result.subtotal.toLocaleString()} {currency}
                </span>
              </div>

              {/* VAT */}
              <div className="flex justify-between items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                        <Percent className="h-3.5 w-3.5 text-[#C9A96E]" />
                        {isAr ? labels?.vatAr : labels?.vatEn} ({result.appliedRates.vatRate}%)
                        <Info className="h-3 w-3 text-muted-foreground/50" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px] text-xs">
                      {isAr ? labels?.vatTooltipAr : labels?.vatTooltipEn}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-medium">
                  {result.vatAmount.toLocaleString()} {currency}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Grand Total */}
        {result && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#0B1E2D] to-[#132d42] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#3ECFC0]" />
                <span className="text-white/80 text-sm">
                  {isAr ? "الإجمالي الكلي" : "Grand Total"}
                </span>
              </div>
              <div className="text-end">
                <div className="text-2xl font-bold font-heading text-[#3ECFC0]">
                  {result.grandTotal.toLocaleString()}
                </div>
                <div className="text-xs text-white/50">
                  {isAr ? "ريال سعودي" : "SAR"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {onBook && (
          <Button
            className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold"
            size="lg"
            onClick={onBook}
          >
            {bookLabel || (isAr ? "احجز الآن" : "Book Now")}
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onClose}
        >
          <ArrowLeft className="h-4 w-4 me-2" />
          {isAr ? "العودة لتفاصيل السعر" : "Back to pricing details"}
        </Button>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
          {isAr
            ? "* الأسعار تقريبية وقد تختلف عند الحجز الفعلي. التأمين قابل للاسترداد."
            : "* Prices are approximate and may vary at actual booking. Deposit is refundable."}
        </p>
      </CardContent>
    </Card>
  );
}
