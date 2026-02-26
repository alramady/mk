import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard, Search, ArrowLeft, Loader2, Filter, Download,
  FileText, Eye, Receipt, StickyNote, Building2, Calendar,
  User, Hash, ChevronLeft, ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  DUE: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  REFUNDED: "bg-purple-100 text-purple-800 border-purple-200",
  VOID: "bg-gray-100 text-gray-800 border-gray-200",
};

const TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  RENT: { en: "Rent", ar: "إيجار" },
  RENEWAL_RENT: { en: "Renewal", ar: "تجديد" },
  PROTECTION_FEE: { en: "Protection Fee", ar: "رسوم حماية" },
  DEPOSIT: { en: "Deposit", ar: "تأمين" },
  CLEANING: { en: "Cleaning", ar: "تنظيف" },
  PENALTY: { en: "Penalty", ar: "غرامة" },
  REFUND: { en: "Refund", ar: "استرداد" },
};

const METHOD_LABELS: Record<string, { en: string; ar: string }> = {
  MADA_CARD: { en: "Mada Card", ar: "بطاقة مدى" },
  APPLE_PAY: { en: "Apple Pay", ar: "Apple Pay" },
  GOOGLE_PAY: { en: "Google Pay", ar: "Google Pay" },
  TABBY: { en: "Tabby", ar: "تابي" },
  TAMARA: { en: "Tamara", ar: "تمارا" },
  CASH: { en: "Cash", ar: "نقدي" },
  BANK_TRANSFER: { en: "Bank Transfer", ar: "تحويل بنكي" },
  PAYPAL: { en: "PayPal", ar: "PayPal" },
};

