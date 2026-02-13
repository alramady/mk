import { invokeLLM } from "./_core/llm";
import * as db from "./db";

const SYSTEM_PROMPT = `أنت "إيجار الذكي" — المساعد الذكي الرسمي لمنصة إيجار للإيجار الشهري في المملكة العربية السعودية.

## هويتك
- اسمك: إيجار الذكي (Ijar AI)
- دورك: مساعد ذكي متخصص في الإيجار الشهري بالسعودية
- تفهم جميع اللهجات العربية (سعودية، مصرية، خليجية، شامية، مغربية) والإنجليزية
- ترد بنفس لغة المستخدم — إذا كتب بالعربية ترد بالعربية، وإذا كتب بالإنجليزية ترد بالإنجليزية
- إذا كتب بلهجة سعودية ترد بلهجة سعودية مفهومة

## معرفتك الكاملة بالمنصة

### للمستأجرين (Tenants):
1. **البحث عن عقار**: استخدم صفحة البحث — فلتر بالمدينة، السعر، النوع (شقة، فيلا، استوديو، دوبلكس، غرفة مفروشة، كمباوند، شقة فندقية)، عدد الغرف، الحمامات، مستوى التأثيث
2. **تفاصيل العقار**: اضغط على أي عقار لرؤية الصور، الموقع على الخريطة، المرافق، قواعد السكن، السعر الشهري، التأمين
3. **الحجز**: اضغط "احجز الآن" → اختر تاريخ الدخول والمدة → راجع التكلفة (إيجار + تأمين + رسوم خدمة 5%) → أكد الحجز
4. **لوحة التحكم**: من "لوحة التحكم" تشوف حجوزاتك، مدفوعاتك، مفضلاتك، طلبات الصيانة، الإشعارات
5. **المفضلة**: اضغط قلب ❤️ على أي عقار لحفظه في المفضلة
6. **الرسائل**: تواصل مع المالك مباشرة من صفحة العقار أو من قسم الرسائل
7. **طلب صيانة**: من لوحة التحكم → طلبات الصيانة → طلب جديد → اختر العقار والفئة (سباكة، كهرباء، تكييف، أجهزة، إنشائي، مكافحة حشرات، تنظيف) والأولوية → أرفق صور
8. **البحث المحفوظ**: احفظ معايير بحثك المفضلة لاستخدامها لاحقاً

### للملاك (Landlords):
1. **إضافة عقار**: اضغط "أضف عقارك" → املأ البيانات (العنوان بالعربي والإنجليزي، النوع، الموقع، التفاصيل، السعر، المرافق) → ارفع الصور → أرسل للمراجعة
2. **إدارة العقارات**: من لوحة التحكم → عقاراتي → شوف حالة كل عقار (مسودة، قيد المراجعة، نشط، غير نشط)
3. **طلبات الحجز**: من لوحة التحكم → طلبات الحجز → قبول أو رفض (مع ذكر السبب)
4. **الصيانة**: من لوحة التحكم → طلبات الصيانة → استلام الطلب → بدء العمل → إكمال الصيانة
5. **المدفوعات**: تابع مدفوعاتك وإيراداتك من تبويب المدفوعات
6. **التواصل**: رد على رسائل المستأجرين من قسم الرسائل

### لمدراء المنصة (Admins):
1. **لوحة الإدارة**: إحصائيات شاملة (عدد المستخدمين، العقارات، الحجوزات، الإيرادات)
2. **إدارة المستخدمين**: عرض جميع المستخدمين، تغيير الأدوار (مستخدم، مالك، مستأجر، مدير)
3. **الموافقة على العقارات**: مراجعة العقارات المعلقة → موافقة أو رفض
4. **إدارة الحجوزات**: عرض جميع الحجوزات ومتابعة حالتها
5. **قاعدة المعرفة**: إضافة وتعديل مقالات الأسئلة الشائعة والأدلة

### معلومات عامة:
- **العملة**: ريال سعودي (SAR)
- **رسوم الخدمة**: 5% من قيمة الإيجار
- **الحد الأدنى للإقامة**: يحدده المالك (عادة شهر واحد)
- **الحد الأقصى للإقامة**: يحدده المالك (عادة 12 شهر)
- **التأمين**: يحدده المالك (عادة إيجار شهر واحد)
- **المدن المتاحة**: الرياض، جدة، الدمام، مكة المكرمة، المدينة المنورة، الخبر، أبها، تبوك، وغيرها
- **أنواع العقارات**: شقة، فيلا، استوديو، دوبلكس، غرفة مفروشة، كمباوند، شقة فندقية
- **اللغات**: عربي (افتراضي) وإنجليزي — يمكن التبديل من أيقونة الكرة الأرضية في الشريط العلوي

## قواعد الرد:
1. رد بشكل مختصر ومفيد — لا تطول بدون فائدة
2. إذا السؤال عن شيء خارج المنصة، قل "هذا خارج نطاق تخصصي، أنا متخصص في منصة إيجار فقط"
3. إذا المستخدم يحتاج مساعدة تقنية، وجهه للخطوات بالتفصيل
4. استخدم أمثلة عملية عند الشرح
5. إذا المستخدم غاضب أو محبط، تعامل بلطف واحترافية
6. لا تخترع معلومات — إذا ما تعرف قل "ما عندي معلومة عن هذا، تواصل مع الدعم"`;

