import { getDb } from "./db";
import { bookings, properties, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

interface ContractData {
  contractNumber: string;
  date: string;
  dateHijri: string;
  // Landlord
  landlordName: string;
  landlordNameAr: string;
  landlordId: string;
  landlordPhone: string;
  landlordEmail: string;
  // Tenant
  tenantName: string;
  tenantNameAr: string;
  tenantId: string;
  tenantPhone: string;
  tenantEmail: string;
  // Property
  propertyTitle: string;
  propertyTitleAr: string;
  propertyType: string;
  propertyAddress: string;
  propertyAddressAr: string;
  city: string;
  cityAr: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  furnishedLevel: string;
  // Lease Terms
  startDate: string;
  endDate: string;
  durationMonths: number;
  monthlyRent: string;
  securityDeposit: string;
  serviceFee: string;
  totalAmount: string;
  // Rules
  houseRules: string;
  houseRulesAr: string;
  amenities: string[];
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPropertyTypeAr(type: string): string {
  const map: Record<string, string> = {
    apartment: "شقة",
    villa: "فيلا",
    studio: "استوديو",
    duplex: "دوبلكس",
    furnished_room: "غرفة مفروشة",
    compound: "كمباوند",
    hotel_apartment: "شقة فندقية",
  };
  return map[type] || type;
}

function getFurnishedLevelAr(level: string): string {
  const map: Record<string, string> = {
    unfurnished: "غير مفروشة",
    semi_furnished: "شبه مفروشة",
    fully_furnished: "مفروشة بالكامل",
  };
  return map[level] || level;
}

function getFurnishedLevelEn(level: string): string {
  const map: Record<string, string> = {
    unfurnished: "Unfurnished",
    semi_furnished: "Semi-Furnished",
    fully_furnished: "Fully Furnished",
  };
  return map[level] || level;
}

export async function generateLeaseContractHTML(bookingId: number): Promise<{ html: string; data: ContractData }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get booking with property and user details
  const bookingResult = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!bookingResult.length) throw new Error("Booking not found");
  const booking = bookingResult[0];

  const propertyResult = await db.select().from(properties).where(eq(properties.id, booking.propertyId)).limit(1);
  if (!propertyResult.length) throw new Error("Property not found");
  const property = propertyResult[0];

  const tenantResult = await db.select().from(users).where(eq(users.id, booking.tenantId)).limit(1);
  if (!tenantResult.length) throw new Error("Tenant not found");
  const tenant = tenantResult[0];

  const landlordResult = await db.select().from(users).where(eq(users.id, property.landlordId)).limit(1);
  if (!landlordResult.length) throw new Error("Landlord not found");
  const landlord = landlordResult[0];

  const now = new Date();
  const contractNumber = `IJAR-${now.getFullYear()}-${String(bookingId).padStart(6, "0")}`;

  const data: ContractData = {
    contractNumber,
    date: now.toLocaleDateString("en-GB"),
    dateHijri: now.toLocaleDateString("ar-SA-u-ca-islamic", { year: "numeric", month: "long", day: "numeric" }),
    landlordName: landlord.name || "N/A",
    landlordNameAr: (landlord as any).nameAr || landlord.name || "غير محدد",
    landlordId: landlord.userId || String(landlord.id),
    landlordPhone: (landlord as any).phone || "N/A",
    landlordEmail: landlord.email || "N/A",
    tenantName: tenant.name || "N/A",
    tenantNameAr: (tenant as any).nameAr || tenant.name || "غير محدد",
    tenantId: tenant.userId || String(tenant.id),
    tenantPhone: (tenant as any).phone || "N/A",
    tenantEmail: tenant.email || "N/A",
    propertyTitle: property.titleEn,
    propertyTitleAr: property.titleAr,
    propertyType: property.propertyType,
    propertyAddress: property.address || "N/A",
    propertyAddressAr: property.addressAr || "غير محدد",
    city: property.city || "N/A",
    cityAr: property.cityAr || "غير محدد",
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    sizeSqm: property.sizeSqm || 0,
    furnishedLevel: property.furnishedLevel || "unfurnished",
    startDate: booking.moveInDate ? new Date(booking.moveInDate).toLocaleDateString("en-GB") : "N/A",
    endDate: booking.moveOutDate ? new Date(booking.moveOutDate).toLocaleDateString("en-GB") : "N/A",
    durationMonths: booking.durationMonths,
    monthlyRent: String(booking.monthlyRent),
    securityDeposit: String(booking.securityDeposit || "0"),
    serviceFee: String(parseFloat(String(booking.totalAmount)) - (parseFloat(String(booking.monthlyRent)) * booking.durationMonths) - parseFloat(String(booking.securityDeposit || "0"))),
    totalAmount: String(booking.totalAmount),
    houseRules: property.houseRules || "Standard residential rules apply",
    houseRulesAr: property.houseRulesAr || "تطبق القوانين السكنية العادية",
    amenities: (property.amenities as string[]) || [],
  };

  const html = buildContractHTML(data);
  return { html, data };
}

