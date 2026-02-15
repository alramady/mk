import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { HelpCircle, ChevronDown, Search } from "lucide-react";
import { useState, useMemo } from "react";

interface FAQItem {
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
  category?: string;
}

const defaultFAQs: FAQItem[] = [
  {
    questionAr: "ما هي منصة المفتاح الشهري؟",
    questionEn: "What is المفتاح الشهري?",
    answerAr: "المفتاح الشهري هي منصة سعودية متخصصة في الإيجار الشهري للعقارات. نربط المستأجرين بأفضل العقارات المتاحة للإيجار الشهري في المملكة العربية السعودية، مع توفير تجربة حجز سهلة وآمنة.",
    answerEn: "المفتاح الشهري is a Saudi platform specializing in monthly property rentals. We connect tenants with the best available properties for monthly rent across Saudi Arabia, providing an easy and secure booking experience.",
    category: "general",
  },
  {
    questionAr: "ما هي مدة الإيجار المتاحة؟",
    questionEn: "What rental durations are available?",
    answerAr: "نوفر إيجارات شهرية مرنة تبدأ من شهر واحد وحتى شهرين كحد أقصى. هذا يتيح لك المرونة في اختيار المدة المناسبة دون الالتزام بعقود سنوية طويلة.",
    answerEn: "We offer flexible monthly rentals starting from 1 month up to a maximum of 2 months. This gives you the flexibility to choose the right duration without committing to long annual contracts.",
    category: "rental",
  },
  {
    questionAr: "كيف يمكنني حجز عقار؟",
    questionEn: "How can I book a property?",
    answerAr: "يمكنك حجز عقار بسهولة من خلال: 1) البحث عن العقار المناسب في المدينة المطلوبة، 2) اختيار تاريخ البداية ومدة الإيجار، 3) إتمام عملية الدفع عبر PayPal أو التحويل البنكي، 4) استلام تأكيد الحجز وتفاصيل العقار.",
    answerEn: "You can easily book a property by: 1) Searching for a suitable property in your desired city, 2) Selecting the start date and rental duration, 3) Completing payment via PayPal or bank transfer, 4) Receiving booking confirmation and property details.",
    category: "booking",
  },
  {
    questionAr: "ما هي طرق الدفع المتاحة؟",
    questionEn: "What payment methods are available?",
    answerAr: "نقبل الدفع عبر PayPal (بطاقات الائتمان والخصم المباشر) والتحويل البنكي المباشر. جميع المعاملات المالية مؤمنة ومشفرة لحماية بياناتك.",
    answerEn: "We accept payments via PayPal (credit and debit cards) and direct bank transfer. All financial transactions are secured and encrypted to protect your data.",
    category: "payment",
  },
  {
    questionAr: "هل يوجد تأمين على العقار؟",
    questionEn: "Is there a property deposit/insurance?",
    answerAr: "نعم، يتم احتساب تأمين بنسبة 10% من قيمة الإيجار الشهري. يُسترد التأمين بالكامل عند انتهاء فترة الإيجار وتسليم العقار بحالته الأصلية.",
    answerEn: "Yes, a deposit of 10% of the monthly rent is required. The deposit is fully refundable upon lease completion and returning the property in its original condition.",
    category: "payment",
  },
  {
    questionAr: "هل المنصة مرخصة من وزارة السياحة؟",
    questionEn: "Is the platform licensed by the Ministry of Tourism?",
    answerAr: "نعم، المفتاح الشهري مرخصة من وزارة السياحة في المملكة العربية السعودية ومسجلة في منصة إيجار التابعة لوزارة الإسكان. نلتزم بجميع الأنظمة واللوائح المعمول بها.",
    answerEn: "Yes, المفتاح الشهري is licensed by the Saudi Ministry of Tourism and registered on the Ejar platform under the Ministry of Housing. We comply with all applicable regulations and laws.",
    category: "legal",
  },
  {
    questionAr: "كيف تحمي المنصة بياناتي الشخصية؟",
    questionEn: "How does the platform protect my personal data?",
    answerAr: "نلتزم بنظام حماية البيانات الشخصية (PDPL) الصادر عن سدايا. نستخدم تشفير SSL لجميع البيانات، ولا نشارك معلوماتك مع أطراف ثالثة دون موافقتك. يمكنك الاطلاع على سياسة الخصوصية الكاملة من صفحة الخصوصية.",
    answerEn: "We comply with the Personal Data Protection Law (PDPL) issued by SDAIA. We use SSL encryption for all data and never share your information with third parties without your consent. You can view our full privacy policy on the Privacy page.",
    category: "legal",
  },
  {
    questionAr: "كيف يمكنني إدراج عقاري للإيجار؟",
    questionEn: "How can I list my property for rent?",
    answerAr: "يمكنك إدراج عقارك بسهولة من خلال: 1) إنشاء حساب كمالك عقار، 2) إضافة تفاصيل العقار والصور، 3) تحديد السعر الشهري والشروط، 4) نشر الإعلان بعد مراجعة الإدارة. يمكنك أيضاً طلب تعيين مدير عقار لإدارة عقارك.",
    answerEn: "You can easily list your property by: 1) Creating a property owner account, 2) Adding property details and photos, 3) Setting the monthly price and terms, 4) Publishing after admin review. You can also request a property manager to manage your property.",
    category: "landlord",
  },
  {
    questionAr: "ما هي رسوم الخدمة؟",
    questionEn: "What are the service fees?",
    answerAr: "رسوم الخدمة هي 5% من قيمة الإيجار الشهري، بالإضافة إلى ضريبة القيمة المضافة 15% المطبقة حسب أنظمة هيئة الزكاة والضريبة والجمارك.",
    answerEn: "The service fee is 5% of the monthly rent, plus 15% VAT as required by the Zakat, Tax and Customs Authority (ZATCA) regulations.",
    category: "payment",
  },
  {
    questionAr: "هل يمكنني طلب معاينة العقار قبل الحجز؟",
    questionEn: "Can I request a property viewing before booking?",
    answerAr: "نعم، يمكنك طلب معاينة العقار من خلال صفحة العقار. سيتم تنسيق موعد المعاينة مع مدير العقار المسؤول وستتلقى تأكيداً بالموعد.",
    answerEn: "Yes, you can request a property viewing through the property page. The viewing appointment will be coordinated with the responsible property manager and you will receive a confirmation.",
    category: "booking",
  },
  {
    questionAr: "ماذا أفعل إذا واجهت مشكلة في العقار؟",
    questionEn: "What should I do if I encounter a problem with the property?",
    answerAr: "يمكنك تقديم طلب صيانة من لوحة التحكم الخاصة بك. سيتم إرسال الطلب مباشرة لمدير العقار للمتابعة. كما يمكنك التواصل معنا عبر الواتساب للحالات الطارئة.",
    answerEn: "You can submit a maintenance request from your dashboard. The request will be sent directly to the property manager for follow-up. You can also contact us via WhatsApp for emergencies.",
    category: "general",
  },
  {
    questionAr: "هل يمكنني إلغاء الحجز؟",
    questionEn: "Can I cancel my booking?",
    answerAr: "نعم، يمكن إلغاء الحجز وفقاً لسياسة الإلغاء المحددة في شروط الخدمة. الإلغاء قبل 48 ساعة من تاريخ البدء يتيح استرداد كامل المبلغ. بعد ذلك، قد يتم خصم رسوم إلغاء.",
    answerEn: "Yes, bookings can be cancelled according to the cancellation policy outlined in our Terms of Service. Cancellation 48 hours before the start date allows a full refund. After that, cancellation fees may apply.",
    category: "booking",
  },
];