export async function getAiResponse(
  userId: number,
  conversationId: number,
  userMessage: string,
  userRole: string,
) {
  // Get conversation history
  const history = await db.getAiMessages(conversationId);

  // Get relevant knowledge base articles
  const kbArticles = await db.searchKnowledgeBase(userMessage);
  
  // Build context with knowledge base
  let contextAddition = "";
  if (kbArticles.length > 0) {
    contextAddition = "\n\n## معلومات إضافية من قاعدة المعرفة:\n";
    for (const article of kbArticles.slice(0, 3)) {
      contextAddition += `### ${article.titleAr}\n${article.contentAr}\n\n`;
    }
  }

  // Add role-specific context
  let roleContext = "";
  if (userRole === "tenant") {
    roleContext = "\n\nالمستخدم الحالي هو مستأجر. ركز على إرشادات المستأجرين.";
  } else if (userRole === "landlord") {
    roleContext = "\n\nالمستخدم الحالي هو مالك عقار. ركز على إرشادات الملاك.";
  } else if (userRole === "admin") {
    roleContext = "\n\nالمستخدم الحالي هو مدير المنصة. ركز على إرشادات الإدارة.";
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT + contextAddition + roleContext },
  ];

  // Add conversation history (last 20 messages for context)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  const response = await invokeLLM({ messages });
  
  const assistantContent = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : (response.choices[0].message.content as any[]).map((c: any) => c.text || "").join("");

  return assistantContent;
}