function buildContractHTML(d: ContractData): string {
  const amenitiesAr: Record<string, string> = {
    wifi: "واي فاي", parking: "موقف سيارات", gym: "صالة رياضية", pool: "مسبح",
    security: "حراسة أمنية", elevator: "مصعد", ac: "تكييف", balcony: "شرفة",
    garden: "حديقة", laundry: "غسيل", room_service: "خدمة غرف", concierge: "استقبال",
    maid_room: "غرفة خادمة", driver_room: "غرفة سائق", playground: "ملعب أطفال",
    bbq: "شواء", sea_view: "إطلالة بحرية", mountain_view: "إطلالة جبلية",
    smart_home: "منزل ذكي", fireplace: "مدفأة", beach_access: "وصول للشاطئ",
    shared_kitchen: "مطبخ مشترك",
  };

  const amenitiesList = d.amenities.map(a => `${amenitiesAr[a] || a} / ${a}`).join(" • ");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>عقد إيجار - Lease Contract - ${d.contractNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Tajawal', sans-serif;
    background: #fff;
    color: #1a1a1a;
    font-size: 14px;
    line-height: 1.8;
    direction: rtl;
  }
  
  .contract {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
  }
  
  .header {
    text-align: center;
    border-bottom: 3px solid #166534;
    padding-bottom: 20px;
    margin-bottom: 30px;
  }
  
  .header h1 {
    font-size: 28px;
    color: #166534;
    font-weight: 800;
    margin-bottom: 4px;
  }
  
  .header h2 {
    font-size: 20px;
    color: #166534;
    font-weight: 500;
    direction: ltr;
  }
  
  .header .contract-number {
    margin-top: 12px;
    font-size: 16px;
    color: #666;
  }
  
  .header .platform-name {
    font-size: 13px;
    color: #888;
    margin-top: 4px;
  }
  
  .section {
    margin-bottom: 24px;
  }
  
  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: #166534;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 8px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .section-title .en {
    direction: ltr;
    font-size: 14px;
    color: #888;
    font-weight: 400;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
  }
  
  .info-item {
    display: flex;
    flex-direction: column;
  }
  
  .info-item .label {
    font-size: 12px;
    color: #888;
    font-weight: 500;
  }
  
  .info-item .value {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
  }
  
  .info-item .value-en {
    font-size: 12px;
    color: #666;
    direction: ltr;
    text-align: right;
  }
  
  .financial-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }
  
  .financial-table th,
  .financial-table td {
    padding: 10px 16px;
    text-align: right;
    border: 1px solid #e5e7eb;
  }
  
  .financial-table th {
    background: #f0fdf4;
    color: #166534;
    font-weight: 700;
    font-size: 13px;
  }
  
  .financial-table td {
    font-size: 14px;
  }
  
  .financial-table .total-row {
    background: #166534;
    color: white;
    font-weight: 700;
  }
  
  .financial-table .total-row td {
    border-color: #166534;
  }
  
  .terms-list {
    list-style: none;
    padding: 0;
    counter-reset: term;
  }
  
  .terms-list li {
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
    counter-increment: term;
    display: flex;
    gap: 8px;
  }
  
  .terms-list li::before {
    content: counter(term) ".";
    font-weight: 700;
    color: #166534;
    min-width: 24px;
  }
  
  .bilingual {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .bilingual .ar { font-weight: 500; }
  .bilingual .en { font-size: 12px; color: #666; direction: ltr; text-align: right; }
  
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 2px solid #e5e7eb;
  }
  
  .signature-box {
    text-align: center;
    padding: 20px;
    border: 1px dashed #d1d5db;
    border-radius: 8px;
  }
  
  .signature-box .role {
    font-size: 16px;
    font-weight: 700;
    color: #166534;
    margin-bottom: 4px;
  }
  
  .signature-box .role-en {
    font-size: 12px;
    color: #888;
    direction: ltr;
    margin-bottom: 12px;
  }
  
  .signature-box .name {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 30px;
  }
  
  .signature-box .line {
    border-top: 1px solid #1a1a1a;
    width: 80%;
    margin: 0 auto;
    padding-top: 8px;
    font-size: 12px;
    color: #888;
  }
  
  .footer {
    text-align: center;
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    font-size: 12px;
    color: #888;
  }
  
  .amenities-list {
    font-size: 13px;
    color: #444;
    line-height: 2;
  }
  
  .stamp {
    display: inline-block;
    border: 3px solid #166534;
    border-radius: 50%;
    width: 80px;
    height: 80px;
    line-height: 80px;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: #166534;
    margin: 20px auto;
    opacity: 0.6;
  }
  
  @media print {
    body { font-size: 12px; }
    .contract { padding: 20px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="contract">
  <!-- Header -->
  <div class="header">
    <h1>عقد إيجار شهري</h1>
    <h2>Monthly Lease Contract</h2>
    <div class="contract-number">
      رقم العقد: <strong>${d.contractNumber}</strong>
    </div>
    <div class="platform-name">
      منصة إيجار للإيجار الشهري | Ijar Monthly Rental Platform
    </div>
    <div style="margin-top:8px; font-size:13px; color:#666;">
      التاريخ: ${d.date} | ${d.dateHijri}
    </div>
  </div>

  <!-- Parties -->
  <div class="section">
    <div class="section-title">
      أطراف العقد
      <span class="en">Contract Parties</span>
    </div>
    
    <div style="margin-bottom:16px;">
      <div style="font-weight:700; color:#166534; margin-bottom:8px;">الطرف الأول (المؤجر) / First Party (Landlord)</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">الاسم / Name</span>
          <span class="value">${d.landlordNameAr}</span>
          <span class="value-en">${d.landlordName}</span>
        </div>
        <div class="info-item">
          <span class="label">معرف المستخدم / User ID</span>
          <span class="value">${d.landlordId}</span>
        </div>
        <div class="info-item">
          <span class="label">الهاتف / Phone</span>
          <span class="value" dir="ltr">${d.landlordPhone}</span>
        </div>
        <div class="info-item">
          <span class="label">البريد / Email</span>
          <span class="value" dir="ltr">${d.landlordEmail}</span>
        </div>
      </div>
    </div>
    
    <div>
      <div style="font-weight:700; color:#166534; margin-bottom:8px;">الطرف الثاني (المستأجر) / Second Party (Tenant)</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">الاسم / Name</span>
          <span class="value">${d.tenantNameAr}</span>
          <span class="value-en">${d.tenantName}</span>
        </div>
        <div class="info-item">
          <span class="label">معرف المستخدم / User ID</span>
          <span class="value">${d.tenantId}</span>
        </div>
        <div class="info-item">
          <span class="label">الهاتف / Phone</span>
          <span class="value" dir="ltr">${d.tenantPhone}</span>
        </div>
        <div class="info-item">
          <span class="label">البريد / Email</span>
          <span class="value" dir="ltr">${d.tenantEmail}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Property Details -->
  <div class="section">
    <div class="section-title">
      تفاصيل العقار
      <span class="en">Property Details</span>
    </div>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">اسم العقار / Property Name</span>
        <span class="value">${d.propertyTitleAr}</span>
        <span class="value-en">${d.propertyTitle}</span>
      </div>
      <div class="info-item">
        <span class="label">نوع العقار / Property Type</span>
        <span class="value">${getPropertyTypeAr(d.propertyType)} / ${d.propertyType}</span>
      </div>
      <div class="info-item">
        <span class="label">العنوان / Address</span>
        <span class="value">${d.propertyAddressAr}</span>
        <span class="value-en">${d.propertyAddress}</span>
      </div>
      <div class="info-item">
        <span class="label">المدينة / City</span>
        <span class="value">${d.cityAr} / ${d.city}</span>
      </div>
      <div class="info-item">
        <span class="label">غرف النوم / Bedrooms</span>
        <span class="value">${d.bedrooms}</span>
      </div>
      <div class="info-item">
        <span class="label">الحمامات / Bathrooms</span>
        <span class="value">${d.bathrooms}</span>
      </div>
      <div class="info-item">
        <span class="label">المساحة / Size</span>
        <span class="value">${d.sizeSqm} م² / sqm</span>
      </div>
      <div class="info-item">
        <span class="label">مستوى التأثيث / Furnished Level</span>
        <span class="value">${getFurnishedLevelAr(d.furnishedLevel)} / ${getFurnishedLevelEn(d.furnishedLevel)}</span>
      </div>
    </div>
    ${d.amenities.length > 0 ? `
    <div style="margin-top:12px;">
      <span class="label">المرافق / Amenities</span>
      <div class="amenities-list">${amenitiesList}</div>
    </div>
    ` : ""}
  </div>

  <!-- Lease Terms -->
  <div class="section">
    <div class="section-title">
      شروط الإيجار
      <span class="en">Lease Terms</span>
    </div>
    <div class="info-grid" style="margin-bottom:16px;">
      <div class="info-item">
        <span class="label">تاريخ البداية / Start Date</span>
        <span class="value">${d.startDate}</span>
      </div>
      <div class="info-item">
        <span class="label">تاريخ النهاية / End Date</span>
        <span class="value">${d.endDate}</span>
      </div>
      <div class="info-item">
        <span class="label">مدة العقد / Duration</span>
        <span class="value">${d.durationMonths} ${d.durationMonths === 1 ? "شهر / month" : "أشهر / months"}</span>
      </div>
    </div>
    
    <table class="financial-table">
      <thead>
        <tr>
          <th>البند / Item</th>
          <th>المبلغ (ر.س) / Amount (SAR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>الإيجار الشهري / Monthly Rent</td>
          <td>${formatCurrency(d.monthlyRent)} ر.س</td>
        </tr>
        <tr>
          <td>إجمالي الإيجار (${d.durationMonths} أشهر) / Total Rent (${d.durationMonths} months)</td>
          <td>${formatCurrency(parseFloat(d.monthlyRent) * d.durationMonths)} ر.س</td>
        </tr>
        <tr>
          <td>مبلغ التأمين / Security Deposit</td>
          <td>${formatCurrency(d.securityDeposit)} ر.س</td>
        </tr>
        <tr>
          <td>رسوم الخدمة / Service Fee</td>
          <td>${formatCurrency(d.serviceFee)} ر.س</td>
        </tr>
        <tr class="total-row">
          <td>المبلغ الإجمالي / Total Amount</td>
          <td>${formatCurrency(d.totalAmount)} ر.س</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Terms and Conditions -->
  <div class="section">
    <div class="section-title">
      الشروط والأحكام
      <span class="en">Terms & Conditions</span>
    </div>
    <ol class="terms-list">
      <li>
        <div class="bilingual">
          <span class="ar">يلتزم المستأجر بدفع الإيجار الشهري في موعده المحدد وهو بداية كل شهر ميلادي.</span>
          <span class="en">The tenant commits to paying the monthly rent on its due date, which is the beginning of each calendar month.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">يُستخدم العقار للسكن فقط ولا يجوز تغيير الغرض من الاستخدام دون موافقة خطية من المؤجر.</span>
          <span class="en">The property shall be used for residential purposes only. Change of use requires written consent from the landlord.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">لا يحق للمستأجر التأجير من الباطن أو التنازل عن العقد لطرف ثالث.</span>
          <span class="en">The tenant may not sublet or assign this contract to a third party.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">يلتزم المستأجر بالمحافظة على العقار وإعادته بحالة جيدة عند انتهاء العقد، مع مراعاة الاستهلاك الطبيعي.</span>
          <span class="en">The tenant shall maintain the property and return it in good condition at contract end, accounting for normal wear and tear.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">يُعاد مبلغ التأمين خلال 30 يوم عمل من انتهاء العقد بعد فحص العقار وخصم أي أضرار إن وجدت.</span>
          <span class="en">The security deposit shall be returned within 30 business days after contract end, following property inspection and deduction of any damages.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">يتحمل المؤجر الصيانة الهيكلية والإصلاحات الكبرى، بينما يتحمل المستأجر الصيانة البسيطة والاستخدام اليومي.</span>
          <span class="en">The landlord is responsible for structural maintenance and major repairs. The tenant is responsible for minor maintenance and daily upkeep.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">في حالة الإخلاء المبكر، يلتزم المستأجر بإشعار المؤجر قبل 30 يوماً على الأقل.</span>
          <span class="en">In case of early termination, the tenant must provide at least 30 days written notice to the landlord.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">يخضع هذا العقد لأنظمة المملكة العربية السعودية ونظام إيجار.</span>
          <span class="en">This contract is governed by the laws of the Kingdom of Saudi Arabia and the Ejar system regulations.</span>
        </div>
      </li>
      <li>
        <div class="bilingual">
          <span class="ar">أي نزاع ينشأ عن هذا العقد يُحال إلى الجهات القضائية المختصة في المملكة العربية السعودية.</span>
          <span class="en">Any dispute arising from this contract shall be referred to the competent judicial authorities in the Kingdom of Saudi Arabia.</span>
        </div>
      </li>
    </ol>
  </div>

  <!-- House Rules -->
  <div class="section">
    <div class="section-title">
      قوانين العقار
      <span class="en">House Rules</span>
    </div>
    <div class="bilingual" style="padding:12px; background:#f9fafb; border-radius:8px;">
      <span class="ar">${d.houseRulesAr}</span>
      <span class="en">${d.houseRules}</span>
    </div>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="signature-box">
      <div class="role">المؤجر</div>
      <div class="role-en">Landlord</div>
      <div class="name">${d.landlordNameAr}<br><small style="color:#666">${d.landlordName}</small></div>
      <div class="line">التوقيع / Signature</div>
    </div>
    <div class="signature-box">
      <div class="role">المستأجر</div>
      <div class="role-en">Tenant</div>
      <div class="name">${d.tenantNameAr}<br><small style="color:#666">${d.tenantName}</small></div>
      <div class="line">التوقيع / Signature</div>
    </div>
  </div>

  <div style="text-align:center; margin-top:24px;">
    <div class="stamp">إيجار<br>IJAR</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>تم إنشاء هذا العقد إلكترونياً عبر منصة إيجار للإيجار الشهري</p>
    <p>This contract was generated electronically via Ijar Monthly Rental Platform</p>
    <p style="margin-top:8px;">رقم العقد: ${d.contractNumber} | التاريخ: ${d.date}</p>
  </div>
</div>
</body>
</html>`;
}
