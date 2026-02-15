import { useState } from "react";
import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";

export default function ContactUs() {
  const { lang, t } = useI18n();
  const isAr = lang === "ar";
  const { get } = useSiteSettings();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success(
        isAr ? "تم إرسال رسالتك بنجاح" : "Message sent successfully",
        { description: isAr ? "سنتواصل معك في أقرب وقت ممكن" : "We'll get back to you as soon as possible" }
      );
    },
    onError: (err) => {
      toast.error(isAr ? "حدث خطأ" : "Error", { description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate(form);
  };

  const email = get("footer.email");
  const phone = get("footer.phone");
  const address = get(isAr ? "footer.addressAr" : "footer.addressEn");

  const contactInfo = [
    {
      icon: Mail,
      label: isAr ? "البريد الإلكتروني" : "Email",
      value: email || (isAr ? "أضف من لوحة التحكم" : "Add from CMS"),
      href: email ? `mailto:${email}` : undefined,
    },
    {
      icon: Phone,
      label: isAr ? "الهاتف" : "Phone",
      value: phone || (isAr ? "أضف من لوحة التحكم" : "Add from CMS"),
      href: phone ? `tel:${phone}` : undefined,
    },
    {
      icon: MapPin,
      label: isAr ? "العنوان" : "Address",
      value:
        address ||
        (isAr
          ? "المملكة العربية السعودية"
          : "Kingdom of Saudi Arabia"),
    },
    {
      icon: Clock,
      label: isAr ? "ساعات العمل" : "Working Hours",
      value: isAr
        ? "الأحد - الخميس: 9 ص - 6 م"
        : "Sun - Thu: 9 AM - 6 PM",
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <SEOHead
        title="Contact Us"
        titleAr="تواصل معنا"
        description="Contact المفتاح الشهري team for inquiries about monthly rentals in Saudi Arabia"
        path="/contact"
      />
      <Navbar />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#0A1628] via-[#0F2035] to-[#0A1628] pt-28 pb-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-[#3ECFC0] rounded-full blur-[120px]" />
          <div className="absolute bottom-10 right-1/4 w-56 h-56 bg-[#3ECFC0] rounded-full blur-[100px]" />
        </div>
        <div className="container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-[#3ECFC0]/10 border border-[#3ECFC0]/20 rounded-full px-4 py-1.5 mb-6">
            <MessageSquare className="w-4 h-4 text-[#3ECFC0]" />
            <span className="text-[#3ECFC0] text-sm font-medium">
              {isAr ? "نحن هنا لمساعدتك" : "We're here to help"}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {isAr ? "تواصل معنا" : "Contact Us"}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {isAr
              ? "لديك سؤال أو استفسار؟ فريقنا جاهز لمساعدتك. أرسل لنا رسالة وسنرد عليك في أقرب وقت."
              : "Have a question or inquiry? Our team is ready to help. Send us a message and we'll get back to you soon."}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-5 gap-8">
            {/* Contact Info Cards */}
            <div className="md:col-span-2 space-y-4">
              {contactInfo.map((item, i) => (
                <Card
                  key={i}
                  className="border-border/50 bg-card hover:border-[#3ECFC0]/30 transition-colors"
                >
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#3ECFC0]/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-[#3ECFC0]" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {item.label}
                      </p>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="text-foreground font-medium hover:text-[#3ECFC0] transition-colors"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-foreground font-medium">
                          {item.value}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Map placeholder */}
              <Card className="border-border/50 bg-card overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-[#0A1628] to-[#0F2035] flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 text-[#3ECFC0] mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">
                      {isAr
                        ? "المملكة العربية السعودية"
                        : "Kingdom of Saudi Arabia"}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-3">
              <Card className="border-border/50 bg-card">
                <CardContent className="p-6 md:p-8">
                  {submitted ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        {isAr
                          ? "تم إرسال رسالتك بنجاح!"
                          : "Message Sent Successfully!"}
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        {isAr
                          ? "شكراً لتواصلك معنا. سنرد عليك في أقرب وقت ممكن."
                          : "Thank you for reaching out. We'll get back to you as soon as possible."}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSubmitted(false);
                          setForm({
                            name: "",
                            email: "",
                            phone: "",
                            subject: "",
                            message: "",
                          });
                        }}
                      >
                        {isAr ? "إرسال رسالة أخرى" : "Send Another Message"}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-foreground mb-6">
                        {isAr ? "أرسل لنا رسالة" : "Send Us a Message"}
                      </h2>
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                              {isAr ? "الاسم الكامل" : "Full Name"} *
                            </label>
                            <Input
                              required
                              minLength={2}
                              value={form.name}
                              onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                              }
                              placeholder={
                                isAr ? "أدخل اسمك" : "Enter your name"
                              }
                              className="bg-background"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                              {isAr ? "البريد الإلكتروني" : "Email"} *
                            </label>
                            <Input
                              required
                              type="email"
                              value={form.email}
                              onChange={(e) =>
                                setForm({ ...form, email: e.target.value })
                              }
                              placeholder={
                                isAr
                                  ? "example@email.com"
                                  : "example@email.com"
                              }
                              className="bg-background"
                            />
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                              {isAr ? "رقم الهاتف" : "Phone"}{" "}
                              <span className="text-muted-foreground text-xs">
                                ({isAr ? "اختياري" : "optional"})
                              </span>
                            </label>
                            <Input
                              type="tel"
                              value={form.phone}
                              onChange={(e) =>
                                setForm({ ...form, phone: e.target.value })
                              }
                              placeholder="+966 5XX XXX XXXX"
                              className="bg-background"
                              dir="ltr"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                              {isAr ? "الموضوع" : "Subject"} *
                            </label>
                            <Input
                              required
                              minLength={3}
                              value={form.subject}
                              onChange={(e) =>
                                setForm({ ...form, subject: e.target.value })
                              }
                              placeholder={
                                isAr
                                  ? "موضوع الرسالة"
                                  : "Message subject"
                              }
                              className="bg-background"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">
                            {isAr ? "الرسالة" : "Message"} *
                          </label>
                          <Textarea
                            required
                            minLength={10}
                            value={form.message}
                            onChange={(e) =>
                              setForm({ ...form, message: e.target.value })
                            }
                            placeholder={
                              isAr
                                ? "اكتب رسالتك هنا..."
                                : "Write your message here..."
                            }
                            className="min-h-[120px] bg-background"
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            disabled={submitMutation.isPending}
                            className="gap-2"
                          >
                            {submitMutation.isPending ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {isAr ? "إرسال الرسالة" : "Send Message"}
                          </Button>
                        </div>
                      </form>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
