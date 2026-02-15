import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function TermsOfService() {
  const { lang, dir } = useI18n();
  const { get: s, getByLang: sl } = useSiteSettings();
  const siteName = sl("site.name", lang) || "المفتاح الشهري";
  const customContent = lang === "ar" ? s("terms.contentAr") : s("terms.contentEn");

  const arContent = `
# الشروط والأحكام

**آخر تحديث:** ${new Date().toLocaleDateString("ar-SA")}

مرحباً بك في منصة ${siteName} ("المنصة"). باستخدامك للمنصة فإنك توافق على الالتزام بهذه الشروط والأحكام. يرجى قراءتها بعناية قبل استخدام خدماتنا.

---

## 1. التعريفات

- **المنصة:** موقع ${siteName} الإلكتروني وتطبيقاته.
- **المستخدم:** أي شخص يستخدم المنصة سواء كمستأجر أو مالك عقار أو زائر.
- **المستأجر:** الشخص الذي يبحث عن عقار للإيجار الشهري عبر المنصة.
- **مالك العقار / المؤجر:** الشخص أو الجهة التي تعرض عقاراً للإيجار الشهري عبر المنصة.
- **الحجز:** طلب إيجار عقار عبر المنصة لمدة محددة.

---

## 2. طبيعة الخدمة

المنصة هي وسيط إلكتروني يربط بين المستأجرين وملاك العقارات. المنصة لا تملك أو تدير العقارات المعروضة، وإنما توفر أدوات تسهل عملية البحث والحجز والتواصل.

---

## 3. شروط التسجيل

### 3.1 الأهلية
- يجب أن يكون عمر المستخدم 18 سنة فأكثر.
- يجب تقديم معلومات صحيحة ودقيقة عند التسجيل.
- المستخدم مسؤول عن الحفاظ على سرية بيانات حسابه.

### 3.2 حسابات ملاك العقارات
- يجب أن يكون مالك العقار مرخصاً وفقاً لأنظمة المملكة العربية السعودية.
- يجب الحصول على ترخيص وزارة السياحة لمرافق الضيافة السياحية عند الاقتضاء.
- يجب الالتزام بنظام إيجار الصادر عن وزارة الإسكان.

---

## 4. الحجز والإيجار

### 4.1 مدة الإيجار
- المنصة متخصصة في الإيجار الشهري بمدة تتراوح بين شهر واحد وشهرين كحد أقصى.
- لا يمكن تمديد الإيجار عبر المنصة لأكثر من المدة المحددة.

### 4.2 عملية الحجز
1. يقوم المستأجر بتقديم طلب حجز مع تحديد تاريخ الدخول والمدة.
2. يتم مراجعة الطلب من قبل إدارة المنصة.
3. بعد الموافقة، يتم إشعار المستأجر لإتمام عملية الدفع.
4. يتم إصدار عقد إيجار رقمي متوافق مع نظام إيجار.

### 4.3 الإلغاء
- يحق للمستأجر إلغاء الحجز قبل الموافقة عليه دون أي رسوم.
- بعد الموافقة والدفع، تطبق سياسة الإلغاء المحددة لكل عقار.
- يحق لإدارة المنصة رفض أي طلب حجز دون إبداء الأسباب.

---

## 5. الأسعار والدفع

### 5.1 الأسعار
- الأسعار المعروضة بالريال السعودي (SAR) وتشمل:
  - الإيجار الشهري
  - مبلغ التأمين (قابل للاسترداد)
  - رسوم الخدمة
  - ضريبة القيمة المضافة (15%)

### 5.2 ضريبة القيمة المضافة
- تخضع رسوم خدمة المنصة لضريبة القيمة المضافة بنسبة 15% وفقاً لنظام هيئة الزكاة والضريبة والجمارك (ZATCA).
- يتم عرض مبلغ الضريبة بشكل منفصل في تفاصيل الدفع.

### 5.3 طرق الدفع
- تتم عمليات الدفع عبر بوابات دفع آمنة ومعتمدة.
- لا تقوم المنصة بتخزين بيانات البطاقات البنكية.

---

## 6. التزامات المستأجر

- الالتزام بشروط عقد الإيجار.
- المحافظة على العقار وإعادته بحالته الأصلية.
- عدم استخدام العقار لأغراض مخالفة للأنظمة.
- الإبلاغ عن أي أعطال أو مشاكل في العقار فوراً.
- احترام قواعد السكن والجيران.

---

## 7. التزامات مالك العقار

- تقديم معلومات دقيقة وصحيحة عن العقار.
- ضمان مطابقة العقار للوصف والصور المعروضة.
- الحصول على جميع التراخيص اللازمة (وزارة السياحة، البلدية).
- الالتزام بمعايير السلامة والنظافة.
- الاستجابة لطلبات الصيانة في الوقت المناسب.
- الالتزام بنظام إيجار ومتطلبات وزارة الإسكان.

---

## 8. المسؤولية

### 8.1 مسؤولية المنصة
- المنصة وسيط إلكتروني ولا تتحمل المسؤولية عن:
  - حالة العقارات المعروضة أو مطابقتها للوصف.
  - أي نزاعات بين المستأجر ومالك العقار.
  - أي أضرار ناتجة عن استخدام العقار.

### 8.2 حدود المسؤولية
- لا تتجاوز مسؤولية المنصة في أي حال من الأحوال مبلغ رسوم الخدمة المدفوعة.

---

## 9. الملكية الفكرية

جميع حقوق الملكية الفكرية للمنصة (بما في ذلك التصميم والشعار والمحتوى والبرمجيات) محفوظة لصالح ${siteName}. لا يجوز نسخ أو إعادة إنتاج أي جزء من المنصة دون إذن كتابي مسبق.

---

## 10. حل النزاعات

- يتم حل أي نزاع ودياً في المقام الأول.
- في حال تعذر الحل الودي، تختص المحاكم المختصة في المملكة العربية السعودية بالنظر في النزاع.
- يطبق على هذه الشروط أنظمة المملكة العربية السعودية.

---

## 11. الامتثال التنظيمي

تلتزم المنصة بالأنظمة واللوائح التالية:

- **نظام التجارة الإلكترونية** الصادر بالمرسوم الملكي رقم (م/126).
- **نظام حماية البيانات الشخصية** (PDPL) الصادر عن سدايا.
- **نظام إيجار** الصادر عن وزارة الإسكان.
- **أنظمة وزارة السياحة** المتعلقة بمرافق الضيافة السياحية.
- **نظام ضريبة القيمة المضافة** الصادر عن هيئة الزكاة والضريبة والجمارك.

---

## 12. التعديلات

نحتفظ بحق تعديل هذه الشروط والأحكام في أي وقت. سيتم إشعار المستخدمين بأي تعديلات جوهرية. استمرار استخدام المنصة بعد التعديل يعد قبولاً للشروط المعدلة.

---

## 13. التواصل

لأي استفسارات حول هذه الشروط والأحكام، يرجى التواصل معنا عبر بيانات الاتصال المتوفرة في الموقع.
`;

  const enContent = `
# Terms and Conditions

**Last Updated:** ${new Date().toLocaleDateString("en-US")}

Welcome to ${siteName} ("the Platform"). By using the Platform, you agree to be bound by these Terms and Conditions. Please read them carefully before using our services.

---

## 1. Definitions

- **Platform:** The ${siteName} website and its applications.
- **User:** Any person who uses the Platform, whether as a tenant, property owner, or visitor.
- **Tenant:** A person searching for a monthly rental property through the Platform.
- **Property Owner / Landlord:** A person or entity listing a property for monthly rent through the Platform.
- **Booking:** A request to rent a property through the Platform for a specified period.

---

## 2. Nature of Service

The Platform is an electronic intermediary connecting tenants with property owners. The Platform does not own or manage the listed properties but provides tools to facilitate search, booking, and communication.

---

## 3. Registration Requirements

### 3.1 Eligibility
- Users must be 18 years of age or older.
- Accurate and truthful information must be provided during registration.
- Users are responsible for maintaining the confidentiality of their account credentials.

### 3.2 Property Owner Accounts
- Property owners must be licensed in accordance with the laws of the Kingdom of Saudi Arabia.
- A Ministry of Tourism licence for tourism hospitality facilities must be obtained when applicable.
- Compliance with the Ejar system issued by the Ministry of Housing is required.

---

## 4. Booking and Rental

### 4.1 Rental Duration
- The Platform specializes in monthly rentals with a duration ranging from one month to a maximum of two months.
- Rentals cannot be extended beyond the specified duration through the Platform.

### 4.2 Booking Process
1. The tenant submits a booking request specifying the check-in date and duration.
2. The request is reviewed by the Platform administration.
3. Upon approval, the tenant is notified to complete the payment process.
4. A digital lease agreement compliant with the Ejar system is issued.

### 4.3 Cancellation
- The tenant may cancel the booking before approval without any charges.
- After approval and payment, the cancellation policy specific to each property applies.
- The Platform administration reserves the right to reject any booking request without stating reasons.

---

## 5. Pricing and Payment

### 5.1 Prices
- Prices are displayed in Saudi Riyals (SAR) and include:
  - Monthly rent
  - Security deposit (refundable)
  - Service fee
  - Value Added Tax (VAT) at 15%

### 5.2 Value Added Tax (VAT)
- Platform service fees are subject to 15% VAT in accordance with the Zakat, Tax and Customs Authority (ZATCA) regulations.
- The tax amount is displayed separately in payment details.

### 5.3 Payment Methods
- Payments are processed through secure and authorized payment gateways.
- The Platform does not store bank card data.

---

## 6. Tenant Obligations

- Comply with the terms of the lease agreement.
- Maintain the property and return it in its original condition.
- Not use the property for purposes that violate regulations.
- Report any defects or problems in the property immediately.
- Respect housing rules and neighbors.

---

## 7. Property Owner Obligations

- Provide accurate and truthful information about the property.
- Ensure the property matches the description and photos displayed.
- Obtain all necessary licences (Ministry of Tourism, Municipality).
- Comply with safety and cleanliness standards.
- Respond to maintenance requests in a timely manner.
- Comply with the Ejar system and Ministry of Housing requirements.

---

## 8. Liability

### 8.1 Platform Liability
- The Platform is an electronic intermediary and is not liable for:
  - The condition of listed properties or their conformity with descriptions.
  - Any disputes between tenants and property owners.
  - Any damages resulting from the use of properties.

### 8.2 Limitation of Liability
- The Platform's liability shall in no case exceed the amount of service fees paid.

---

## 9. Intellectual Property

All intellectual property rights of the Platform (including design, logo, content, and software) are reserved for ${siteName}. No part of the Platform may be copied or reproduced without prior written permission.

---

## 10. Dispute Resolution

- Any dispute shall first be resolved amicably.
- If amicable resolution is not possible, the competent courts in the Kingdom of Saudi Arabia shall have jurisdiction.
- These terms are governed by the laws of the Kingdom of Saudi Arabia.

---

## 11. Regulatory Compliance

The Platform complies with the following regulations:

- **E-Commerce Law** issued by Royal Decree No. (M/126).
- **Personal Data Protection Law** (PDPL) issued by SDAIA.
- **Ejar System** issued by the Ministry of Housing.
- **Ministry of Tourism Regulations** relating to tourism hospitality facilities.
- **Value Added Tax Law** issued by the Zakat, Tax and Customs Authority (ZATCA).

---

## 12. Amendments

We reserve the right to amend these Terms and Conditions at any time. Users will be notified of any material changes. Continued use of the Platform after the amendment constitutes acceptance of the updated terms.

---

## 13. Contact

For any inquiries about these Terms and Conditions, please contact us through the contact information available on the website.
`;

  const content = customContent || (lang === "ar" ? arContent : enContent);

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      <SEOHead title="Terms of Service" titleAr="الشروط والأحكام" description="Terms and conditions for using المفتاح الشهري rental platform" path="/terms" />
      <Navbar />
      <main className="flex-1 container py-8 sm:py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">
              {lang === "ar" ? "الشروط والأحكام" : "Terms and Conditions"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "شروط استخدام المنصة والخدمات المقدمة" : "Terms of use for the Platform and its services"}
            </p>
          </div>
        </div>
        <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-heading prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-table:text-sm">
          <div dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }} />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function formatMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^\d+\. \*\*(.*?)\*\* (.*$)/gm, '<li><strong>$1</strong> $2</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\| (.*?) \|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      return '<tr>' + cells.map(c => `<td class="border px-3 py-2">${c.trim()}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="w-full border-collapse border rounded-lg overflow-hidden">$&</table>')
    .replace(/^(?!<[huplto])(.*\S.*)$/gm, '<p>$1</p>');
}