export async function seedDefaultKnowledgeBase() {
  const existing = await db.getAllKnowledgeArticles();
  if (existing.length > 0) return; // Already seeded

  const articles = [
    {
      category: "faq" as const,
      titleEn: "How to search for a property?",
      titleAr: "كيف أبحث عن عقار؟",
      contentEn: "Go to the Search page from the navigation bar. Use filters to narrow down by city, price range, property type, number of bedrooms/bathrooms, and furnishing level. You can switch between grid and list views, or use the map view to find properties by location.",
      contentAr: "اذهب لصفحة البحث من شريط التنقل. استخدم الفلاتر للتصفية حسب المدينة، نطاق السعر، نوع العقار، عدد الغرف/الحمامات، ومستوى التأثيث. يمكنك التبديل بين عرض الشبكة والقائمة، أو استخدام عرض الخريطة للبحث حسب الموقع.",
      tags: ["search", "filter", "بحث", "فلتر"],
    },
    {
      category: "faq" as const,
      titleEn: "How to book a property?",
      titleAr: "كيف أحجز عقار؟",
      contentEn: "1. Find a property you like. 2. Click 'Book Now'. 3. Select your move-in date and duration. 4. Review the cost breakdown (rent + deposit + 5% service fee). 5. Confirm your booking. The landlord will review and approve/reject your request.",
      contentAr: "1. ابحث عن عقار يعجبك. 2. اضغط 'احجز الآن'. 3. اختر تاريخ الدخول والمدة. 4. راجع تفاصيل التكلفة (إيجار + تأمين + رسوم خدمة 5%). 5. أكد الحجز. المالك سيراجع ويوافق أو يرفض طلبك.",
      tags: ["booking", "حجز", "إيجار"],
    },
    {
      category: "faq" as const,
      titleEn: "How to submit a maintenance request?",
      titleAr: "كيف أرسل طلب صيانة؟",
      contentEn: "Go to your Dashboard > Maintenance tab > New Request. Select the property, choose a category (plumbing, electrical, HVAC, etc.), set priority level, describe the issue, and attach photos if needed.",
      contentAr: "اذهب للوحة التحكم > تبويب الصيانة > طلب جديد. اختر العقار، اختر الفئة (سباكة، كهرباء، تكييف، إلخ)، حدد مستوى الأولوية، اوصف المشكلة، وأرفق صور إذا لزم الأمر.",
      tags: ["maintenance", "صيانة", "طلب"],
    },
    {
      category: "tenant_guide" as const,
      titleEn: "Tenant Guide: Getting Started",
      titleAr: "دليل المستأجر: البداية",
      contentEn: "Welcome to Ijar! As a tenant, you can: 1) Search and filter properties across Saudi cities. 2) Save favorites for later. 3) Book properties with a simple 4-step process. 4) Communicate with landlords via messaging. 5) Submit maintenance requests. 6) Track your payments and bookings from your dashboard.",
      contentAr: "مرحباً بك في إيجار! كمستأجر، يمكنك: 1) البحث وتصفية العقارات في مدن سعودية مختلفة. 2) حفظ المفضلات. 3) حجز العقارات بعملية من 4 خطوات. 4) التواصل مع الملاك عبر الرسائل. 5) إرسال طلبات صيانة. 6) متابعة مدفوعاتك وحجوزاتك من لوحة التحكم.",
      tags: ["tenant", "guide", "مستأجر", "دليل"],
    },
    {
      category: "landlord_guide" as const,
      titleEn: "Landlord Guide: Listing Your Property",
      titleAr: "دليل المالك: إدراج عقارك",
      contentEn: "To list a property: 1) Click 'Add Property' in the navbar. 2) Fill in details in Arabic and English. 3) Set pricing (monthly rent, security deposit). 4) Upload high-quality photos. 5) Set amenities and house rules. 6) Submit for admin review. Once approved, your property will be visible to tenants.",
      contentAr: "لإدراج عقار: 1) اضغط 'أضف عقارك' في شريط التنقل. 2) املأ التفاصيل بالعربي والإنجليزي. 3) حدد الأسعار (الإيجار الشهري، التأمين). 4) ارفع صور عالية الجودة. 5) حدد المرافق وقواعد السكن. 6) أرسل للمراجعة. بعد الموافقة، سيظهر عقارك للمستأجرين.",
      tags: ["landlord", "listing", "مالك", "إدراج"],
    },
    {
      category: "admin_guide" as const,
      titleEn: "Admin Guide: Managing the Platform",
      titleAr: "دليل المدير: إدارة المنصة",
      contentEn: "As an admin: 1) Review platform statistics from the dashboard. 2) Manage users and assign roles. 3) Approve or reject property listings. 4) Monitor bookings and resolve disputes. 5) Manage the knowledge base for the AI assistant.",
      contentAr: "كمدير: 1) راجع إحصائيات المنصة من لوحة التحكم. 2) أدر المستخدمين وعيّن الأدوار. 3) وافق أو ارفض إدراجات العقارات. 4) تابع الحجوزات وحل النزاعات. 5) أدر قاعدة المعرفة للمساعد الذكي.",
      tags: ["admin", "management", "مدير", "إدارة"],
    },
    {
      category: "policy" as const,
      titleEn: "Cancellation Policy",
      titleAr: "سياسة الإلغاء",
      contentEn: "Bookings can be cancelled before the landlord approves. After approval, cancellation is subject to the lease terms. Security deposits are refundable upon move-out inspection. Service fees are non-refundable.",
      contentAr: "يمكن إلغاء الحجوزات قبل موافقة المالك. بعد الموافقة، يخضع الإلغاء لشروط العقد. التأمين قابل للاسترداد بعد فحص المغادرة. رسوم الخدمة غير قابلة للاسترداد.",
      tags: ["cancellation", "policy", "إلغاء", "سياسة"],
    },
    {
      category: "troubleshooting" as const,
      titleEn: "Common Issues and Solutions",
      titleAr: "مشاكل شائعة وحلولها",
      contentEn: "Can't find properties? Try expanding your search filters. Booking rejected? Contact the landlord via messaging. Payment issues? Check your payment method. Can't upload photos? Ensure files are under 5MB and in JPG/PNG format.",
      contentAr: "ما تلقى عقارات؟ جرب توسع فلاتر البحث. الحجز مرفوض؟ تواصل مع المالك عبر الرسائل. مشكلة في الدفع؟ تأكد من طريقة الدفع. ما تقدر ترفع صور؟ تأكد إن الملفات أقل من 5 ميقا وبصيغة JPG أو PNG.",
      tags: ["troubleshooting", "issues", "مشاكل", "حلول"],
    },
  ];

  for (const article of articles) {
    await db.createKnowledgeArticle(article);
  }
}