const categories = [
  { id: "all", labelAr: "الكل", labelEn: "All" },
  { id: "general", labelAr: "عام", labelEn: "General" },
  { id: "booking", labelAr: "الحجز", labelEn: "Booking" },
  { id: "payment", labelAr: "الدفع", labelEn: "Payment" },
  { id: "rental", labelAr: "الإيجار", labelEn: "Rental" },
  { id: "landlord", labelAr: "الملاك", labelEn: "Landlords" },
  { id: "legal", labelAr: "قانوني", labelEn: "Legal" },
];

export default function FAQ() {
  const { lang, dir } = useI18n();
  const { get: s } = useSiteSettings();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  // Load CMS FAQ items, fallback to defaults
  const cmsFaqRaw = s("faq.items");
  const faqItems: FAQItem[] = useMemo(() => {
    if (cmsFaqRaw && cmsFaqRaw !== "[]") {
      try {
        const parsed = JSON.parse(cmsFaqRaw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* fallback */ }
    }
    return defaultFAQs;
  }, [cmsFaqRaw]);

  // Filter by search and category
  const filteredFAQs = useMemo(() => {
    return faqItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      if (!searchQuery.trim()) return matchesCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.questionAr.toLowerCase().includes(q) ||
        item.questionEn.toLowerCase().includes(q) ||
        item.answerAr.toLowerCase().includes(q) ||
        item.answerEn.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [faqItems, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir={dir}>
      <SEOHead
        title="FAQ"
        titleAr="الأسئلة الشائعة"
        description="Frequently asked questions about monthly rentals in Saudi Arabia"
        path="/faq"
      />
      <Navbar />

      {/* Hero */}
      <section className="bg-[#0B1E2D] text-white py-16 sm:py-20">
        <div className="container text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#3ECFC0]/20 mb-6">
            <HelpCircle className="h-8 w-8 text-[#3ECFC0]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-heading mb-4">
            {lang === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            {lang === "ar"
              ? "إجابات على أكثر الأسئلة شيوعاً حول خدماتنا ومنصتنا"
              : "Answers to the most common questions about our services and platform"}
          </p>
        </div>
      </section>

      <main className="flex-1 py-10 sm:py-14">
        <div className="container max-w-4xl">
          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" style={{ [lang === "ar" ? "right" : "left"]: "1rem" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "ar" ? "ابحث في الأسئلة الشائعة..." : "Search FAQs..."}
              className="w-full py-3.5 bg-white border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#3ECFC0]/40 focus:border-[#3ECFC0] transition-all"
              style={{ [lang === "ar" ? "paddingRight" : "paddingLeft"]: "3rem", [lang === "ar" ? "paddingLeft" : "paddingRight"]: "1rem" }}
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-[#3ECFC0] text-[#0B1E2D]"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-[#3ECFC0] hover:text-[#3ECFC0]"
                }`}
              >
                {lang === "ar" ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-3">
            {filteredFAQs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">
                  {lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching results"}
                </p>
              </div>
            ) : (
              filteredFAQs.map((item, idx) => {
                const isOpen = openIndex === idx;
                const question = lang === "ar" ? item.questionAr : item.questionEn;
                const answer = lang === "ar" ? item.answerAr : item.answerEn;
                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-xl border transition-all ${
                      isOpen ? "border-[#3ECFC0] shadow-md" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-5 text-start"
                    >
                      <span className={`font-semibold text-base ${isOpen ? "text-[#0B1E2D]" : "text-gray-700"}`}>
                        {question}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="p-5 pt-0 text-gray-600 leading-relaxed text-base -mt-2 animate-in fade-in duration-300 zoom-in-95">
                        <p>{answer}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
