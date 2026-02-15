import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Shield } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function PrivacyPolicy() {
  const { lang, dir } = useI18n();
  const { get: s, getByLang: sl } = useSiteSettings();
  const siteName = sl("site.name", lang) || "المفتاح الشهري";
  const customContent = lang === "ar" ? s("privacy.contentAr") : s("privacy.contentEn");

  const arContent = `
# سياسة الخصوصية وحماية البيانات الشخصية

**آخر تحديث:** ${new Date().toLocaleDateString("ar-SA")}

تلتزم منصة ${siteName} ("المنصة"، "نحن") بحماية خصوصية مستخدميها وبياناتهم الشخصية وفقاً لنظام حماية البيانات الشخصية الصادر بالمرسوم الملكي رقم (م/19) وتاريخ 9/2/1443هـ ("النظام") ولائحته التنفيذية الصادرة عن الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).

---

## 1. تعريفات

- **البيانات الشخصية:** كل بيان يتعلق بشخص طبيعي محدد أو يمكن تحديده بصورة مباشرة أو غير مباشرة.
- **المعالجة:** أي عملية تتم على البيانات الشخصية بما في ذلك الجمع والتسجيل والحفظ والتنظيم والتخزين والتعديل والاسترجاع والاستخدام والإفصاح والنقل والمحو.
- **جهة التحكم:** المنصة بصفتها الجهة التي تحدد أغراض معالجة البيانات الشخصية ووسائلها.
- **صاحب البيانات:** الشخص الطبيعي الذي تتعلق به البيانات الشخصية.

---

## 2. البيانات التي نجمعها

نجمع البيانات الشخصية التالية بناءً على مبدأ الحد الأدنى اللازم لتحقيق الغرض:

### 2.1 بيانات التسجيل
- الاسم الكامل
- البريد الإلكتروني
- رقم الهاتف المحمول
- كلمة المرور (مشفرة)

### 2.2 بيانات الحجز والإيجار
- تواريخ الإقامة المطلوبة
- مدة الإيجار
- تفاصيل الدفع (لا نخزن بيانات البطاقات البنكية مباشرة)

### 2.3 بيانات الاستخدام
- عنوان بروتوكول الإنترنت (IP)
- نوع المتصفح والجهاز
- صفحات الموقع التي تمت زيارتها
- وقت وتاريخ الزيارة

---

## 3. أغراض المعالجة والأساس النظامي

نعالج بياناتك الشخصية للأغراض التالية:

| الغرض | الأساس النظامي |
|-------|---------------|
| إنشاء وإدارة حسابك | تنفيذ العقد |
| معالجة طلبات الحجز والإيجار | تنفيذ العقد |
| التواصل بشأن حجوزاتك | المصلحة المشروعة |
| تحسين خدمات المنصة | المصلحة المشروعة |
| الامتثال للمتطلبات النظامية | الالتزام القانوني |
| إرسال إشعارات الخدمة | تنفيذ العقد |

---

## 4. حقوق صاحب البيانات

وفقاً للمادة الرابعة من النظام، يحق لك:

1. **حق العلم:** الاطلاع على البيانات الشخصية المتعلقة بك والمحفوظة لدينا.
2. **حق الوصول:** الحصول على نسخة من بياناتك الشخصية بصيغة واضحة.
3. **حق التصحيح:** طلب تصحيح بياناتك الشخصية غير الدقيقة أو إكمالها.
4. **حق المحو:** طلب إتلاف بياناتك الشخصية عند انتفاء الغرض من جمعها.
5. **حق الاعتراض:** الاعتراض على معالجة بياناتك في حالات معينة.
6. **حق نقل البيانات:** طلب نقل بياناتك إلى جهة أخرى بصيغة مقروءة آلياً.

لممارسة أي من هذه الحقوق، يرجى التواصل معنا عبر البريد الإلكتروني المذكور أدناه.

---

## 5. حماية البيانات وأمنها

نطبق التدابير التنظيمية والإدارية والتقنية اللازمة لحماية بياناتك الشخصية، تشمل:

- تشفير البيانات أثناء النقل باستخدام بروتوكول TLS/SSL
- تشفير كلمات المرور باستخدام خوارزمية bcrypt
- تقييد الوصول إلى البيانات الشخصية على الموظفين المخولين فقط
- المراجعة الدورية لإجراءات الأمان
- الاحتفاظ بسجلات الوصول والتعديل

---

## 6. الإفصاح عن البيانات

لا نبيع أو نؤجر بياناتك الشخصية لأي طرف ثالث. قد نفصح عن بياناتك في الحالات التالية فقط:

- **لمقدمي الخدمات:** مثل مزودي خدمات الدفع والاستضافة، بموجب اتفاقيات حماية بيانات.
- **للجهات الحكومية:** عند وجود التزام نظامي أو أمر قضائي.
- **لملاك العقارات:** المعلومات الضرورية لإتمام عملية الحجز فقط.

---

## 7. نقل البيانات خارج المملكة

في حال نقل بياناتك الشخصية خارج المملكة العربية السعودية، نلتزم بأحكام لائحة نقل البيانات الشخصية الصادرة عن سدايا، بما في ذلك:

- إجراء تقييم المخاطر المطلوب
- ضمان مستوى حماية مناسب في الدولة المستقبلة
- الحصول على موافقتك عند الاقتضاء

---

## 8. ملفات تعريف الارتباط (Cookies)

نستخدم ملفات تعريف الارتباط الضرورية لتشغيل المنصة وتحسين تجربة المستخدم. تشمل:

- **ملفات ضرورية:** لتسجيل الدخول وإدارة الجلسة (لا يمكن تعطيلها).
- **ملفات تحليلية:** لفهم كيفية استخدام المنصة (يمكنك رفضها).

---

## 9. الاحتفاظ بالبيانات

نحتفظ ببياناتك الشخصية طالما كان ذلك ضرورياً لتحقيق الأغراض المحددة في هذه السياسة، أو وفقاً للمتطلبات النظامية. عند انتفاء الغرض، نقوم بإتلاف البيانات أو إخفاء هويتها.

---

## 10. حماية بيانات القاصرين

لا تستهدف المنصة الأشخاص دون سن 18 عاماً. في حال علمنا بجمع بيانات شخصية لقاصر دون موافقة وليه الشرعي، سنقوم بحذفها فوراً.

---

## 11. إشعار خرق البيانات

في حال وقوع خرق للبيانات الشخصية يؤثر على حقوقك، سنقوم بإخطارك والجهة المختصة خلال المدة المحددة نظاماً وفقاً للمادة (20) من النظام.

---

## 12. التعديلات على السياسة

نحتفظ بحق تعديل هذه السياسة في أي وقت. سيتم إشعارك بأي تعديلات جوهرية عبر المنصة أو البريد الإلكتروني. استمرارك في استخدام المنصة بعد التعديل يعد قبولاً للسياسة المعدلة.

---

## 13. الجهة المختصة والقانون الواجب التطبيق

تخضع هذه السياسة لأنظمة المملكة العربية السعودية. الجهة المختصة بالرقابة على حماية البيانات الشخصية هي الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).

---

## 14. التواصل معنا

لأي استفسارات أو طلبات تتعلق بخصوصية بياناتك الشخصية، يرجى التواصل معنا عبر:

- **المنصة:** ${siteName}
- **البريد الإلكتروني:** يمكنك التواصل معنا من خلال بيانات الاتصال المتوفرة في الموقع
`;

  const enContent = `
# Privacy Policy and Personal Data Protection

**Last Updated:** ${new Date().toLocaleDateString("en-US")}

${siteName} ("the Platform", "we", "us") is committed to protecting the privacy and personal data of its users in accordance with the Personal Data Protection Law (PDPL) issued by Royal Decree No. (M/19) dated 9/2/1443H and its Implementing Regulations issued by the Saudi Data and Artificial Intelligence Authority (SDAIA).

---

## 1. Definitions

- **Personal Data:** Any data relating to an identified or identifiable natural person, directly or indirectly.
- **Processing:** Any operation performed on personal data, including collection, recording, storage, organization, modification, retrieval, use, disclosure, transfer, and destruction.
- **Controller:** The Platform, as the entity that determines the purposes and means of processing personal data.
- **Data Subject:** The natural person to whom the personal data relates.

---

## 2. Data We Collect

We collect the following personal data based on the data minimization principle:

### 2.1 Registration Data
- Full name
- Email address
- Mobile phone number
- Password (encrypted)

### 2.2 Booking and Rental Data
- Requested stay dates
- Rental duration
- Payment details (we do not directly store bank card data)

### 2.3 Usage Data
- IP address
- Browser type and device
- Pages visited on the platform
- Date and time of visit

---

## 3. Purposes and Legal Basis for Processing

We process your personal data for the following purposes:

| Purpose | Legal Basis |
|---------|-------------|
| Creating and managing your account | Contract performance |
| Processing booking and rental requests | Contract performance |
| Communicating about your bookings | Legitimate interest |
| Improving platform services | Legitimate interest |
| Complying with regulatory requirements | Legal obligation |
| Sending service notifications | Contract performance |

---

## 4. Data Subject Rights

In accordance with Article 4 of the PDPL, you have the right to:

1. **Right to Know:** Be informed about the personal data we hold about you.
2. **Right of Access:** Obtain a copy of your personal data in a clear format.
3. **Right to Rectification:** Request correction of inaccurate personal data or completion of incomplete data.
4. **Right to Erasure:** Request destruction of your personal data when the purpose of collection no longer exists.
5. **Right to Object:** Object to the processing of your data in certain circumstances.
6. **Right to Data Portability:** Request transfer of your data to another entity in a machine-readable format.

To exercise any of these rights, please contact us using the contact information provided below.

---

## 5. Data Protection and Security

We implement necessary organizational, administrative, and technical measures to protect your personal data, including:

- Encryption of data in transit using TLS/SSL protocol
- Password encryption using bcrypt algorithm
- Restricting access to personal data to authorized personnel only
- Periodic review of security procedures
- Maintaining access and modification logs

---

## 6. Data Disclosure

We do not sell or rent your personal data to any third party. We may disclose your data only in the following cases:

- **To Service Providers:** Such as payment and hosting service providers, under data protection agreements.
- **To Government Authorities:** When required by law or court order.
- **To Property Owners:** Only information necessary to complete the booking process.

---

## 7. Cross-Border Data Transfer

If your personal data is transferred outside the Kingdom of Saudi Arabia, we comply with the Data Transfer Regulations issued by SDAIA, including:

- Conducting the required risk assessment
- Ensuring an adequate level of protection in the receiving country
- Obtaining your consent when required

---

## 8. Cookies

We use cookies necessary for the operation of the Platform and to improve user experience, including:

- **Essential Cookies:** For login and session management (cannot be disabled).
- **Analytics Cookies:** To understand how the Platform is used (you may decline these).

---

## 9. Data Retention

We retain your personal data for as long as necessary to fulfill the purposes specified in this policy, or as required by applicable regulations. When the purpose no longer exists, we destroy or anonymize the data.

---

## 10. Protection of Minors' Data

The Platform does not target individuals under the age of 18. If we become aware that we have collected personal data from a minor without the consent of their legal guardian, we will delete it immediately.

---

## 11. Data Breach Notification

In the event of a personal data breach that affects your rights, we will notify you and the competent authority within the period specified by law in accordance with Article (20) of the PDPL.

---

## 12. Policy Amendments

We reserve the right to amend this policy at any time. You will be notified of any material changes through the Platform or by email. Your continued use of the Platform after the amendment constitutes acceptance of the updated policy.

---

## 13. Governing Law and Competent Authority

This policy is governed by the laws of the Kingdom of Saudi Arabia. The competent authority for personal data protection oversight is the Saudi Data and Artificial Intelligence Authority (SDAIA).

---

## 14. Contact Us

For any inquiries or requests regarding your personal data privacy, please contact us through:

- **Platform:** ${siteName}
- **Email:** You can reach us through the contact information available on the website
`;

  const content = customContent || (lang === "ar" ? arContent : enContent);

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      <SEOHead
        title="Privacy Policy"
        titleAr="سياسة الخصوصية"
        description="Privacy policy compliant with Saudi PDPL regulations"
        path="/privacy"
      />
      <Navbar />
      <main className="flex-1 container py-8 sm:py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">
              {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "حماية بياناتك الشخصية وفقاً لنظام حماية البيانات الشخصية (PDPL)" : "Protecting your personal data in compliance with Saudi PDPL"}
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
