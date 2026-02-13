import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Language = "ar" | "en";

const translations = {
  ar: {
    // Navigation
    "nav.home": "الرئيسية",
    "nav.search": "البحث",
    "nav.properties": "العقارات",
    "nav.dashboard": "لوحة التحكم",
    "nav.messages": "الرسائل",
    "nav.notifications": "الإشعارات",
    "nav.profile": "الملف الشخصي",
    "nav.login": "تسجيل الدخول",
    "nav.logout": "تسجيل الخروج",
    "nav.listProperty": "أضف عقارك",

    // Hero
    "hero.title": "ابحث عن سكنك الشهري المثالي",
    "hero.subtitle": "منصة إيجار تربط المستأجرين بأفضل العقارات للإيجار الشهري في المملكة العربية السعودية",
    "hero.searchPlaceholder": "ابحث بالمدينة أو الحي...",
    "hero.cta": "ابدأ البحث",

    // Property types
    "type.apartment": "شقة",
    "type.villa": "فيلا",
    "type.studio": "استوديو",
    "type.duplex": "دوبلكس",
    "type.furnished_room": "غرفة مفروشة",
    "type.compound": "مجمع سكني",
    "type.hotel_apartment": "شقة فندقية",

    // Search & Filters
    "search.title": "البحث عن عقار",
    "search.city": "المدينة",
    "search.district": "الحي",
    "search.propertyType": "نوع العقار",
    "search.priceRange": "نطاق السعر",
    "search.minPrice": "الحد الأدنى",
    "search.maxPrice": "الحد الأعلى",
    "search.bedrooms": "غرف النوم",
    "search.bathrooms": "دورات المياه",
    "search.furnished": "مستوى التأثيث",
    "search.unfurnished": "غير مفروش",
    "search.semi_furnished": "شبه مفروش",
    "search.fully_furnished": "مفروش بالكامل",
    "search.results": "نتائج البحث",
    "search.noResults": "لا توجد نتائج",
    "search.filters": "الفلاتر",
    "search.clearFilters": "مسح الفلاتر",
    "search.saveSearch": "حفظ البحث",
    "search.sortBy": "ترتيب حسب",
    "search.gridView": "عرض شبكي",
    "search.listView": "عرض قائمة",

    // Property details
    "property.monthlyRent": "الإيجار الشهري",
    "property.securityDeposit": "مبلغ التأمين",
    "property.size": "المساحة",
    "property.floor": "الطابق",
    "property.yearBuilt": "سنة البناء",
    "property.amenities": "المرافق",
    "property.utilities": "الخدمات المشمولة",
    "property.houseRules": "قوانين السكن",
    "property.location": "الموقع",
    "property.availability": "التوفر",
    "property.reviews": "التقييمات",
    "property.contactLandlord": "تواصل مع المالك",
    "property.bookNow": "احجز الآن",
    "property.requestBooking": "طلب حجز",
    "property.addToFavorites": "أضف للمفضلة",
    "property.removeFromFavorites": "إزالة من المفضلة",
    "property.share": "مشاركة",
    "property.report": "إبلاغ",
    "property.verified": "موثق",
    "property.featured": "مميز",
    "property.perMonth": "/ شهر",
    "property.sqm": "م²",
    "property.photos": "الصور",
    "property.description": "الوصف",
    "property.details": "التفاصيل",

    // Booking
    "booking.title": "تفاصيل الحجز",
    "booking.moveIn": "تاريخ الدخول",
    "booking.moveOut": "تاريخ الخروج",
    "booking.duration": "مدة الإيجار",
    "booking.months": "أشهر",
    "booking.totalCost": "التكلفة الإجمالية",
    "booking.confirm": "تأكيد الحجز",
    "booking.cancel": "إلغاء",
    "booking.pending": "قيد الانتظار",
    "booking.approved": "مقبول",
    "booking.rejected": "مرفوض",
    "booking.active": "نشط",
    "booking.completed": "مكتمل",
    "booking.cancelled": "ملغي",
    "booking.notes": "ملاحظات",

    // Dashboard
    "dashboard.tenant": "لوحة تحكم المستأجر",
    "dashboard.landlord": "لوحة تحكم المالك",
    "dashboard.admin": "لوحة تحكم المشرف",
    "dashboard.overview": "نظرة عامة",
    "dashboard.myProperties": "عقاراتي",
    "dashboard.myBookings": "حجوزاتي",
    "dashboard.myPayments": "مدفوعاتي",
    "dashboard.myMessages": "رسائلي",
    "dashboard.maintenance": "طلبات الصيانة",
    "dashboard.favorites": "المفضلة",
    "dashboard.analytics": "التحليلات",
    "dashboard.settings": "الإعدادات",
    "dashboard.users": "المستخدمون",
    "dashboard.allProperties": "جميع العقارات",
    "dashboard.allBookings": "جميع الحجوزات",
    "dashboard.revenue": "الإيرادات",
    "dashboard.occupancy": "نسبة الإشغال",
    "dashboard.totalUsers": "إجمالي المستخدمين",
    "dashboard.activeListings": "العقارات النشطة",
    "dashboard.pendingApproval": "بانتظار الموافقة",

    // Maintenance
    "maintenance.title": "طلب صيانة",
    "maintenance.newRequest": "طلب صيانة جديد",
    "maintenance.category": "الفئة",
    "maintenance.priority": "الأولوية",
    "maintenance.status": "الحالة",
    "maintenance.description": "الوصف",
    "maintenance.photos": "الصور",
    "maintenance.submit": "إرسال الطلب",
    "maintenance.submitted": "تم الإرسال",
    "maintenance.acknowledged": "تم الاستلام",
    "maintenance.in_progress": "قيد التنفيذ",
    "maintenance.completed": "مكتمل",
    "maintenance.cancelled": "ملغي",
    "maintenance.low": "منخفضة",
    "maintenance.medium": "متوسطة",
    "maintenance.high": "عالية",
    "maintenance.emergency": "طارئة",
    "maintenance.plumbing": "سباكة",
    "maintenance.electrical": "كهرباء",
    "maintenance.hvac": "تكييف",
    "maintenance.appliance": "أجهزة",
    "maintenance.structural": "هيكلي",
    "maintenance.pest_control": "مكافحة حشرات",
    "maintenance.cleaning": "تنظيف",
    "maintenance.other": "أخرى",

    // Messages
    "messages.title": "الرسائل",
    "messages.newMessage": "رسالة جديدة",
    "messages.typeMessage": "اكتب رسالتك...",
    "messages.send": "إرسال",
    "messages.noConversations": "لا توجد محادثات",

    // Payments
    "payment.title": "المدفوعات",
    "payment.rent": "إيجار",
    "payment.deposit": "تأمين",
    "payment.serviceFee": "رسوم خدمة",
    "payment.refund": "استرداد",
    "payment.pay": "ادفع الآن",
    "payment.history": "سجل المدفوعات",
    "payment.pending": "قيد الانتظار",
    "payment.completed": "مكتمل",
    "payment.failed": "فشل",
    "payment.sar": "ر.س",

    // Common
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.create": "إنشاء",
    "common.submit": "إرسال",
    "common.loading": "جاري التحميل...",
    "common.error": "حدث خطأ",
    "common.success": "تم بنجاح",
    "common.confirm": "تأكيد",
    "common.back": "رجوع",
    "common.next": "التالي",
    "common.previous": "السابق",
    "common.viewAll": "عرض الكل",
    "common.viewDetails": "عرض التفاصيل",
    "common.noData": "لا توجد بيانات",
    "common.actions": "الإجراءات",
    "common.status": "الحالة",
    "common.date": "التاريخ",
    "common.amount": "المبلغ",
    "common.total": "الإجمالي",
    "common.comingSoon": "قريباً",
    "common.language": "اللغة",
    "common.arabic": "العربية",
    "common.english": "English",

    // Auth
    "auth.login": "تسجيل الدخول",
    "auth.register": "إنشاء حساب",
    "auth.userId": "معرف المستخدم",
    "auth.password": "كلمة المرور",
    "auth.confirmPassword": "تأكيد كلمة المرور",
    "auth.displayName": "اسم العرض",
    "auth.fullName": "الاسم الكامل",
    "auth.email": "البريد الإلكتروني",
    "auth.phone": "رقم الجوال",
    "auth.loginBtn": "دخول",
    "auth.registerBtn": "تسجيل",
    "auth.noAccount": "ليس لديك حساب؟",
    "auth.hasAccount": "لديك حساب بالفعل؟",
    "auth.createAccount": "أنشئ حساباً",
    "auth.loginHere": "سجل دخولك",
    "auth.invalidCredentials": "بيانات الدخول غير صحيحة",
    "auth.userIdExists": "معرف المستخدم موجود مسبقاً",
    "auth.passwordMismatch": "كلمات المرور غير متطابقة",
    "auth.passwordTooShort": "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    "auth.welcomeBack": "مرحباً بعودتك",
    "auth.joinUs": "انضم إلينا",
    "auth.loginSubtitle": "سجل دخولك للوصول إلى حسابك",
    "auth.registerSubtitle": "أنشئ حسابك للبدء في استخدام المنصة",

    // Footer
    "footer.about": "عن إيجار",
    "footer.aboutText": "منصة إيجار هي المنصة الرائدة للتأجير الشهري في المملكة العربية السعودية",
    "footer.quickLinks": "روابط سريعة",
    "footer.support": "الدعم",
    "footer.contact": "اتصل بنا",
    "footer.terms": "الشروط والأحكام",
    "footer.privacy": "سياسة الخصوصية",
    "footer.faq": "الأسئلة الشائعة",
    "footer.rights": "جميع الحقوق محفوظة",

    // How it works
    "howItWorks.title": "كيف تعمل المنصة",
    "howItWorks.step1Title": "ابحث عن عقارك",
    "howItWorks.step1Desc": "تصفح مئات العقارات المتاحة للإيجار الشهري في جميع أنحاء المملكة",
    "howItWorks.step2Title": "احجز بسهولة",
    "howItWorks.step2Desc": "اختر العقار المناسب وقدم طلب الحجز أو احجز فوراً",
    "howItWorks.step3Title": "انتقل واستمتع",
    "howItWorks.step3Desc": "وقّع العقد إلكترونياً وادفع بأمان وانتقل إلى سكنك الجديد",

    // Cities
    "city.riyadh": "الرياض",
    "city.jeddah": "جدة",
    "city.dammam": "الدمام",
    "city.makkah": "مكة المكرمة",
    "city.madinah": "المدينة المنورة",
    "city.khobar": "الخبر",
    "city.tabuk": "تبوك",
    "city.abha": "أبها",

    // AI Assistant
    "ai.title": "إيجار الذكي",
    "ai.subtitle": "مساعدك الذكي لكل ما يخص المنصة",
    "ai.placeholder": "اكتب سؤالك هنا...",
    "ai.send": "إرسال",
    "ai.newChat": "محادثة جديدة",
    "ai.history": "المحادثات السابقة",
    "ai.thinking": "يفكر...",
    "ai.welcome": "مرحباً! أنا إيجار الذكي، مساعدك في منصة إيجار. كيف أقدر أساعدك اليوم؟",
    "ai.rateResponse": "قيّم الإجابة",
    "ai.rated": "شكراً لتقييمك!",
    "ai.error": "حدث خطأ، حاول مرة أخرى",
    "ai.deleteChat": "حذف المحادثة",
    "ai.noHistory": "لا توجد محادثات سابقة",
    "ai.knowledgeBase": "قاعدة المعرفة",
    "ai.addArticle": "إضافة مقال",
    "ai.editArticle": "تعديل المقال",
    "ai.category": "التصنيف",
  },
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.properties": "Properties",
    "nav.dashboard": "Dashboard",
    "nav.messages": "Messages",
    "nav.notifications": "Notifications",
    "nav.profile": "Profile",
    "nav.login": "Sign In",
    "nav.logout": "Sign Out",
    "nav.listProperty": "List Your Property",

    // Hero
    "hero.title": "Find Your Perfect Monthly Rental",
    "hero.subtitle": "Ijar connects tenants with the best monthly rental properties across Saudi Arabia",
    "hero.searchPlaceholder": "Search by city or district...",
    "hero.cta": "Start Searching",

    // Property types
    "type.apartment": "Apartment",
    "type.villa": "Villa",
    "type.studio": "Studio",
    "type.duplex": "Duplex",
    "type.furnished_room": "Furnished Room",
    "type.compound": "Compound",
    "type.hotel_apartment": "Hotel Apartment",

    // Search & Filters
    "search.title": "Search Properties",
    "search.city": "City",
    "search.district": "District",
    "search.propertyType": "Property Type",
    "search.priceRange": "Price Range",
    "search.minPrice": "Min Price",
    "search.maxPrice": "Max Price",
    "search.bedrooms": "Bedrooms",
    "search.bathrooms": "Bathrooms",
    "search.furnished": "Furnished Level",
    "search.unfurnished": "Unfurnished",
    "search.semi_furnished": "Semi Furnished",
    "search.fully_furnished": "Fully Furnished",
    "search.results": "Search Results",
    "search.noResults": "No results found",
    "search.filters": "Filters",
    "search.clearFilters": "Clear Filters",
    "search.saveSearch": "Save Search",
    "search.sortBy": "Sort By",
    "search.gridView": "Grid View",
    "search.listView": "List View",

    // Property details
    "property.monthlyRent": "Monthly Rent",
    "property.securityDeposit": "Security Deposit",
    "property.size": "Size",
    "property.floor": "Floor",
    "property.yearBuilt": "Year Built",
    "property.amenities": "Amenities",
    "property.utilities": "Included Utilities",
    "property.houseRules": "House Rules",
    "property.location": "Location",
    "property.availability": "Availability",
    "property.reviews": "Reviews",
    "property.contactLandlord": "Contact Landlord",
    "property.bookNow": "Book Now",
    "property.requestBooking": "Request Booking",
    "property.addToFavorites": "Add to Favorites",
    "property.removeFromFavorites": "Remove from Favorites",
    "property.share": "Share",
    "property.report": "Report",
    "property.verified": "Verified",
    "property.featured": "Featured",
    "property.perMonth": "/ month",
    "property.sqm": "sqm",
    "property.photos": "Photos",
    "property.description": "Description",
    "property.details": "Details",

    // Booking
    "booking.title": "Booking Details",
    "booking.moveIn": "Move-in Date",
    "booking.moveOut": "Move-out Date",
    "booking.duration": "Lease Duration",
    "booking.months": "months",
    "booking.totalCost": "Total Cost",
    "booking.confirm": "Confirm Booking",
    "booking.cancel": "Cancel",
    "booking.pending": "Pending",
    "booking.approved": "Approved",
    "booking.rejected": "Rejected",
    "booking.active": "Active",
    "booking.completed": "Completed",
    "booking.cancelled": "Cancelled",
    "booking.notes": "Notes",

    // Dashboard
    "dashboard.tenant": "Tenant Dashboard",
    "dashboard.landlord": "Landlord Dashboard",
    "dashboard.admin": "Admin Dashboard",
    "dashboard.overview": "Overview",
    "dashboard.myProperties": "My Properties",
    "dashboard.myBookings": "My Bookings",
    "dashboard.myPayments": "My Payments",
    "dashboard.myMessages": "My Messages",
    "dashboard.maintenance": "Maintenance",
    "dashboard.favorites": "Favorites",
    "dashboard.analytics": "Analytics",
    "dashboard.settings": "Settings",
    "dashboard.users": "Users",
    "dashboard.allProperties": "All Properties",
    "dashboard.allBookings": "All Bookings",
    "dashboard.revenue": "Revenue",
    "dashboard.occupancy": "Occupancy",
    "dashboard.totalUsers": "Total Users",
    "dashboard.activeListings": "Active Listings",
    "dashboard.pendingApproval": "Pending Approval",

    // Maintenance
    "maintenance.title": "Maintenance Request",
    "maintenance.newRequest": "New Maintenance Request",
    "maintenance.category": "Category",
    "maintenance.priority": "Priority",
    "maintenance.status": "Status",
    "maintenance.description": "Description",
    "maintenance.photos": "Photos",
    "maintenance.submit": "Submit Request",
    "maintenance.submitted": "Submitted",
    "maintenance.acknowledged": "Acknowledged",
    "maintenance.in_progress": "In Progress",
    "maintenance.completed": "Completed",
    "maintenance.cancelled": "Cancelled",
    "maintenance.low": "Low",
    "maintenance.medium": "Medium",
    "maintenance.high": "High",
    "maintenance.emergency": "Emergency",
    "maintenance.plumbing": "Plumbing",
    "maintenance.electrical": "Electrical",
    "maintenance.hvac": "HVAC",
    "maintenance.appliance": "Appliance",
    "maintenance.structural": "Structural",
    "maintenance.pest_control": "Pest Control",
    "maintenance.cleaning": "Cleaning",
    "maintenance.other": "Other",

    // Messages
    "messages.title": "Messages",
    "messages.newMessage": "New Message",
    "messages.typeMessage": "Type your message...",
    "messages.send": "Send",
    "messages.noConversations": "No conversations yet",

    // Payments
    "payment.title": "Payments",
    "payment.rent": "Rent",
    "payment.deposit": "Deposit",
    "payment.serviceFee": "Service Fee",
    "payment.refund": "Refund",
    "payment.pay": "Pay Now",
    "payment.history": "Payment History",
    "payment.pending": "Pending",
    "payment.completed": "Completed",
    "payment.failed": "Failed",
    "payment.sar": "SAR",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.submit": "Submit",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.success": "Success",
    "common.confirm": "Confirm",
    "common.back": "Back",
    "common.next": "Next",
    "common.previous": "Previous",
    "common.viewAll": "View All",
    "common.viewDetails": "View Details",
    "common.noData": "No data available",
    "common.actions": "Actions",
    "common.status": "Status",
    "common.date": "Date",
    "common.amount": "Amount",
    "common.total": "Total",
    "common.comingSoon": "Coming Soon",
    "common.language": "Language",
    "common.arabic": "العربية",
    "common.english": "English",

    // Auth
    "auth.login": "Sign In",
    "auth.register": "Create Account",
    "auth.userId": "User ID",
    "auth.password": "Password",
    "auth.confirmPassword": "Confirm Password",
    "auth.displayName": "Display Name",
    "auth.fullName": "Full Name",
    "auth.email": "Email",
    "auth.phone": "Mobile Number",
    "auth.loginBtn": "Sign In",
    "auth.registerBtn": "Register",
    "auth.noAccount": "Don't have an account?",
    "auth.hasAccount": "Already have an account?",
    "auth.createAccount": "Create one",
    "auth.loginHere": "Sign in",
    "auth.invalidCredentials": "Invalid credentials",
    "auth.userIdExists": "User ID already exists",
    "auth.passwordMismatch": "Passwords do not match",
    "auth.passwordTooShort": "Password must be at least 6 characters",
    "auth.welcomeBack": "Welcome Back",
    "auth.joinUs": "Join Us",
    "auth.loginSubtitle": "Sign in to access your account",
    "auth.registerSubtitle": "Create your account to get started",

    // Footer
    "footer.about": "About Ijar",
    "footer.aboutText": "Ijar is the leading monthly rental platform in Saudi Arabia",
    "footer.quickLinks": "Quick Links",
    "footer.support": "Support",
    "footer.contact": "Contact Us",
    "footer.terms": "Terms & Conditions",
    "footer.privacy": "Privacy Policy",
    "footer.faq": "FAQ",
    "footer.rights": "All rights reserved",

    // How it works
    "howItWorks.title": "How It Works",
    "howItWorks.step1Title": "Find Your Property",
    "howItWorks.step1Desc": "Browse hundreds of properties available for monthly rent across Saudi Arabia",
    "howItWorks.step2Title": "Book Easily",
    "howItWorks.step2Desc": "Choose the right property and submit a booking request or book instantly",
    "howItWorks.step3Title": "Move In & Enjoy",
    "howItWorks.step3Desc": "Sign the contract digitally, pay securely, and move into your new home",

    // Cities
    "city.riyadh": "Riyadh",
    "city.jeddah": "Jeddah",
    "city.dammam": "Dammam",
    "city.makkah": "Makkah",
    "city.madinah": "Madinah",
    "city.khobar": "Khobar",
    "city.tabuk": "Tabuk",
    "city.abha": "Abha",

    // AI Assistant
    "ai.title": "Ijar AI",
    "ai.subtitle": "Your smart assistant for everything on the platform",
    "ai.placeholder": "Type your question here...",
    "ai.send": "Send",
    "ai.newChat": "New Chat",
    "ai.history": "Chat History",
    "ai.thinking": "Thinking...",
    "ai.welcome": "Hello! I'm Ijar AI, your assistant on the Ijar platform. How can I help you today?",
    "ai.rateResponse": "Rate this response",
    "ai.rated": "Thanks for your rating!",
    "ai.error": "An error occurred, please try again",
    "ai.deleteChat": "Delete Chat",
    "ai.noHistory": "No previous conversations",
    "ai.knowledgeBase": "Knowledge Base",
    "ai.addArticle": "Add Article",
    "ai.editArticle": "Edit Article",
    "ai.category": "Category",
  },
} as const;

type TranslationKey = keyof typeof translations.ar;

interface I18nContextType {
  lang: Language;
  dir: "rtl" | "ltr";
  t: (key: TranslationKey) => string;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("ijar-lang");
    return (saved === "en" ? "en" : "ar") as Language;
  });

  const dir = lang === "ar" ? "rtl" : "ltr";

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("ijar-lang", newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "ar" ? "en" : "ar");
  }, [lang, setLang]);

  const t = useCallback((key: TranslationKey): string => {
    return (translations[lang] as any)[key] ?? key;
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  return (
    <I18nContext.Provider value={{ lang, dir, t, setLang, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
