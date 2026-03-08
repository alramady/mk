import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarCheck, Search, CheckCircle, XCircle, BanknoteIcon, Clock, Filter, FileText, AlertTriangle, CreditCard, ShieldAlert, MessageCircle, RotateCcw, Calculator, DollarSign, ArrowRight, Download } from "lucide-react";
import { SendWhatsAppDialog } from "./AdminWhatsApp";
import { exportToExcel, BOOKING_COLUMNS } from "@/lib/exportToExcel";

const STATUS_MAP: Record<string, { label: string; labelAr: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending Approval", labelAr: "بانتظار الموافقة", variant: "secondary" },
  approved: { label: "Approved – Pending Payment", labelAr: "موافق – بانتظار الدفع", variant: "outline" },
  rejected: { label: "Rejected", labelAr: "مرفوض", variant: "destructive" },
  active: { label: "Active (Paid)", labelAr: "نشط (مدفوع)", variant: "default" },
  completed: { label: "Completed", labelAr: "مكتمل", variant: "secondary" },
  cancelled: { label: "Cancelled", labelAr: "ملغي", variant: "destructive" },
};

const LEDGER_STATUS_MAP: Record<string, { label: string; labelAr: string; color: string }> = {
  DUE: { label: "Due", labelAr: "مستحق", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  PENDING: { label: "Pending", labelAr: "قيد المعالجة", color: "text-blue-600 bg-blue-50 border-blue-200" },
  PAID: { label: "Paid", labelAr: "مدفوع", color: "text-green-600 bg-green-50 border-green-200" },
  VOID: { label: "Void", labelAr: "ملغي", color: "text-red-600 bg-red-50 border-red-200" },
  FAILED: { label: "Failed", labelAr: "فشل", color: "text-red-600 bg-red-50 border-red-200" },
  REFUNDED: { label: "Refunded", labelAr: "مسترد", color: "text-purple-600 bg-purple-50 border-purple-200" },
};

export default function AdminBookings() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [reopenDialog, setReopenDialog] = useState<{ open: boolean; bookingId: number | null; currentStatus: string }>({ open: false, bookingId: null, currentStatus: "" });
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [rejectReason, setRejectReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overridePaymentMethod, setOverridePaymentMethod] = useState<string>("cash");
  const [reopenTarget, setReopenTarget] = useState<"pending" | "approved">("pending");
  const [reopenNotes, setReopenNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("bank_transfer");
  const [refundCancelBooking, setRefundCancelBooking] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const bookings = trpc.admin.bookings.useQuery({ limit: 200 });
  const overrideEnabled = trpc.admin.isOverrideEnabled.useQuery();

  // Refund calculator query — only fetches when refund dialog is open
  const refundCalc = trpc.admin.calculateRefund.useQuery(
    { bookingId: refundDialog.bookingId! },
    { enabled: refundDialog.open && refundDialog.bookingId !== null }
  );

  const approveBooking = trpc.admin.approveBooking.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تم قبول الحجز وإرسال الفاتورة للمستأجر" : "Booking approved, invoice sent");
      utils.admin.bookings.invalidate();
      setApproveDialog({ open: false, bookingId: null });
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectBooking = trpc.admin.rejectBooking.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تم رفض الحجز وإلغاء الفاتورة" : "Booking rejected, ledger voided");
      utils.admin.bookings.invalidate();
      setRejectDialog({ open: false, bookingId: null });
      setRejectReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmPayment = trpc.admin.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "⚠️ تم تأكيد الدفع يدوياً - مسجل في سجل المراجعة" : "⚠️ Manual override logged to audit trail");
      utils.admin.bookings.invalidate();
      setConfirmDialog({ open: false, bookingId: null });
      setOverrideReason("");
      setOverridePaymentMethod("cash");
    },
    onError: (e) => toast.error(e.message),
  });

  const reopenBooking = trpc.admin.reopenBooking.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تم إعادة فتح الحجز بنجاح" : "Booking reopened successfully");
      utils.admin.bookings.invalidate();
      setReopenDialog({ open: false, bookingId: null, currentStatus: "" });
      setReopenNotes("");
      setReopenTarget("pending");
    },
    onError: (e) => toast.error(e.message),
  });

  const recordRefund = trpc.admin.recordRefund.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تم تسجيل الاسترداد بنجاح — قم بتحويل المبلغ يدوياً" : "Refund recorded — process the actual transfer manually");
      utils.admin.bookings.invalidate();
      setRefundDialog({ open: false, bookingId: null });
      setRefundAmount("");
      setRefundReason("");
      setRefundMethod("bank_transfer");
      setRefundCancelBooking(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (bookings.data ?? []).filter((b: any) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const match = [b.id?.toString(), b.propertyId?.toString(), b.beds24BookingId, b.source,
        ...(b.ledgerEntries || []).map((l: any) => l.invoiceNumber)]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(s));
      if (!match) return false;
    }
    return true;
  });

  const counts = {
    all: bookings.data?.length ?? 0,
    pending: bookings.data?.filter((b: any) => b.status === "pending").length ?? 0,
    approved: bookings.data?.filter((b: any) => b.status === "approved").length ?? 0,
    active: bookings.data?.filter((b: any) => b.status === "active").length ?? 0,
  };

  const paymentConfigured = (bookings.data as any)?.[0]?.paymentConfigured ?? false;
  const isOverrideOn = overrideEnabled.data?.enabled ?? false;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isAr ? "الحجوزات" : "Bookings"}</h1>
            <p className="text-muted-foreground text-sm mt-1">{isAr ? "إدارة جميع الحجوزات ومتابعة حالتها" : "Manage all bookings and track their status"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${paymentConfigured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              <CreditCard className="h-3.5 w-3.5" />
              {paymentConfigured
                ? (isAr ? "الدفع الإلكتروني مفعّل" : "Online Payment Active")
                : (isAr ? "الدفع الإلكتروني غير مفعّل" : "Online Payment Not Configured")}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${isOverrideOn ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              <ShieldAlert className="h-3.5 w-3.5" />
              {isOverrideOn
                ? (isAr ? "التأكيد اليدوي مفعّل" : "Manual Override ON")
                : (isAr ? "التأكيد اليدوي معطّل" : "Manual Override OFF")}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 hover:bg-primary/10 text-primary"
            disabled={!filtered?.length}
            onClick={() => {
              if (!filtered?.length) return;
              const totalRevenue = filtered.reduce((sum: number, b: any) => sum + Number(b.totalAmount || b.monthlyRent || 0), 0);
              exportToExcel({
                data: filtered,
                columns: BOOKING_COLUMNS,
                sheetName: isAr ? "الحجوزات" : "Bookings",
                fileName: isAr ? "تقرير_الحجوزات" : "Bookings_Report",
                lang,
                title: isAr ? "تقرير الحجوزات - المفتاح الشهري" : "Bookings Report - Monthly Key",
                summaryRows: [
                  { label: isAr ? "إجمالي الحجوزات" : "Total Bookings", value: filtered.length },
                  { label: isAr ? "إجمالي الإيرادات (ر.س)" : "Total Revenue (SAR)", value: totalRevenue.toLocaleString() },
                ],
              });
              toast.success(isAr ? "تم تصدير التقرير بنجاح" : "Report exported successfully");
            }}
          >
            <Download className="h-4 w-4" />
            {isAr ? "تصدير Excel" : "Export Excel"}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("all")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{counts.all}</p>
                  <p className="text-xs text-muted-foreground">{isAr ? "إجمالي" : "Total"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-yellow-500/50 transition-colors" onClick={() => setStatusFilter("pending")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{counts.pending}</p>
                  <p className="text-xs text-muted-foreground">{isAr ? "بانتظار الموافقة" : "Pending"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setStatusFilter("approved")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BanknoteIcon className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{counts.approved}</p>
                  <p className="text-xs text-muted-foreground">{isAr ? "بانتظار الدفع" : "Awaiting Pay"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setStatusFilter("active")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{counts.active}</p>
                  <p className="text-xs text-muted-foreground">{isAr ? "نشط" : "Active"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isAr ? "بحث برقم الحجز أو الفاتورة..." : "Search by booking or invoice #"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 me-2" />
              <SelectValue placeholder={isAr ? "تصفية الحالة" : "Filter Status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? "الكل" : "All"} ({counts.all})</SelectItem>
              <SelectItem value="pending">{isAr ? "بانتظار الموافقة" : "Pending"} ({counts.pending})</SelectItem>
              <SelectItem value="approved">{isAr ? "بانتظار الدفع" : "Awaiting Pay"} ({counts.approved})</SelectItem>
              <SelectItem value="active">{isAr ? "نشط" : "Active"} ({counts.active})</SelectItem>
              <SelectItem value="completed">{isAr ? "مكتمل" : "Completed"}</SelectItem>
              <SelectItem value="rejected">{isAr ? "مرفوض" : "Rejected"}</SelectItem>
              <SelectItem value="cancelled">{isAr ? "ملغي" : "Cancelled"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bookings Table */}
        {bookings.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{isAr ? "جارٍ التحميل..." : "Loading..."}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {isAr ? `لا توجد حجوزات ${statusFilter !== "all" ? "بهذه الحالة" : ""}` : `No bookings ${statusFilter !== "all" ? "with this status" : ""}`}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-start p-3 font-medium">#</th>
                    <th className="text-start p-3 font-medium">{isAr ? "العقار" : "Property"}</th>
                    <th className="text-start p-3 font-medium">{isAr ? "المستأجر" : "Tenant"}</th>
                    <th className="text-start p-3 font-medium">{isAr ? "المدة" : "Duration"}</th>
                    <th className="text-start p-3 font-medium">{isAr ? "المبلغ" : "Amount"}</th>
                    <th className="text-start p-3 font-medium">{isAr ? "الفاتورة" : "Invoice"}</th>
                    <th className="text-start p-3 font-medium">{isAr ? "حالة السجل" : "Ledger"}</th>
                    <th className="text-start p-3 font-medium">{isAr ? "الحالة" : "Status"}</th>
                    <th className="text-start p-3 font-medium">{isAr ? "الإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((b: any) => {
                    const status = STATUS_MAP[b.status] || STATUS_MAP.pending;
                    const ledger = b.ledgerEntries?.[0];
                    const ledgerStatus = ledger ? (LEDGER_STATUS_MAP[ledger.status] || LEDGER_STATUS_MAP.DUE) : null;
                    const isExpanded = expandedRow === b.id;
                    const hasPaidEntries = b.ledgerEntries?.some((e: any) => e.status === "PAID" && e.direction === "IN");
                    return (
                      <>
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedRow(isExpanded ? null : b.id)}>
                          <td className="p-3 font-mono text-xs">{b.id}</td>
                          <td className="p-3">
                            <div className="font-medium">{isAr ? "عقار" : "Property"} #{b.propertyId}</div>
                            {b.unitId && <div className="text-xs text-muted-foreground">{isAr ? "وحدة" : "Unit"} #{b.unitId}</div>}
                          </td>
                          <td className="p-3 text-xs">#{b.tenantId}</td>
                          <td className="p-3 text-xs">{b.durationMonths} {isAr ? "شهر" : "mo"}</td>
                          <td className="p-3 font-medium text-xs">{Number(b.totalAmount || b.monthlyRent).toLocaleString()} {isAr ? "ر.س" : "SAR"}</td>
                          <td className="p-3">
                            {ledger ? (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-xs">{ledger.invoiceNumber}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            {ledgerStatus ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ledgerStatus.color}`}>
                                {isAr ? ledgerStatus.labelAr : ledgerStatus.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge variant={status.variant} className="text-xs whitespace-nowrap">{isAr ? status.labelAr : status.label}</Badge>
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1.5 flex-wrap">
                              {/* Pending: Approve + Reject */}
                              {b.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => setApproveDialog({ open: true, bookingId: b.id })}
                                  >
                                    <CheckCircle className="h-3 w-3 me-1" />
                                    {isAr ? "قبول" : "Approve"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => setRejectDialog({ open: true, bookingId: b.id })}
                                  >
                                    <XCircle className="h-3 w-3 me-1" />
                                    {isAr ? "رفض" : "Reject"}
                                  </Button>
                                </>
                              )}
                              {/* Approved: Manual Override */}
                              {b.status === "approved" && isOverrideOn && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                  onClick={() => setConfirmDialog({ open: true, bookingId: b.id })}
                                >
                                  <ShieldAlert className="h-3 w-3 me-1" />
                                  {isAr ? "تأكيد يدوي" : "Manual Override"}
                                </Button>
                              )}
                              {b.status === "approved" && !isOverrideOn && (
                                <span className="text-xs text-muted-foreground italic">{isAr ? "ينتظر الدفع الإلكتروني" : "Awaiting online payment"}</span>
                              )}
                              {/* Rejected / Cancelled: Reopen */}
                              {["rejected", "cancelled"].includes(b.status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                  onClick={() => setReopenDialog({ open: true, bookingId: b.id, currentStatus: b.status })}
                                >
                                  <RotateCcw className="h-3 w-3 me-1" />
                                  {isAr ? "إعادة فتح" : "Reopen"}
                                </Button>
                              )}
                              {/* Active / Completed / Approved with paid entries: Refund */}
                              {(["active", "completed"].includes(b.status) || (b.status === "approved" && hasPaidEntries)) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                                  onClick={() => {
                                    setRefundDialog({ open: true, bookingId: b.id });
                                    setRefundAmount("");
                                    setRefundReason("");
                                    setRefundCancelBooking(false);
                                  }}
                                >
                                  <DollarSign className="h-3 w-3 me-1" />
                                  {isAr ? "استرداد" : "Refund"}
                                </Button>
                              )}
                              {/* WhatsApp */}
                              <SendWhatsAppDialog
                                trigger={
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:bg-green-50">
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </Button>
                                }
                                defaultPhone={b.tenantPhone || b.phone || ""}
                                defaultName={b.tenantName || ""}
                                defaultBookingId={b.id}
                                defaultPropertyId={b.propertyId}
                              />
                            </div>
                          </td>
                        </tr>
                        {/* Expanded Row: Ledger Details */}
                        {isExpanded && (
                          <tr key={`${b.id}-detail`} className="bg-muted/20">
                            <td colSpan={9} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Booking Details */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">{isAr ? "تفاصيل الحجز" : "Booking Details"}</h4>
                                  <div className="text-xs space-y-1">
                                    <div><span className="text-muted-foreground">{isAr ? "تاريخ الدخول:" : "Move-in:"}</span> {b.moveInDate ? new Date(b.moveInDate).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "-"}</div>
                                    <div><span className="text-muted-foreground">{isAr ? "تاريخ الخروج:" : "Move-out:"}</span> {b.moveOutDate ? new Date(b.moveOutDate).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "-"}</div>
                                    <div><span className="text-muted-foreground">{isAr ? "الإيجار الشهري:" : "Monthly Rent:"}</span> {Number(b.monthlyRent).toLocaleString()} {isAr ? "ر.س" : "SAR"}</div>
                                    <div><span className="text-muted-foreground">{isAr ? "المبلغ الإجمالي:" : "Total Amount:"}</span> {Number(b.totalAmount).toLocaleString()} ر.س</div>
                                    <div><span className="text-muted-foreground">{isAr ? "المصدر:" : "Source:"}</span> {b.source === "BEDS24" ? "Beds24" : isAr ? "محلي" : "Local"}</div>
                                    {b.rejectionReason && (
                                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                                        <span className="font-medium">{isAr ? "سبب الرفض:" : "Rejection Reason:"}</span> {b.rejectionReason}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Ledger Details */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">{isAr ? "السجل المالي" : "Payment Ledger"}</h4>
                                  {b.ledgerEntries?.length > 0 ? (
                                    <div className="space-y-2">
                                      {b.ledgerEntries.map((le: any) => {
                                        const ls = LEDGER_STATUS_MAP[le.status] || LEDGER_STATUS_MAP.DUE;
                                        return (
                                          <div key={le.id} className="text-xs p-2 border rounded space-y-1">
                                            <div className="flex items-center justify-between">
                                              <span className="font-mono font-medium">{le.invoiceNumber}</span>
                                              <span className={`px-2 py-0.5 rounded-full border text-xs ${ls.color}`}>{isAr ? ls.labelAr : ls.label}</span>
                                            </div>
                                            <div><span className="text-muted-foreground">{isAr ? "المبلغ:" : "Amount:"}</span> {Number(le.amount).toLocaleString()} {le.currency}</div>
                                            <div><span className="text-muted-foreground">{isAr ? "النوع:" : "Type:"}</span> {le.type}{le.type === "REFUND" ? (isAr ? " ↩ استرداد" : " ↩ Refund") : ""}</div>
                                            {le.provider && <div><span className="text-muted-foreground">{isAr ? "المزود:" : "Provider:"}</span> {le.provider === 'manual_override' ? isAr ? '⚠️ تأكيد يدوي' : '⚠️ Manual override' : le.provider === 'manual' ? isAr ? '📝 يدوي' : '📝 Manual' : le.provider}</div>}
                                            {le.paidAt && <div><span className="text-muted-foreground">{isAr ? "تاريخ الدفع:" : "Paid At:"}</span> {new Date(le.paidAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}</div>}
                                            {le.paymentMethod && <div><span className="text-muted-foreground">{isAr ? "طريقة الدفع:" : "Payment Method:"}</span> {le.paymentMethod}</div>}
                                            {le.webhookVerified !== undefined && (
                                              <div>
                                                <span className="text-muted-foreground">{isAr ? "تحقق الويب هوك:" : "Webhook Verified:"}</span>{" "}
                                                {le.webhookVerified ? <span className="text-green-600">{isAr ? "نعم ✓" : "Yes ✓"}</span> : <span className="text-amber-600">{isAr ? "لا (يدوي)" : "No (manual)"}</span>}
                                              </div>
                                            )}
                                            {le.notes && le.notes.includes("REFUND") && (
                                              <div className="mt-1 p-1.5 bg-purple-50 border border-purple-200 rounded text-purple-700 text-xs">
                                                {le.notes}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">{isAr ? "لا توجد سجلات مالية" : "No ledger entries"}</p>
                                  )}
                                  {b.status === "approved" && !b.paymentConfigured && (
                                    <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs">
                                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="font-medium">{isAr ? "الدفع الإلكتروني غير مفعّل" : "Online payment not configured"}</p>
                                        <p>Online payment not configured — manual override required</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onOpenChange={(o) => !o && setApproveDialog({ open: false, bookingId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? `تأكيد قبول الحجز #${approveDialog.bookingId}` : `Approve Booking #${approveDialog.bookingId}`}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isAr ? 'سيتم تغيير حالة الحجز إلى "بانتظار الدفع" وإرسال إشعار للمستأجر.' : "Booking status will change to Awaiting Payment and tenant will be notified."}
            <br />
            Booking status will change to "Approved – Pending Payment" and tenant will be notified.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog({ open: false, bookingId: null })}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => approveDialog.bookingId && approveBooking.mutate({ id: approveDialog.bookingId })}
              disabled={approveBooking.isPending}
            >
              {approveBooking.isPending ? isAr ? "جارٍ..." : "Processing..." : isAr ? "قبول الحجز" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => { if (!o) { setRejectDialog({ open: false, bookingId: null }); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? `رفض الحجز #${rejectDialog.bookingId}` : `Reject Booking #${rejectDialog.bookingId}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isAr ? "سيتم رفض الحجز وإلغاء الفاتورة المرتبطة (VOID). يجب كتابة سبب الرفض." : "Booking will be rejected and linked invoice voided. A reason is required."}
              <br />
              Booking will be rejected and linked ledger entries will be voided. Reason is required.
            </p>
            <Textarea
              placeholder={isAr ? "سبب الرفض (مطلوب)..." : "Rejection reason (required)..."}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="border-red-200 focus:border-red-400"
            />
            {rejectReason.length === 0 && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {isAr ? "سبب الرفض مطلوب" : "Reason is required"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false, bookingId: null }); setRejectReason(""); }}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button
              variant="destructive"
              onClick={() => rejectDialog.bookingId && rejectBooking.mutate({ id: rejectDialog.bookingId, rejectionReason: rejectReason })}
              disabled={rejectBooking.isPending || rejectReason.trim().length === 0}
            >
              {rejectBooking.isPending ? "جارٍ..." : isAr ? "رفض الحجز" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Override Confirm Payment Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => { if (!o) { setConfirmDialog({ open: false, bookingId: null }); setOverrideReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
              {isAr ? "تأكيد دفع يدوي (طوارئ)" : "Manual Payment Override"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="text-xs text-red-700 space-y-1">
                  <p className="font-semibold">{isAr ? "تحذير: هذا الإجراء يتجاوز بوابة الدفع الإلكتروني" : "Warning: This action bypasses the payment gateway"}</p>
                  <p>Warning: This action bypasses the payment gateway (Moyasar webhook).</p>
                  <ul className="list-disc ps-4 space-y-0.5 mt-1">
                    <li>{isAr ? "سيتم تسجيل هذا الإجراء في سجل المراجعة" : "This action will be logged in the Audit Log"}</li>
                    <li>{isAr ? "يتطلب صلاحية" : "Requires permission"} <code className="bg-red-100 px-1 rounded">manage_payments_override</code></li>
                    <li>{isAr ? "يجب كتابة سبب التأكيد اليدوي (10 أحرف على الأقل)" : "Override reason required (min 10 characters)"}</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {isAr ? `الحجز #${confirmDialog.bookingId} — سيتم تفعيله وتحديث السجل المالي إلى "مدفوع" مع تسجيل التجاوز.` : `Booking #${confirmDialog.bookingId} — will be activated and ledger marked as paid with override logged.`}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{isAr ? "طريقة الدفع" : "Payment Method"}</label>
              <Select value={overridePaymentMethod} onValueChange={setOverridePaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{isAr ? "نقدي" : "Cash"}</SelectItem>
                  <SelectItem value="bank_transfer">{isAr ? "تحويل بنكي" : "Bank Transfer"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{isAr ? "سبب التأكيد اليدوي (مطلوب)" : "Override Reason (required)"}</label>
              <Textarea
                placeholder={isAr ? "مثال: تم استلام تحويل بنكي مباشر - رقم العملية: ..." : "e.g.: Direct bank transfer received - transaction #: ..."}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                className="border-amber-200 focus:border-amber-400"
              />
              {overrideReason.length > 0 && overrideReason.length < 10 && (
                <p className="text-xs text-amber-600">{isAr ? "يجب أن يكون السبب 10 أحرف على الأقل" : "Reason must be at least 10 characters"} ({overrideReason.length}/10)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog({ open: false, bookingId: null }); setOverrideReason(""); }}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => confirmDialog.bookingId && confirmPayment.mutate({
                bookingId: confirmDialog.bookingId,
                reason: overrideReason,
                paymentMethod: overridePaymentMethod as any,
              })}
              disabled={confirmPayment.isPending || overrideReason.trim().length < 10}
            >
              <ShieldAlert className="h-4 w-4 me-1" />
              {confirmPayment.isPending ? "جارٍ..." : isAr ? "تأكيد يدوي (مسجّل)" : "Override & Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Booking Dialog */}
      <Dialog open={reopenDialog.open} onOpenChange={(o) => { if (!o) { setReopenDialog({ open: false, bookingId: null, currentStatus: "" }); setReopenNotes(""); setReopenTarget("pending"); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <RotateCcw className="h-5 w-5" />
              {isAr ? `إعادة فتح الحجز #${reopenDialog.bookingId}` : `Reopen Booking #${reopenDialog.bookingId}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="destructive" className="text-xs">{isAr ? (reopenDialog.currentStatus === "rejected" ? "مرفوض" : "ملغي") : reopenDialog.currentStatus}</Badge>
                <ArrowRight className="h-4 w-4 text-blue-500" />
                <Badge variant={reopenTarget === "approved" ? "outline" : "secondary"} className="text-xs">
                  {reopenTarget === "approved" ? (isAr ? "موافق – بانتظار الدفع" : "Approved") : (isAr ? "بانتظار الموافقة" : "Pending")}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{isAr ? "الحالة الجديدة" : "New Status"}</label>
              <Select value={reopenTarget} onValueChange={(v) => setReopenTarget(v as "pending" | "approved")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{isAr ? "بانتظار الموافقة (مراجعة)" : "Pending (review again)"}</SelectItem>
                  <SelectItem value="approved">{isAr ? "موافق مباشرة (بانتظار الدفع)" : "Approved (awaiting payment)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{isAr ? "ملاحظات المسؤول (اختياري)" : "Admin Notes (optional)"}</label>
              <Textarea
                placeholder={isAr ? "سبب إعادة الفتح..." : "Reason for reopening..."}
                value={reopenNotes}
                onChange={(e) => setReopenNotes(e.target.value)}
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "سيتم استعادة السجلات المالية الملغاة (VOID → DUE) وإشعار المستأجر."
                : "Voided ledger entries will be restored (VOID → DUE) and tenant will be notified."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReopenDialog({ open: false, bookingId: null, currentStatus: "" }); setReopenNotes(""); }}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => reopenDialog.bookingId && reopenBooking.mutate({
                id: reopenDialog.bookingId,
                targetStatus: reopenTarget,
                adminNotes: reopenNotes || undefined,
              })}
              disabled={reopenBooking.isPending}
            >
              <RotateCcw className="h-4 w-4 me-1" />
              {reopenBooking.isPending ? (isAr ? "جارٍ..." : "Processing...") : isAr ? "إعادة فتح" : "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Calculator + Record Dialog */}
      <Dialog open={refundDialog.open} onOpenChange={(o) => { if (!o) { setRefundDialog({ open: false, bookingId: null }); setRefundAmount(""); setRefundReason(""); setRefundCancelBooking(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Calculator className="h-5 w-5" />
              {isAr ? `حاسبة الاسترداد — الحجز #${refundDialog.bookingId}` : `Refund Calculator — Booking #${refundDialog.bookingId}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Refund Calculation Summary */}
            {refundCalc.isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">{isAr ? "جارٍ حساب الاسترداد..." : "Calculating refund..."}</div>
            ) : refundCalc.error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{refundCalc.error.message}</div>
            ) : refundCalc.data ? (
              <div className="space-y-3">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-green-50 border border-green-200 rounded text-center">
                    <p className="text-xs text-green-600 font-medium">{isAr ? "إجمالي المدفوع" : "Total Paid"}</p>
                    <p className="text-lg font-bold text-green-700">{refundCalc.data.totalPaid.toLocaleString()} {refundCalc.data.currency}</p>
                  </div>
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded text-center">
                    <p className="text-xs text-purple-600 font-medium">{isAr ? "أقصى مبلغ قابل للاسترداد" : "Max Refundable"}</p>
                    <p className="text-lg font-bold text-purple-700">{refundCalc.data.maxRefundable.toLocaleString()} {refundCalc.data.currency}</p>
                  </div>
                </div>
                {/* Prorated Breakdown */}
                <div className="p-3 bg-muted/50 border rounded space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "إجمالي الأيام:" : "Total Days:"}</span><span className="font-medium">{refundCalc.data.totalDays}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الأيام المستخدمة:" : "Days Used:"}</span><span className="font-medium">{refundCalc.data.daysUsed}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الأيام المتبقية:" : "Days Remaining:"}</span><span className="font-medium text-blue-600">{refundCalc.data.daysRemaining}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "السعر اليومي:" : "Daily Rate:"}</span><span className="font-medium">{refundCalc.data.dailyRate.toLocaleString()} {refundCalc.data.currency}</span></div>
                  <div className="border-t pt-1.5 flex justify-between">
                    <span className="text-muted-foreground font-medium">{isAr ? "الاسترداد النسبي المقترح:" : "Prorated Refund:"}</span>
                    <span className="font-bold text-purple-600">{refundCalc.data.proratedRefund.toLocaleString()} {refundCalc.data.currency}</span>
                  </div>
                </div>
                {refundCalc.data.totalRefunded > 0 && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                    {isAr ? `تم استرداد ${refundCalc.data.totalRefunded.toLocaleString()} ${refundCalc.data.currency} مسبقاً` : `Already refunded: ${refundCalc.data.totalRefunded.toLocaleString()} ${refundCalc.data.currency}`}
                  </div>
                )}
                {/* Use prorated amount button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-purple-600 border-purple-200"
                  onClick={() => setRefundAmount(String(refundCalc.data!.proratedRefund))}
                >
                  <Calculator className="h-3 w-3 me-1" />
                  {isAr ? `استخدام المبلغ النسبي: ${refundCalc.data.proratedRefund.toLocaleString()} ${refundCalc.data.currency}` : `Use prorated amount: ${refundCalc.data.proratedRefund.toLocaleString()} ${refundCalc.data.currency}`}
                </Button>
              </div>
            ) : null}

            {/* Manual Refund Form */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold">{isAr ? "تسجيل الاسترداد (يدوي)" : "Record Refund (Manual)"}</h4>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                <AlertTriangle className="h-3 w-3 inline me-1" />
                {isAr
                  ? "هذا يسجل الاسترداد في النظام فقط. يجب تحويل المبلغ يدوياً عبر البنك أو نقداً."
                  : "This only records the refund in the system. You must transfer the money manually via bank or cash."}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{isAr ? "مبلغ الاسترداد" : "Refund Amount"} ({refundCalc.data?.currency || "SAR"})</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={refundCalc.data?.maxRefundable || 999999}
                  placeholder={isAr ? "أدخل المبلغ..." : "Enter amount..."}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="border-purple-200 focus:border-purple-400"
                />
                {refundAmount && refundCalc.data && Number(refundAmount) > refundCalc.data.maxRefundable && (
                  <p className="text-xs text-red-500">{isAr ? `المبلغ يتجاوز الحد الأقصى (${refundCalc.data.maxRefundable})` : `Amount exceeds max refundable (${refundCalc.data.maxRefundable})`}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{isAr ? "سبب الاسترداد (مطلوب)" : "Refund Reason (required)"}</label>
                <Textarea
                  placeholder={isAr ? "مثال: طلب المستأجر إلغاء مبكر..." : "e.g.: Tenant requested early cancellation..."}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  className="border-purple-200 focus:border-purple-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{isAr ? "طريقة الاسترداد" : "Refund Method"}</label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">{isAr ? "تحويل بنكي" : "Bank Transfer"}</SelectItem>
                    <SelectItem value="cash">{isAr ? "نقدي" : "Cash"}</SelectItem>
                    <SelectItem value="original_payment_method">{isAr ? "نفس طريقة الدفع الأصلية" : "Original Payment Method"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cancelBooking"
                  checked={refundCancelBooking}
                  onChange={(e) => setRefundCancelBooking(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="cancelBooking" className="text-xs">
                  {isAr ? "إلغاء الحجز بعد الاسترداد" : "Cancel booking after refund"}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRefundDialog({ open: false, bookingId: null }); setRefundAmount(""); setRefundReason(""); }}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => refundDialog.bookingId && recordRefund.mutate({
                bookingId: refundDialog.bookingId,
                amount: Number(refundAmount),
                reason: refundReason,
                refundMethod: refundMethod as any,
                cancelBooking: refundCancelBooking,
              })}
              disabled={
                recordRefund.isPending ||
                !refundAmount ||
                Number(refundAmount) <= 0 ||
                refundReason.trim().length < 5 ||
                (refundCalc.data ? Number(refundAmount) > refundCalc.data.maxRefundable : false)
              }
            >
              <DollarSign className="h-4 w-4 me-1" />
              {recordRefund.isPending ? (isAr ? "جارٍ..." : "Processing...") : isAr ? "تسجيل الاسترداد" : "Record Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
