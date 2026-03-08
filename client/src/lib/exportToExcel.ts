import * as XLSX from "xlsx";

interface ExcelColumn {
  key: string;
  headerAr: string;
  headerEn: string;
  width?: number;
  format?: (value: any, row: any, lang: string) => string | number;
}

interface ExportOptions {
  data: any[];
  columns: ExcelColumn[];
  sheetName: string;
  fileName: string;
  lang: string;
  title?: string;
  summaryRows?: { label: string; value: string | number }[];
}

export function exportToExcel({
  data,
  columns,
  sheetName,
  fileName,
  lang,
  title,
  summaryRows,
}: ExportOptions) {
  const isAr = lang === "ar";
  const rows: any[][] = [];

  // Title row
  if (title) {
    rows.push([title]);
    rows.push([`${isAr ? "تاريخ التصدير" : "Export Date"}: ${new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`]);
    rows.push([]); // empty row
  }

  // Header row
  const headers = columns.map((col) => (isAr ? col.headerAr : col.headerEn));
  rows.push(headers);

  // Data rows
  data.forEach((item) => {
    const row = columns.map((col) => {
      if (col.format) {
        return col.format(item[col.key], item, lang);
      }
      return item[col.key] ?? "";
    });
    rows.push(row);
  });

  // Summary rows
  if (summaryRows && summaryRows.length > 0) {
    rows.push([]); // empty row
    summaryRows.forEach(({ label, value }) => {
      rows.push([label, value]);
    });
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = columns.map((col) => ({ wch: col.width || 18 }));

  // Merge title cells
  if (title) {
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
    ];
  }

  // Set RTL for Arabic
  if (isAr) {
    ws["!dir"] = "rtl";
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate and download
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}_${timestamp}.xlsx`);
}

// ─── Pre-built export configurations ────────────────────────────────

export const PAYMENT_COLUMNS: ExcelColumn[] = [
  { key: "id", headerAr: "رقم", headerEn: "ID", width: 8 },
  { key: "invoiceNumber", headerAr: "رقم الفاتورة", headerEn: "Invoice #", width: 18 },
  { key: "createdAt", headerAr: "التاريخ", headerEn: "Date", width: 14,
    format: (v, _, lang) => v ? new Date(v).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US") : "" },
  { key: "buildingName", headerAr: "المبنى", headerEn: "Building", width: 20,
    format: (_, row, lang) => lang === "ar" ? (row.buildingNameAr || row.buildingName || "") : (row.buildingName || "") },
  { key: "unitNumber", headerAr: "الوحدة", headerEn: "Unit", width: 10 },
  { key: "guestName", headerAr: "العميل", headerEn: "Customer", width: 22 },
  { key: "guestPhone", headerAr: "الهاتف", headerEn: "Phone", width: 16 },
  { key: "type", headerAr: "النوع", headerEn: "Type", width: 14,
    format: (v, _, lang) => {
      const types: Record<string, { ar: string; en: string }> = {
        RENT: { ar: "إيجار", en: "Rent" },
        RENEWAL_RENT: { ar: "تجديد", en: "Renewal" },
        PROTECTION_FEE: { ar: "رسوم حماية", en: "Protection Fee" },
        DEPOSIT: { ar: "تأمين", en: "Deposit" },
        CLEANING: { ar: "تنظيف", en: "Cleaning" },
        PENALTY: { ar: "غرامة", en: "Penalty" },
        REFUND: { ar: "استرداد", en: "Refund" },
      };
      return lang === "ar" ? (types[v]?.ar || v) : (types[v]?.en || v);
    }
  },
  { key: "amount", headerAr: "المبلغ (ر.س)", headerEn: "Amount (SAR)", width: 14,
    format: (v) => v ? parseFloat(v) : 0 },
  { key: "currency", headerAr: "العملة", headerEn: "Currency", width: 8 },
  { key: "status", headerAr: "الحالة", headerEn: "Status", width: 12,
    format: (v, _, lang) => {
      const statuses: Record<string, { ar: string; en: string }> = {
        DUE: { ar: "مستحق", en: "Due" },
        PENDING: { ar: "معلق", en: "Pending" },
        PAID: { ar: "مدفوع", en: "Paid" },
        FAILED: { ar: "فشل", en: "Failed" },
        REFUNDED: { ar: "مسترد", en: "Refunded" },
        VOID: { ar: "ملغي", en: "Void" },
      };
      return lang === "ar" ? (statuses[v]?.ar || v) : (statuses[v]?.en || v);
    }
  },
  { key: "paymentMethod", headerAr: "طريقة الدفع", headerEn: "Payment Method", width: 16,
    format: (v, _, lang) => {
      const methods: Record<string, { ar: string; en: string }> = {
        MADA_CARD: { ar: "بطاقة مدى", en: "Mada Card" },
        APPLE_PAY: { ar: "Apple Pay", en: "Apple Pay" },
        BANK_TRANSFER: { ar: "تحويل بنكي", en: "Bank Transfer" },
        CASH: { ar: "نقدي", en: "Cash" },
        CREDIT_CARD: { ar: "بطاقة ائتمان", en: "Credit Card" },
      };
      return lang === "ar" ? (methods[v]?.ar || v || "") : (methods[v]?.en || v || "");
    }
  },
  { key: "bookingId", headerAr: "رقم الحجز", headerEn: "Booking ID", width: 12 },
  { key: "notes", headerAr: "ملاحظات", headerEn: "Notes", width: 25,
    format: (_, row, lang) => lang === "ar" ? (row.notesAr || row.notes || "") : (row.notes || "") },
];

export const BOOKING_COLUMNS: ExcelColumn[] = [
  { key: "id", headerAr: "رقم الحجز", headerEn: "Booking ID", width: 12 },
  { key: "propertyId", headerAr: "رقم العقار", headerEn: "Property ID", width: 12 },
  { key: "unitId", headerAr: "رقم الوحدة", headerEn: "Unit ID", width: 12 },
  { key: "tenantId", headerAr: "رقم المستأجر", headerEn: "Tenant ID", width: 12 },
  { key: "status", headerAr: "الحالة", headerEn: "Status", width: 14,
    format: (v, _, lang) => {
      const statuses: Record<string, { ar: string; en: string }> = {
        pending: { ar: "بانتظار الموافقة", en: "Pending" },
        approved: { ar: "تمت الموافقة", en: "Approved" },
        active: { ar: "نشط", en: "Active" },
        completed: { ar: "مكتمل", en: "Completed" },
        cancelled: { ar: "ملغي", en: "Cancelled" },
        rejected: { ar: "مرفوض", en: "Rejected" },
      };
      return lang === "ar" ? (statuses[v]?.ar || v) : (statuses[v]?.en || v);
    }
  },
  { key: "durationMonths", headerAr: "المدة (أشهر)", headerEn: "Duration (Months)", width: 14 },
  { key: "monthlyRent", headerAr: "الإيجار الشهري (ر.س)", headerEn: "Monthly Rent (SAR)", width: 18,
    format: (v) => v ? Number(v) : 0 },
  { key: "totalAmount", headerAr: "المبلغ الإجمالي (ر.س)", headerEn: "Total Amount (SAR)", width: 18,
    format: (v, row) => v ? Number(v) : Number(row.monthlyRent || 0) },
  { key: "source", headerAr: "المصدر", headerEn: "Source", width: 12 },
  { key: "beds24BookingId", headerAr: "رقم Beds24", headerEn: "Beds24 ID", width: 14 },
  { key: "startDate", headerAr: "تاريخ البداية", headerEn: "Start Date", width: 14,
    format: (v) => v ? new Date(v).toLocaleDateString("en-US") : "" },
  { key: "endDate", headerAr: "تاريخ النهاية", headerEn: "End Date", width: 14,
    format: (v) => v ? new Date(v).toLocaleDateString("en-US") : "" },
  { key: "createdAt", headerAr: "تاريخ الإنشاء", headerEn: "Created At", width: 14,
    format: (v) => v ? new Date(v).toLocaleDateString("en-US") : "" },
];

export const ANALYTICS_REVENUE_COLUMNS: ExcelColumn[] = [
  { key: "month", headerAr: "الشهر", headerEn: "Month", width: 14 },
  { key: "revenue", headerAr: "الإيرادات (ر.س)", headerEn: "Revenue (SAR)", width: 18,
    format: (v) => v ? Number(v) : 0 },
];

export const ANALYTICS_BOOKINGS_COLUMNS: ExcelColumn[] = [
  { key: "month", headerAr: "الشهر", headerEn: "Month", width: 14 },
  { key: "count", headerAr: "عدد الحجوزات", headerEn: "Bookings Count", width: 16,
    format: (v) => v ? Number(v) : 0 },
];

export function exportMultiSheet(
  sheets: { name: string; data: any[]; columns: ExcelColumn[]; lang: string }[],
  fileName: string,
  lang: string,
  title?: string,
) {
  const isAr = lang === "ar";
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ name, data, columns }) => {
    const rows: any[][] = [];

    if (title) {
      rows.push([title]);
      rows.push([`${isAr ? "تاريخ التصدير" : "Export Date"}: ${new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })}`]);
      rows.push([]);
    }

    const headers = columns.map((col) => (isAr ? col.headerAr : col.headerEn));
    rows.push(headers);

    data.forEach((item) => {
      const row = columns.map((col) => {
        if (col.format) return col.format(item[col.key], item, lang);
        return item[col.key] ?? "";
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = columns.map((col) => ({ wch: col.width || 18 }));
    if (title) {
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
      ];
    }
    if (isAr) ws["!dir"] = "rtl";
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}_${timestamp}.xlsx`);
}
