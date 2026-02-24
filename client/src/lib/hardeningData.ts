/**
 * Data: Production Hardening Knowledge Base
 * Design: "Technical Vault" - dark charcoal + gold copper
 */

export interface CheckItem {
  id: string;
  text: string;
  status: "done" | "partial" | "missing" | "unknown";
  priority: "critical" | "high" | "medium" | "low";
  details?: string;
  verification?: string;
}

export interface TableRow {
  cells: string[];
}

export interface SectionTable {
  headers: string[];
  rows: TableRow[];
}

export interface Section {
  id: string;
  number: number;
  title: string;
  titleShort: string;
  icon: string;
  description: string;
  content: string[];
  items?: CheckItem[];
  tables?: SectionTable[];
  subsections?: { title: string; content: string[]; items?: CheckItem[] }[];
}

export const sections: Section[] = [
  {
    id: "assumptions",
    number: 1,
    title: "الافتراضات الأساسية وما أحتاجه منك",
    titleShort: "الافتراضات",
    icon: "FileText",
    description: "الافتراضات التي بنيت عليها الخطة والبيانات المطلوبة لإكمال التقوية",
    content: [
      "هذا القسم يوضح الافتراضات التي بنيت عليها هذه الخطة والبيانات القليلة المطلوبة منك لإكمال عملية التقوية."
    ],
    tables: [
      {
        headers: ["الفئة", "الافتراض"],
        rows: [
          { cells: ["المكدس التقني", "Node.js, Express, React (Vite), TypeScript, MySQL (Drizzle ORM), pnpm"] },
          { cells: ["الاستضافة", "Railway (عبر Dockerfile)"] },
          { cells: ["نظام إدارة المحتوى", "نظام مخصص مدمج في لوحة تحكم الأدمن"] },
          { cells: ["المصادقة", "نظام مخصص يعتمد على JWT مع تسجيل دخول عبر البريد الإلكتروني/كلمة المرور"] },
          { cells: ["المدفوعات", "تكامل مع PayPal موجود، مفاتيح الربط مخزنة في قاعدة البيانات"] },
          { cells: ["تخزين الملفات", "تخزين محلي على وحدة تخزين دائمة (/app/uploads) من Railway"] },
          { cells: ["التحليلات", "Google Analytics (GA4) + Umami (يتطلب تفعيل عبر متغيرات البيئة)"] },
        ],
      },
    ],
    items: [
      { id: "a1", text: "معرفات التحليلات (VITE_GA_MEASUREMENT_ID)", status: "missing", priority: "high", details: "معرف Google Analytics 4 مطلوب لتفعيل التحليلات" },
      { id: "a2", text: "اسم النطاق النهائي (Production Domain)", status: "missing", priority: "critical", details: "مطلوب لضبط ترويسات الأمان (CSP, HSTS) بشكل صحيح" },
      { id: "a3", text: "بيانات البريد الإلكتروني (SMTP)", status: "missing", priority: "high", details: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS لإرسال البريد الإلكتروني" },
      { id: "a4", text: "مفاتيح إشعارات الدفع (VAPID Keys)", status: "missing", priority: "medium", details: "مفاتيح VAPID للبيئة الإنتاجية لإرسال إشعارات الويب" },
      { id: "a5", text: "تفاصيل العمل الرسمية", status: "missing", priority: "medium", details: "اسم الشركة الرسمي، العنوان، ومعلومات الاتصال لـ SEO" },
    ],
  },
  {
    id: "must-haves",
    number: 2,
    title: "المتطلبات الأساسية غير القابلة للتفاوض",
    titleShort: "المتطلبات",
    icon: "ShieldCheck",
    description: "الحد الأدنى المطلوب لموقع يتحمل ضغطًا عاليًا",
    content: [
      "كل موقع إنتاجي مصمم للتعامل مع عدد كبير من الزوار يجب أن يفي بالمعايير التالية. هذه القائمة تمثل الحد الأدنى المطلوب لضمان تجربة مستخدم جيدة وموثوقية عالية."
    ],
    items: [
      { id: "m1", text: "ضغط الأصول (Gzip/Brotli)", status: "done", priority: "critical", details: "تم تطبيق ضغط Gzip عبر middleware جديد", verification: "تحقق من ترويسة content-encoding: gzip" },
      { id: "m2", text: "تحسين الصور (WebP + أحجام متجاوبة)", status: "partial", priority: "high", details: "يوجد نظام تحسين عند الرفع، لكن لا يتم استخدامه لكل الصور" },
      { id: "m3", text: "شبكة توصيل المحتوى (CDN)", status: "done", priority: "critical", details: "Railway توفر CDN بشكل افتراضي (Fastly)" },
      { id: "m4", text: "HTTPS إلزامي", status: "done", priority: "critical", details: "الموقع يعمل عبر HTTPS" },
      { id: "m5", text: "ترويسات الأمان (Security Headers)", status: "done", priority: "critical", details: "تم تطبيق HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP", verification: "استخدم securityheaders.com للتحقق" },
      { id: "m6", text: "إدارة الأسرار (Secrets Management)", status: "done", priority: "critical", details: "يتم استخدام متغيرات البيئة (Environment Variables)" },
      { id: "m7", text: "العلامات الوصفية (Meta Tags)", status: "done", priority: "high", details: "يوجد مكون SEOHead لإدارة العلامات" },
      { id: "m8", text: "خريطة الموقع و robots.txt", status: "done", priority: "high", details: "تم إنشاء sitemap.xml ديناميكي و robots.txt", verification: "تحقق من /robots.txt و /sitemap.xml" },
      { id: "m9", text: "التنقل عبر لوحة المفاتيح", status: "partial", priority: "medium", details: "العناصر الأساسية قابلة للوصول، بعض المكونات تحتاج مراجعة" },
      { id: "m10", text: "تباين الألوان (WCAG 2.2 AA)", status: "unknown", priority: "medium", details: "يتطلب تدقيقًا كاملاً" },
      { id: "m11", text: "النسخ الاحتياطي (Backups)", status: "unknown", priority: "high", details: "يعتمد على إعدادات Railway" },
      { id: "m12", text: "مراقبة وقت التشغيل", status: "missing", priority: "high", details: "يتطلب إعداد أداة خارجية مثل UptimeRobot" },
      { id: "m13", text: "تتبع الأخطاء (Sentry)", status: "missing", priority: "high", details: "غير مطبق - يتطلب دمج Sentry SDK" },
      { id: "m14", text: "تحليلات المستخدم", status: "partial", priority: "medium", details: "تم إعداد GA4/Umami ولكنهما غير مفعلان" },
      { id: "m15", text: "لافتة الموافقة على الكوكيز", status: "done", priority: "medium", details: "توجد لافتة موافقة" },
    ],
  },
  {
    id: "infrastructure",
    number: 3,
    title: "خطة البنية التحتية للتعامل مع عدد كبير من الزوار",
    titleShort: "البنية التحتية",
    icon: "Server",
    description: "CDN، تخزين مؤقت، قاعدة بيانات، مهام خلفية",
    content: [
      "لضمان استقرار الموقع تحت ضغط عالٍ دون تغيير التصميم، نقترح التحسينات التالية على البنية التحتية."
    ],
    subsections: [
      {
        title: "استراتيجية CDN والتخزين المؤقت",
        content: [
          "تستخدم Railway شبكة Fastly كـ CDN. الأصول الثابتة (JS, CSS, woff2) تحصل على تخزين مؤقت طويل جدًا (max-age=31536000, immutable). الصور المحسّنة تحصل على تخزين متوسط (أسبوع واحد) مع ETag."
        ],
      },
      {
        title: "استراتيجية العرض (Rendering)",
        content: [
          "الصفحات العامة يمكن تحويلها إلى SSG. صفحات التفاصيل تستخدم ISR. لوحات التحكم تظل CSR."
        ],
      },
      {
        title: "تحسين الصور والوسائط",
        content: [
          "تحويل جميع الصور إلى WebP و AVIF. استخدام srcset للأحجام المتجاوبة. تطبيق التحميل الكسول (lazy loading)."
        ],
      },
      {
        title: "حماية واجهة برمجة التطبيقات (API)",
        content: [
          "استبدال محدد المعدل بـ Redis. تفعيل WAF على مستوى CDN. استخدام hCaptcha على نماذج التسجيل."
        ],
      },
      {
        title: "توسيع قاعدة البيانات",
        content: [
          "إضافة فهارس إلى الأعمدة المستخدمة بكثرة. ضبط حجم تجميع الاتصالات. إعداد نسخ قراءة إذا لزم الأمر."
        ],
      },
      {
        title: "المهام الخلفية",
        content: [
          "نقل المهام الطويلة (بريد إلكتروني، ويب هوك) إلى قائمة انتظار BullMQ مع Redis."
        ],
      },
      {
        title: "استراتيجية البحث",
        content: [
          "استبدال استعلامات LIKE بمحرك بحث مخصص مثل Meilisearch أو Algolia."
        ],
      },
      {
        title: "تخزين الملفات",
        content: [
          "الانتقال من التخزين المحلي إلى تخزين كائنات سحابي (AWS S3 أو Cloudflare R2)."
        ],
      },
    ],
  },
  {
    id: "performance",
    number: 4,
    title: "ميزانيات وأهداف الأداء",
    titleShort: "الأداء",
    icon: "Gauge",
    description: "أهداف محددة بالأرقام لمؤشرات الويب الأساسية",
    content: [
      "لضمان تجربة مستخدم سريعة، يجب تحديد أهداف أداء قابلة للقياس. الفشل في تلبية هذه الميزانيات يشير إلى وجود مشكلة تحتاج إلى حل فوري."
    ],
    tables: [
      {
        headers: ["المقياس", "الهدف", "اختبار القبول"],
        rows: [
          { cells: ["LCP (Largest Contentful Paint)", "< 2.5 ثانية", "75% من المستخدمين يحققون الهدف"] },
          { cells: ["INP (Interaction to Next Paint)", "< 200 مللي ثانية", "75% من المستخدمين يحققون الهدف"] },
          { cells: ["CLS (Cumulative Layout Shift)", "< 0.1", "75% من المستخدمين يحققون الهدف"] },
          { cells: ["TTFB (Time to First Byte)", "< 800 مللي ثانية", "متوسط من مواقع متعددة"] },
          { cells: ["حجم حزمة JavaScript", "< 250 كيلوبايت (مضغوط)", "الحالي: ~1.6 ميجابايت غير مضغوط"] },
          { cells: ["حجم الصور (الرئيسية)", "< 1 ميجابايت (إجمالي)", "إجمالي صور الصفحة الرئيسية"] },
          { cells: ["عدد الطلبات (الرئيسية)", "< 50 طلبًا", "التحميل الأولي"] },
          { cells: ["نصوص الطرف الثالث", "< 50 كيلوبايت", "التحليلات وغيرها"] },
        ],
      },
    ],
  },
  {
    id: "security",
    number: 5,
    title: "قائمة تدقيق تقوية الأمان",
    titleShort: "الأمان",
    icon: "Lock",
    description: "ترويسات، CSRF، تحديد المعدل، إدارة الأسرار",
    content: [
      "تعتبر حماية الموقع وبيانات المستخدمين أولوية قصوى. هذه القائمة تغطي الإجراءات الأمنية الأساسية."
    ],
    items: [
      { id: "s1", text: "HTTPS و HSTS", status: "done", priority: "critical", details: "Strict-Transport-Security header مع max-age طويل", verification: "تحقق من وجود الترويسة في استجابات الخادم" },
      { id: "s2", text: "سياسة أمان المحتوى (CSP)", status: "done", priority: "high", details: "تم إضافة CSP في وضع التقرير فقط (Report-Only) كبداية", verification: "تحقق من ترويسة Content-Security-Policy-Report-Only" },
      { id: "s3", text: "ترويسات الأمان الأخرى", status: "done", priority: "high", details: "X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy", verification: "استخدم securityheaders.com" },
      { id: "s4", text: "التحقق من صحة المدخلات", status: "partial", priority: "critical", details: "يوجد sanitizeText أساسي. يجب توسيعه ليشمل Zod validation" },
      { id: "s5", text: "أمان الجلسات (SameSite Cookie)", status: "done", priority: "critical", details: "تم تغيير SameSite من None إلى Lax", verification: "تحقق من سمات الكوكي في أدوات المطور" },
      { id: "s6", text: "الحماية من CSRF", status: "missing", priority: "high", details: "يجب تطبيق Double Submit Cookie أو Anti-CSRF-Token" },
      { id: "s7", text: "إدارة الأسرار", status: "done", priority: "critical", details: "يتم استخدام متغيرات البيئة" },
      { id: "s8", text: "إدارة نقاط ضعف التبعيات", status: "partial", priority: "medium", details: "يجب تشغيل pnpm audit بانتظام" },
      { id: "s9", text: "منع إساءة الاستخدام", status: "missing", priority: "medium", details: "منع تعداد الحسابات والبريد العشوائي" },
    ],
  },
  {
    id: "seo",
    number: 6,
    title: "قائمة تدقيق أساسيات SEO",
    titleShort: "SEO",
    icon: "Search",
    description: "robots.txt، sitemap، بيانات منظمة، OpenGraph",
    content: [
      "لضمان ظهور الموقع بشكل جيد في نتائج البحث، يجب تطبيق أساسيات SEO التالية."
    ],
    items: [
      { id: "seo1", text: "عناوين وأوصاف فريدة لكل صفحة", status: "done", priority: "critical", details: "مطبق عبر مكون SEOHead" },
      { id: "seo2", text: "العناوين الأساسية (Canonicals)", status: "done", priority: "high", details: "مطبق عبر مكون SEOHead" },
      { id: "seo3", text: "robots.txt و sitemap.xml", status: "done", priority: "high", details: "تم إنشاء كلا الملفين", verification: "تحقق من /robots.txt و /sitemap.xml" },
      { id: "seo4", text: "بطاقات OpenGraph و Twitter", status: "done", priority: "medium", details: "مطبق عبر SEOHead. يجب إضافة og:image" },
      { id: "seo5", text: "البيانات المنظمة (Structured Data)", status: "partial", priority: "high", details: "Organization, WebSite, RealEstateAgent موجودة. يجب إضافة RealEstateListing و FAQPage" },
      { id: "seo6", text: "صحة عناوين URL", status: "done", priority: "medium", details: "عناوين URL واضحة وقصيرة" },
      { id: "seo7", text: "استراتيجية 404 وإعادة التوجيه", status: "done", priority: "medium", details: "يوجد صفحة 404 مخصصة" },
    ],
  },
  {
    id: "accessibility",
    number: 7,
    title: "إمكانية الوصول والامتثال لتجربة المستخدم",
    titleShort: "إمكانية الوصول",
    icon: "Eye",
    description: "WCAG 2.2 AA، تباين الألوان، تقليل الحركة",
    content: [
      "يجب أن يكون الموقع قابلاً للاستخدام من قبل الجميع، بما في ذلك الأشخاص ذوي الإعاقة."
    ],
    items: [
      { id: "acc1", text: "تدقيق WCAG 2.2 AA كامل", status: "missing", priority: "medium", details: "يجب إجراء تدقيق باستخدام axe DevTools" },
      { id: "acc2", text: "حالات التركيز (Focus States)", status: "partial", priority: "medium", details: "يستخدم focus-visible. يجب التأكد من وضوح التركيز لكل عنصر" },
      { id: "acc3", text: "التنقل عبر لوحة المفاتيح", status: "partial", priority: "medium", details: "يجب اختبار الموقع بمفتاح Tab فقط" },
      { id: "acc4", text: "تسميات النماذج ورسائل الخطأ", status: "partial", priority: "medium", details: "يجب ربط كل حقل إدخال بتسمية label" },
      { id: "acc5", text: "تدقيق تباين الألوان", status: "unknown", priority: "medium", details: "نسبة تباين 4.5:1 على الأقل لمعيار AA" },
      { id: "acc6", text: "أنماط ARIA", status: "partial", priority: "low", details: "استخدام سمات ARIA للمكونات المعقدة" },
      { id: "acc7", text: "تقليل الحركة (prefers-reduced-motion)", status: "missing", priority: "low", details: "يجب لف الحركات في استعلام prefers-reduced-motion" },
    ],
  },
  {
    id: "analytics",
    number: 8,
    title: "خطة التحليلات والقياس",
    titleShort: "التحليلات",
    icon: "BarChart3",
    description: "GA4، Umami، تسمية الأحداث، مسارات التحويل",
    content: [
      "لفهم سلوك المستخدم وتحسين الموقع، يجب تطبيق خطة قياس قوية."
    ],
    tables: [
      {
        headers: ["اسم الحدث", "الوصف", "المشغل"],
        rows: [
          { cells: ["page_view", "مشاهدة صفحة", "عند تغيير المسار"] },
          { cells: ["login", "تسجيل دخول ناجح", "بعد نجاح المصادقة"] },
          { cells: ["register", "تسجيل حساب جديد", "بعد نجاح إنشاء الحساب"] },
          { cells: ["search", "إجراء بحث عن عقارات", "عند إرسال نموذج البحث"] },
          { cells: ["property_viewed", "مشاهدة تفاصيل عقار", "عند تحميل صفحة التفاصيل"] },
          { cells: ["booking_started", "بدء عملية الحجز", "عند النقر على احجز الآن"] },
          { cells: ["booking_completed", "إكمال حجز ناجح", "عند الوصول لصفحة النجاح"] },
          { cells: ["lead_generated", "إرسال نموذج تواصل", "عند إرسال النموذج بنجاح"] },
        ],
      },
    ],
    subsections: [
      {
        title: "منصة التحليلات",
        content: ["استخدام GA4 كأداة أساسية و Umami كبديل خفيف. الكود موجود ويحتاج تفعيل عبر متغيرات البيئة."],
      },
      {
        title: "اتفاقية تسمية الأحداث",
        content: ["اتبع نمط object_verb (مثل property_viewed, booking_started)."],
      },
      {
        title: "المسارات والتحويلات",
        content: ["مسار حجز العقار: property_viewed → booking_started → payment_initiated → booking_completed. مسار إضافة عقار: list_property_clicked → property_form_submitted → property_published."],
      },
    ],
  },
  {
    id: "observability",
    number: 9,
    title: "المراقبة والموثوقية",
    titleShort: "المراقبة",
    icon: "Activity",
    description: "Sentry، UptimeRobot، تسجيل منظم، اختبار الحمل",
    content: [
      "لضمان تشغيل الموقع بشكل موثوق، يجب تطبيق ممارسات هندسة موثوقية الموقع (SRE)."
    ],
    subsections: [
      {
        title: "مراقبة وقت التشغيل",
        content: ["استخدام UptimeRobot أو Better Uptime لمراقبة الموقع كل دقيقة. هدف وقت التشغيل: 99.9%."],
      },
      {
        title: "هيكل التسجيل (Logging)",
        content: ["استخدام Pino لتسجيل منظم بتنسيق JSON. إرسال السجلات إلى مجمع مركزي مثل Datadog أو Logtail."],
      },
      {
        title: "التتبع (Tracing)",
        content: ["دمج OpenTelemetry لتتبع الطلبات الموزعة عبر الخدمات."],
      },
      {
        title: "دليل التشغيل (Runbook)",
        content: ["إنشاء وثيقة خطوات الاستجابة للحوادث الشائعة."],
      },
      {
        title: "استراتيجية النشر",
        content: ["إعداد بيئة مرحلية (Staging) منفصلة. استخدام أعلام الميزات (Feature Flags) للنشر التدريجي."],
      },
      {
        title: "اختبار الحمل",
        content: ["استخدام k6 أو Locust. سيناريوهات: تصفح الرئيسية، مسار الحجز، ضغط API."],
      },
    ],
  },
  {
    id: "punch-list",
    number: 10,
    title: "قائمة المهام للتنفيذ",
    titleShort: "المهام",
    icon: "ListChecks",
    description: "مهام مرتبة حسب الأهمية مع معايير التحقق",
    content: [
      "هذه قائمة مهام ذات أولوية تم إنشاؤها بناءً على التحليل. يجب معالجة هذه العناصر لضمان جاهزية الموقع."
    ],
    items: [
      { id: "p1", text: "إضافة فهارس (Indexes) إلى قاعدة البيانات", status: "missing", priority: "critical", details: "إضافة فهارس إلى landlordId, propertyId, users.email, properties.city", verification: "انخفاض زمن API لأقل من 200ms تحت الحمل" },
      { id: "p2", text: "تفعيل ضغط Brotli/Gzip", status: "done", priority: "critical", details: "تم تهيئة الخادم لضغط جميع استجابات النص", verification: "ترويسة content-encoding: gzip موجودة" },
      { id: "p3", text: "تطبيق ترويسات الأمان", status: "done", priority: "critical", details: "HSTS, CSP, X-Content-Type-Options, X-Frame-Options", verification: "نتيجة securityheaders.com: A أو أعلى" },
      { id: "p4", text: "تأمين ملفات تعريف الارتباط", status: "done", priority: "critical", details: "تم تغيير SameSite=None إلى SameSite=Lax", verification: "تحقق من سمات الكوكي" },
      { id: "p5", text: "تقليل حجم حزمة JavaScript", status: "missing", priority: "high", details: "تحليل الحزمة واستبدال المكتبات الثقيلة", verification: "حجم الحزمة الرئيسية < 250KB مضغوط" },
      { id: "p6", text: "إنشاء robots.txt و sitemap.xml", status: "done", priority: "high", details: "تم إنشاء كلا الملفين", verification: "/robots.txt و /sitemap.xml متاحان" },
      { id: "p7", text: "دمج Sentry لتتبع الأخطاء", status: "missing", priority: "high", details: "إضافة Sentry SDK للواجهة الأمامية والخلفية", verification: "ظهور الأخطاء في لوحة Sentry" },
      { id: "p8", text: "إعداد مراقبة وقت التشغيل", status: "missing", priority: "high", details: "استخدام UptimeRobot لمراقبة الموقع كل دقيقة", verification: "استلام تنبيه تجريبي بنجاح" },
      { id: "p9", text: "استخدام Redis لمحدد المعدل", status: "missing", priority: "medium", details: "استبدال التطبيق في الذاكرة بـ Redis", verification: "اتساق التحديد عبر نسخ متعددة" },
      { id: "p10", text: "تدقيق WCAG 2.2 AA كامل", status: "missing", priority: "medium", details: "استخدام axe DevTools لتحديد وإصلاح المشكلات", verification: "لا مشكلات حرجة أو خطيرة في تقرير axe" },
    ],
  },
  {
    id: "go-live",
    number: 11,
    title: "بوابة الإطلاق النهائية",
    titleShort: "الإطلاق",
    icon: "Rocket",
    description: "قائمة فحص نهائية قبل الإطلاق الرسمي",
    content: [
      "قبل إطلاق الموقع رسميًا للجمهور، يجب أن تجتاز جميع العناصر التالية هذا الفحص النهائي."
    ],
    items: [
      { id: "g1", text: "تم تكوين اسم النطاق الإنتاجي", status: "missing", priority: "critical", details: "DNS يشير إلى Railway بشكل صحيح" },
      { id: "g2", text: "تم تكوين متغيرات البيئة الإنتاجية", status: "partial", priority: "critical", details: "جميع الأسرار (DB, SMTP, GA4, VAPID) موجودة" },
      { id: "g3", text: "تم إعداد النسخ الاحتياطي لقاعدة البيانات", status: "unknown", priority: "critical", details: "نسخ احتياطية يومية تلقائية على Railway" },
      { id: "g4", text: "ضغط Brotli/Gzip مفعل", status: "done", priority: "critical", details: "ترويسة content-encoding موجودة" },
      { id: "g5", text: "LCP أقل من 2.5 ثانية", status: "unknown", priority: "high", details: "نتيجة Lighthouse تظهر LCP ضمن الهدف" },
      { id: "g6", text: "حجم حزمة JS أقل من 250KB", status: "missing", priority: "high", details: "تحليل الحزمة يؤكد الحجم ضمن الميزانية" },
      { id: "g7", text: "HTTPS و HSTS مفعلان", status: "done", priority: "critical", details: "الموقع يعيد التوجيه إلى HTTPS" },
      { id: "g8", text: "ترويسات الأمان مطبقة", status: "done", priority: "critical", details: "نتيجة securityheaders.com: A أو أعلى" },
      { id: "g9", text: "لا ثغرات حرجة في التبعيات", status: "unknown", priority: "high", details: "نتيجة pnpm audit نظيفة" },
      { id: "g10", text: "robots.txt و sitemap.xml موجودان", status: "done", priority: "high", details: "كلا الملفين يعملان بشكل صحيح" },
      { id: "g11", text: "العناوين الأساسية (Canonicals) صحيحة", status: "done", priority: "medium", details: "فحص عينة من الصفحات" },
      { id: "g12", text: "مراقبة وقت التشغيل مفعلة", status: "missing", priority: "high", details: "UptimeRobot يراقب الموقع بنجاح" },
      { id: "g13", text: "تتبع الأخطاء (Sentry) مفعل", status: "missing", priority: "high", details: "خطأ تجريبي ظهر في لوحة Sentry" },
      { id: "g14", text: "لافتة الموافقة على الكوكيز تعمل", status: "done", priority: "medium", details: "التحليلات لا تعمل إلا بعد الموافقة" },
    ],
  },
];

export function getStatusLabel(status: CheckItem["status"]): string {
  switch (status) {
    case "done": return "مكتمل";
    case "partial": return "جزئي";
    case "missing": return "غير مطبق";
    case "unknown": return "غير معروف";
  }
}

export function getPriorityLabel(priority: CheckItem["priority"]): string {
  switch (priority) {
    case "critical": return "حرج";
    case "high": return "عالي";
    case "medium": return "متوسط";
    case "low": return "منخفض";
  }
}

export function getSectionStats(section: Section) {
  if (!section.items || section.items.length === 0) return null;
  const total = section.items.length;
  const done = section.items.filter(i => i.status === "done").length;
  const partial = section.items.filter(i => i.status === "partial").length;
  const missing = section.items.filter(i => i.status === "missing").length;
  const unknown = section.items.filter(i => i.status === "unknown").length;
  const progress = Math.round(((done + partial * 0.5) / total) * 100);
  return { total, done, partial, missing, unknown, progress };
}

export function getOverallStats() {
  const allItems = sections.flatMap(s => s.items || []);
  const total = allItems.length;
  const done = allItems.filter(i => i.status === "done").length;
  const partial = allItems.filter(i => i.status === "partial").length;
  const missing = allItems.filter(i => i.status === "missing").length;
  const unknown = allItems.filter(i => i.status === "unknown").length;
  const progress = Math.round(((done + partial * 0.5) / total) * 100);
  return { total, done, partial, missing, unknown, progress };
}