export default function AdminPayments() {
  const { lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const isRtl = lang === "ar";

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const limit = 25;

  // Detail dialog
  const [detailId, setDetailId] = useState<number | null>(null);
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; entry: any }>({ open: false, entry: null });

  // Build filters
  const filters = useMemo(() => ({
    ...(searchQuery ? { guestNameOrPhone: searchQuery } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(methodFilter !== "all" ? { paymentMethod: methodFilter } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    limit,
    offset: page * limit,
  }), [searchQuery, statusFilter, typeFilter, methodFilter, dateFrom, dateTo, page]);

  const { data, isLoading, error } = trpc.finance.ledger.search.useQuery(filters);
  const detailQuery = trpc.finance.ledger.getById.useQuery({ id: detailId! }, { enabled: !!detailId });
  const updateStatusMut = trpc.finance.ledger.updateStatus.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم تحديث الحالة" : "Status updated"); },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground mb-4">{lang === "ar" ? "يجب تسجيل الدخول كمسؤول" : "Admin access required"}</p>
          <a href={getLoginUrl()}><Button>{lang === "ar" ? "تسجيل الدخول" : "Login"}</Button></a>
        </div>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background">
      <SEOHead title="Payments Registry" titleAr="سجل المدفوعات" path="/admin/payments" noindex />
      <Navbar />
      <div className="container py-8 flex-1 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 hover:bg-primary/10">
                <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                {lang === "ar" ? "سجل المدفوعات" : "Payments Registry"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {data ? `${data.total} ${lang === "ar" ? "سجل" : "entries"}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-border/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={lang === "ar" ? "بحث بالاسم أو الهاتف أو رقم الفاتورة..." : "Search by name, phone, invoice #..."}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="ps-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === "ar" ? "الحالة" : "Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "ar" ? "جميع الحالات" : "All Statuses"}</SelectItem>
                  <SelectItem value="DUE">{lang === "ar" ? "مستحق" : "Due"}</SelectItem>
                  <SelectItem value="PENDING">{lang === "ar" ? "معلق" : "Pending"}</SelectItem>
                  <SelectItem value="PAID">{lang === "ar" ? "مدفوع" : "Paid"}</SelectItem>
                  <SelectItem value="FAILED">{lang === "ar" ? "فشل" : "Failed"}</SelectItem>
                  <SelectItem value="REFUNDED">{lang === "ar" ? "مسترد" : "Refunded"}</SelectItem>
                  <SelectItem value="VOID">{lang === "ar" ? "ملغي" : "Void"}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === "ar" ? "النوع" : "Type"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "ar" ? "جميع الأنواع" : "All Types"}</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{lang === "ar" ? v.ar : v.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === "ar" ? "طريقة الدفع" : "Method"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "ar" ? "جميع الطرق" : "All Methods"}</SelectItem>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{lang === "ar" ? v.ar : v.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                placeholder={lang === "ar" ? "من تاريخ" : "From date"} />
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                placeholder={lang === "ar" ? "إلى تاريخ" : "To date"} />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border/50">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-destructive">{lang === "ar" ? "خطأ في تحميل البيانات" : "Error loading data"}</div>
            ) : !data?.items?.length ? (
              <div className="p-12 text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{lang === "ar" ? "لا توجد سجلات مدفوعات" : "No payment records found"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "التاريخ" : "Date"}</th>
                      <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "المبنى" : "Building"}</th>
                      <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "الوحدة" : "Unit"}</th>
                      <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "العميل" : "Customer"}</th>
                      <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "النوع" : "Type"}</th>
                      <th className="px-4 py-3 text-end font-medium">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                      <th className="px-4 py-3 text-center font-medium">{lang === "ar" ? "الحالة" : "Status"}</th>
                      <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "الطريقة" : "Method"}</th>
                      <th className="px-4 py-3 text-start font-medium">{lang === "ar" ? "الفاتورة" : "Invoice"}</th>
                      <th className="px-4 py-3 text-center font-medium">{lang === "ar" ? "إجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((entry: any) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lang === "ar" ? entry.buildingNameAr || entry.buildingName || "—" : entry.buildingName || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{entry.unitNumber || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium">{entry.guestName || "—"}</span>
                            {entry.guestPhone && <span className="text-xs text-muted-foreground">{entry.guestPhone}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">
                            {lang === "ar" ? TYPE_LABELS[entry.type]?.ar || entry.type : TYPE_LABELS[entry.type]?.en || entry.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-end font-mono font-semibold">
                          {parseFloat(entry.amount).toLocaleString()} <span className="text-xs text-muted-foreground">{entry.currency}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[entry.status] || "bg-gray-100 text-gray-800"}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {lang === "ar" ? METHOD_LABELS[entry.paymentMethod]?.ar || entry.paymentMethod || "—" : METHOD_LABELS[entry.paymentMethod]?.en || entry.paymentMethod || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{entry.invoiceNumber}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailId(entry.id)} title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNotesDialog({ open: true, entry })} title="Notes">
                              <StickyNote className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? `صفحة ${page + 1} من ${totalPages}` : `Page ${page + 1} of ${totalPages}`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <Footer />

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تفاصيل السجل" : "Entry Details"}</DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-6 w-1/2" /></div>
          ) : detailQuery.data ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">{lang === "ar" ? "الفاتورة:" : "Invoice:"}</span></div>
                <div className="font-mono">{detailQuery.data.invoiceNumber}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "النوع:" : "Type:"}</span></div>
                <div>{detailQuery.data.type}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "المبلغ:" : "Amount:"}</span></div>
                <div className="font-semibold">{parseFloat(detailQuery.data.amount).toLocaleString()} {detailQuery.data.currency}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "الحالة:" : "Status:"}</span></div>
                <div><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[detailQuery.data.status]}`}>{detailQuery.data.status}</span></div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "العميل:" : "Customer:"}</span></div>
                <div>{detailQuery.data.guestName || "—"}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "الهاتف:" : "Phone:"}</span></div>
                <div>{detailQuery.data.guestPhone || "—"}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "المبنى:" : "Building:"}</span></div>
                <div>{detailQuery.data.buildingName || "—"}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "الوحدة:" : "Unit:"}</span></div>
                <div>{detailQuery.data.unitNumber || "—"}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "الحجز:" : "Booking:"}</span></div>
                <div>{detailQuery.data.bookingId || "—"}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "طريقة الدفع:" : "Method:"}</span></div>
                <div>{detailQuery.data.paymentMethod || "—"}</div>
                <div><span className="text-muted-foreground">{lang === "ar" ? "المزود:" : "Provider:"}</span></div>
                <div>{detailQuery.data.provider || "—"}</div>
                {detailQuery.data.notes && <>
                  <div><span className="text-muted-foreground">{lang === "ar" ? "ملاحظات:" : "Notes:"}</span></div>
                  <div>{detailQuery.data.notes}</div>
                </>}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialog.open} onOpenChange={(o) => setNotesDialog({ open: o, entry: o ? notesDialog.entry : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "ملاحظات" : "Notes"}</DialogTitle>
            <DialogDescription>{notesDialog.entry?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>{notesDialog.entry?.notes || (lang === "ar" ? "لا توجد ملاحظات" : "No notes")}</p>
            {notesDialog.entry?.notesAr && <p className="text-muted-foreground">{notesDialog.entry.notesAr}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
