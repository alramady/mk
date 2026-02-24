import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Phone, Mail, MessageSquare, MapPin, Building2, Star,
  ArrowLeft, ArrowRight, UserCog, Briefcase, Clock
} from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function AgentProfile() {
  const { t, lang, dir } = useI18n();
  const [, params] = useRoute("/agent/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const [imgError, setImgError] = useState(false);

  const { data: manager, isLoading } = trpc.propertyManager.getWithProperties.useQuery(
    { id },
    { enabled: !!id }
  );

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Skeleton className="h-80 rounded-xl" />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <div className="grid grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-60" />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!manager) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <UserCog className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-lg">
            {lang === "ar" ? "الموظف غير موجود" : "Agent not found"}
          </p>
          <Button className="mt-4" onClick={() => setLocation("/search")}>
            {t("common.back")}
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const name = lang === "ar" ? (manager.nameAr || manager.name) : manager.name;
  const title = lang === "ar" ? (manager.titleAr || manager.title || "مدير العقار") : (manager.title || "Property Manager");
  const bio = lang === "ar" ? (manager.bioAr || manager.bio) : manager.bio;
  const properties = (manager as any).properties || [];
  const propertyCount = (manager as any).propertyCount || 0;
  const initials = getInitials(manager.name || manager.nameAr || "PM");
  const showPhoto = manager.photoUrl && !imgError;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <Navbar />

      <div className="container py-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        {/* Agent Header Card */}
        <Card className="mb-8 overflow-hidden border-0 shadow-lg">
          {/* Banner */}
          <div className="bg-gradient-to-r from-[#0B1E2D] to-[#153347] h-28 relative">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
            }} />
          </div>

          {/* Profile content - photo overlaps banner */}
          <CardContent className="px-6 pb-6 relative">
            <div className="flex flex-col md:flex-row items-start gap-5 -mt-14">
              {/* Photo */}
              <div className="shrink-0">
                {showPhoto ? (
                  <img
                    src={manager.photoUrl!}
                    alt={name}
                    onError={() => setImgError(true)}
                    className="w-28 h-28 rounded-xl object-cover border-4 border-white shadow-lg bg-white"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-[#3ECFC0] to-[#2ab5a6] flex items-center justify-center border-4 border-white shadow-lg text-white font-bold text-3xl select-none">
                    {initials}
                  </div>
                )}
              </div>

              {/* Info - always below the banner line */}
              <div className="flex-1 pt-16 md:pt-2">
                <h1 className="text-2xl font-heading font-bold text-[#0B1E2D]">{name}</h1>
                <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Briefcase className="h-4 w-4" />
                  {title}
                </p>
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <Badge variant="secondary" className="bg-[#3ECFC0]/10 text-[#3ECFC0] border-0 gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {propertyCount} {lang === "ar" ? "عقار" : "Properties"}
                  </Badge>
                </div>
              </div>

              {/* Contact Actions */}
              <div className="flex gap-2 flex-wrap pt-16 md:pt-2">
                {manager.phone && (
                  <a href={`tel:${manager.phone}`}>
                    <Button className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 gap-2 font-semibold">
                      <Phone className="h-4 w-4" />
                      {lang === "ar" ? "اتصل الآن" : "Call Now"}
                    </Button>
                  </a>
                )}
                {manager.whatsapp && (
                  <a href={`https://wa.me/${manager.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener">
                    <Button variant="outline" className="gap-2 border-green-500/30 text-green-600 hover:bg-green-50">
                      <MessageSquare className="h-4 w-4" />
                      {lang === "ar" ? "واتساب" : "WhatsApp"}
                    </Button>
                  </a>
                )}
                {manager.email && (
                  <a href={`mailto:${manager.email}`}>
                    <Button variant="outline" className="gap-2">
                      <Mail className="h-4 w-4" />
                      {lang === "ar" ? "بريد إلكتروني" : "Email"}
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Bio */}
            {bio && (
              <>
                <Separator className="my-5" />
                <div>
                  <h3 className="font-heading font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">
                    {lang === "ar" ? "نبذة" : "About"}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{bio}</p>
                </div>
              </>
            )}

            {/* Contact Info */}
            <Separator className="my-5" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {manager.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#3ECFC0]/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-[#3ECFC0]" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{lang === "ar" ? "الهاتف" : "Phone"}</div>
                    <a href={`tel:${manager.phone}`} className="text-sm font-medium hover:text-[#3ECFC0] transition-colors" dir="ltr">
                      {manager.phone}
                    </a>
                  </div>
                </div>
              )}
              {manager.email && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{lang === "ar" ? "البريد الإلكتروني" : "Email"}</div>
                    <a href={`mailto:${manager.email}`} className="text-sm font-medium hover:text-blue-500 transition-colors">
                      {manager.email}
                    </a>
                  </div>
                </div>
              )}
              {manager.whatsapp && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{lang === "ar" ? "واتساب" : "WhatsApp"}</div>
                    <a href={`https://wa.me/${manager.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener" className="text-sm font-medium hover:text-green-500 transition-colors" dir="ltr">
                      {manager.whatsapp}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Properties Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-5 w-5 text-[#3ECFC0]" />
            <h2 className="text-xl font-heading font-bold">
              {lang === "ar" ? "العقارات المُدارة" : "Managed Properties"}
            </h2>
            <Badge variant="secondary" className="ms-auto">
              {propertyCount} {lang === "ar" ? "عقار" : "listings"}
            </Badge>
          </div>

          {properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {properties.map((prop: any) => (
                <PropertyCard key={prop.id} property={prop} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {lang === "ar" ? "لا توجد عقارات مُعينة حالياً" : "No properties assigned yet"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
