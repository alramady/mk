import * as db from "./db";

const defaultSettings: Record<string, string> = {
  "site.nameAr": "المفتاح الشهري",
  "site.nameEn": "Monthly Key",
  "site.descriptionAr": "المفتاح الشهري تربط المستأجرين بأفضل العقارات للإيجار الشهري في المملكة العربية السعودية",
  "site.descriptionEn": "Monthly Key connects tenants with the best monthly rental properties across Saudi Arabia",
  "site.logoUrl": "",
  "site.faviconUrl": "",
  "site.primaryColor": "#3ECFC0",
  "site.accentColor": "#C9A96E",
  "hero.titleAr": "خبير الإيجار الشهري — الآن في السعودية",
  "hero.titleEn": "Monthly Rental Expert — Now in Saudi Arabia",
  "hero.subtitleAr": "إدارة إيجارات شهرية متميزة | الرياض • جدة • المدينة المنورة",
  "hero.subtitleEn": "Premium monthly rental management | Riyadh • Jeddah • Madinah",
  "hero.bgImage": "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=1920&q=80",
  "hero.bgType": "image",
  "hero.bgVideo": "",
  "hero.overlayOpacity": "40",
  "stats.properties": "500+",
  "stats.propertiesLabelAr": "عقار متاح",
  "stats.propertiesLabelEn": "Available Properties",
  "stats.tenants": "1000+",
  "stats.tenantsLabelAr": "مستأجر سعيد",
  "stats.tenantsLabelEn": "Happy Tenants",
  "stats.cities": "50+",
  "stats.citiesLabelAr": "مدينة",
  "stats.citiesLabelEn": "Cities",
  "stats.satisfaction": "98%",
  "stats.satisfactionLabelAr": "رضا العملاء",
  "stats.satisfactionLabelEn": "Customer Satisfaction",
  "fees.serviceFeePercent": "5",
  "fees.minRent": "500",
  "fees.maxRent": "100000",
  "fees.depositPercent": "10",
  "fees.depositMonths": "1",
  "fees.vatPercent": "15",
  "rental.minMonths": "1",
  "rental.maxMonths": "12",
  "rental.minMonthsLabelAr": "الحد الأدنى لمدة الإيجار (بالأشهر)",
  "rental.minMonthsLabelEn": "Minimum Rental Duration (months)",
  "rental.maxMonthsLabelAr": "الحد الأقصى لمدة الإيجار (بالأشهر)",
  "rental.maxMonthsLabelEn": "Maximum Rental Duration (months)",
  "footer.aboutAr": "المفتاح الشهري هي المنصة الرائدة للإيجار الشهري في المملكة العربية السعودية. نقدم حلول إيجار مرنة لتسهيل تجربة السكن الشهري.",
  "footer.aboutEn": "Monthly Key is Saudi Arabia's leading monthly rental platform. We offer flexible rental solutions for a seamless monthly living experience.",
  "footer.email": "",
  "footer.phone": "",
  "footer.addressAr": "الرياض، المملكة العربية السعودية",
  "footer.addressEn": "Riyadh, Saudi Arabia",
  "footer.twitter": "",
  "footer.instagram": "",
  "footer.linkedin": "",
  "whatsapp.enabled": "false",
  "whatsapp.number": "",
  "whatsapp.brandNameAr": "واتساب",
  "whatsapp.brandNameEn": "WhatsApp",
  "whatsapp.defaultMessageAr": "مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري",
  "whatsapp.defaultMessageEn": "Hello, I need help regarding monthly rental",
  "whatsapp.message": "مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري",
  "whatsapp.textAr": "تواصل معنا",
  "whatsapp.textEn": "Chat with us",
  "whatsapp.propertyMessageTemplateAr": "مرحباً، أنا مهتم بالعقار: {{property_title}} (رقم: {{property_id}}) في {{city}}. الرابط: {{url}}",
  "whatsapp.propertyMessageTemplateEn": "Hello, I'm interested in: {{property_title}} (ID: {{property_id}}) in {{city}}. Link: {{url}}",
  "whatsapp.homeMessageTemplateAr": "مرحباً، أبحث عن شقة للإيجار الشهري. أرجو مساعدتي.",
  "whatsapp.homeMessageTemplateEn": "Hello, I'm looking for a monthly rental apartment. Please help.",
  "whatsapp.searchMessageTemplateAr": "مرحباً، أبحث عن عقار للإيجار الشهري. هل يمكنكم مساعدتي في إيجاد خيارات مناسبة؟",
  "whatsapp.searchMessageTemplateEn": "Hello, I'm searching for a monthly rental property. Can you help me find suitable options?",
  "whatsapp.showOnHome": "true",
  "whatsapp.showOnSearch": "true",
  "whatsapp.showOnPropertyDetail": "true",
  "legal.tourismLicence": "",
  "legal.crNumber": "",
  "legal.vatNumber": "",
  "legal.ejarLicence": "",
  "terms.contentAr": "",
  "terms.contentEn": "",
  "privacy.contentAr": "",
  "privacy.contentEn": "",
  "faq.items": "[]",
  "maintenance.enabled": "false",
  "maintenance.titleAr": "قريباً... الانطلاق",
  "maintenance.titleEn": "Coming Soon",
  "maintenance.subtitleAr": "نعمل على تجهيز تجربة مميزة لكم",
  "maintenance.subtitleEn": "We're preparing an exceptional experience for you",
  "maintenance.messageAr": "ستكون رحلة مميزة معنا في عالم الإيجارات الشهرية. ترقبونا!",
  "maintenance.messageEn": "An exceptional journey awaits you in the world of monthly rentals. Stay tuned!",
  "maintenance.imageUrl": "",
  "maintenance.countdownDate": "",
  "maintenance.showCountdown": "false",
  "social.twitter": "",
  "social.instagram": "",
  "social.snapchat": "",
  "social.tiktok": "",
  "social.linkedin": "",
  "social.youtube": "",
  "calculator.allowedMonths": "[1,2]",
  "calculator.version": "1",
  "calculator.insuranceLabelAr": "التأمين",
  "calculator.insuranceLabelEn": "Insurance/Deposit",
  "calculator.serviceFeeLabelAr": "رسوم الخدمة",
  "calculator.serviceFeeLabelEn": "Service Fee",
  "calculator.vatLabelAr": "ضريبة القيمة المضافة",
  "calculator.vatLabelEn": "VAT",
  "calculator.insuranceTooltipAr": "مبلغ تأمين قابل للاسترداد عند انتهاء العقد",
  "calculator.insuranceTooltipEn": "Refundable security deposit returned at end of lease",
  "calculator.serviceFeeTooltipAr": "رسوم إدارة المنصة لتسهيل عملية التأجير",
  "calculator.serviceFeeTooltipEn": "Platform management fee for facilitating the rental",
  "calculator.vatTooltipAr": "ضريبة القيمة المضافة وفقاً لنظام هيئة الزكاة والضريبة والجمارك",
  "calculator.vatTooltipEn": "Value Added Tax as per ZATCA regulations",
  "ai.enabled": "true",
  "ai.name": "المفتاح الشهري الذكي",
  "ai.nameEn": "Monthly Key AI",
  "ai.personality": "professional_friendly",
  "ai.welcomeMessage": "مرحباً! أنا المفتاح الشهري الذكي، كيف أقدر أساعدك؟",
  "ai.welcomeMessageEn": "Hello! I'm Monthly Key AI, how can I help you?",
  "ai.customInstructions": "",
  "ai.maxResponseLength": "800",
  "payment.enabled": "false",
  "payment.cashEnabled": "true",
  "payment.currency": "SAR",
  "payment.paypalClientId": "",
  "payment.paypalSecret": "",
  "payment.paypalMode": "sandbox",
  // Moyasar payment gateway defaults (Saudi Arabia)
  "moyasar.publishableKey": "",
  "moyasar.secretKey": "",
  "moyasar.webhookSecret": "",
  "moyasar.mode": "test",
  "moyasar.enabled": "false",
  "moyasar.enableMadaCards": "true",
  "moyasar.enableApplePay": "true",
  "moyasar.enableGooglePay": "true",
};

/**
 * Seeds only missing settings — does NOT overwrite existing values.
 * Safe to call on every server startup.
 */
export async function seedDefaultSettings() {
  try {
    const existing = await db.getAllSettings();
    const missing: Record<string, string> = {};
    let count = 0;

    for (const [key, value] of Object.entries(defaultSettings)) {
      if (!(key in existing)) {
        missing[key] = value;
        count++;
      }
    }

    if (count > 0) {
      await db.bulkSetSettings(missing);
      console.log(`[Seed] Seeded ${count} missing default settings`);
    } else {
      console.log("[Seed] All default settings already exist");
    }
  } catch (err) {
    console.error("[Seed] Failed to seed default settings:", err);
  }
}
