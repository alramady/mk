import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart, Share2, MapPin, BedDouble, Bath, Maximize2, Building, Calendar,
  CheckCircle, Star, MessageSquare, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  Wifi, Car, Dumbbell, Shield, Wind, Droplets, Zap, Flame, Tv, Shirt
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";

const amenityIcons: Record<string, any> = {
  wifi: Wifi, parking: Car, gym: Dumbbell, security: Shield,
  ac: Wind, water: Droplets, electricity: Zap, gas: Flame,
  tv: Tv, laundry: Shirt,
};

export default function PropertyDetail() {
  const { t, lang, dir } = useI18n();
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/property/:id");
  const [, setLocation] = useLocation();
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const mapRef = useRef<google.maps.Map | null>(null);

  const id = Number(params?.id);
  const property = trpc.property.getById.useQuery({ id }, { enabled: !!id });
  const reviews = trpc.property.getReviews.useQuery({ propertyId: id }, { enabled: !!id });
  const favCheck = trpc.favorite.check.useQuery({ propertyId: id }, { enabled: isAuthenticated && !!id });
  const toggleFav = trpc.favorite.toggle.useMutation({
    onSuccess: () => {
      trpc.useUtils().favorite.check.invalidate({ propertyId: id });
    },
  });

  const prop = property.data;
  if (property.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8 space-y-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">{lang === "ar" ? "العقار غير موجود" : "Property not found"}</p>
          <Button className="mt-4" onClick={() => setLocation("/search")}>{t("common.back")}</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const title = lang === "ar" ? prop.titleAr : prop.titleEn;
  const description = lang === "ar" ? prop.descriptionAr : prop.descriptionEn;
  const city = lang === "ar" ? prop.cityAr : prop.city;
  const district = lang === "ar" ? prop.districtAr : prop.district;
  const photos = prop.photos?.length ? prop.photos : [
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop",
  ];

  const lat = prop.latitude ? Number(prop.latitude) : 24.7136;
  const lng = prop.longitude ? Number(prop.longitude) : 46.6753;

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="container py-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => setLocation("/search")} className="mb-4">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo gallery */}
            <div className="relative rounded-xl overflow-hidden aspect-[16/10]">
              <img
                src={photos[currentPhoto]}
                alt={title}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhoto(p => (p - 1 + photos.length) % photos.length)}
                    className="absolute start-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                  >
                    {dir === "rtl" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setCurrentPhoto(p => (p + 1) % photos.length)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                  >
                    {dir === "rtl" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  <div className="absolute bottom-3 start-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPhoto(i)}
                        className={`h-2 rounded-full transition-all ${i === currentPhoto ? "w-6 bg-white" : "w-2 bg-white/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Actions */}
              <div className="absolute top-3 end-3 flex gap-2">
                <button
                  onClick={() => {
                    if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول" : "Please sign in"); return; }
                    toggleFav.mutate({ propertyId: id });
                  }}
                  className="h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                >
                  <Heart className={`h-5 w-5 ${favCheck.data?.isFavorite ? "fill-destructive text-destructive" : ""}`} />
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied"); }}
                  className="h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
              {/* Badges */}
              <div className="absolute top-3 start-3 flex gap-2">
                {prop.isVerified && (
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <CheckCircle className="h-3 w-3" /> {t("property.verified")}
                  </Badge>
                )}
              </div>
            </div>

            {/* Title & Location */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="secondary" className="mb-2">{t(`type.${prop.propertyType}` as any)}</Badge>
                  <h1 className="text-2xl font-heading font-bold">{title}</h1>
                </div>
                {reviews.data && reviews.data.avgRating > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="h-5 w-5 fill-[#C9A96E] text-[#C9A96E]" />
                    <span className="font-semibold">{Number(reviews.data.avgRating).toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">({reviews.data.reviews.length})</span>
                  </div>
                )}
              </div>
              {(city || district) && (
                <div className="flex items-center gap-1 text-muted-foreground mt-2">
                  <MapPin className="h-4 w-4" />
                  <span>{district && `${district}، `}{city}</span>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {prop.bedrooms != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <BedDouble className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("search.bedrooms")}</div><div className="font-semibold">{prop.bedrooms}</div></div>
                </CardContent></Card>
              )}
              {prop.bathrooms != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Bath className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("search.bathrooms")}</div><div className="font-semibold">{prop.bathrooms}</div></div>
                </CardContent></Card>
              )}
              {prop.sizeSqm != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Maximize2 className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("property.size")}</div><div className="font-semibold">{prop.sizeSqm} {t("property.sqm")}</div></div>
                </CardContent></Card>
              )}
              {prop.floor != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Building className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("property.floor")}</div><div className="font-semibold">{prop.floor}</div></div>
                </CardContent></Card>
              )}
            </div>

            {/* Description */}
            {description && (
              <Card>
                <CardHeader><CardTitle>{t("property.description")}</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{description}</p></CardContent>
              </Card>
            )}

            {/* Amenities */}
            {prop.amenities && prop.amenities.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t("property.amenities")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {prop.amenities.map((amenity, i) => {
                      const Icon = amenityIcons[amenity.toLowerCase()] || CheckCircle;
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                          <span>{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Map */}
            <Card>
              <CardHeader><CardTitle>{t("property.location")}</CardTitle></CardHeader>
              <CardContent>
                <MapView
                  className="h-[300px] rounded-lg"
                  initialCenter={{ lat, lng }}
                  initialZoom={15}
                  onMapReady={(map) => {
                    mapRef.current = map;
                    new google.maps.marker.AdvancedMarkerElement({
                      map,
                      position: { lat, lng },
                      title: title,
                    });
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Booking card */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <Card className="shadow-lg">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-primary font-heading">
                      {Number(prop.monthlyRent).toLocaleString()} {t("payment.sar")}
                    </div>
                    <span className="text-muted-foreground text-sm">{t("property.perMonth")}</span>
                  </div>

                  <Separator />

                  {prop.securityDeposit && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("property.securityDeposit")}</span>
                      <span className="font-medium">{Number(prop.securityDeposit).toLocaleString()} {t("payment.sar")}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{lang === "ar" ? "الحد الأدنى للإقامة" : "Min Stay"}</span>
                    <span className="font-medium">{prop.minStayMonths} {t("booking.months")}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{lang === "ar" ? "الحد الأقصى للإقامة" : "Max Stay"}</span>
                    <span className="font-medium">{prop.maxStayMonths} {t("booking.months")}</span>
                  </div>

                  {prop.furnishedLevel && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("search.furnished")}</span>
                      <span className="font-medium">{t(`search.${prop.furnishedLevel}` as any)}</span>
                    </div>
                  )}

                  <Separator />

                  <Button
                    className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold"
                    size="lg"
                    onClick={() => {
                      if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please sign in first"); return; }
                      setLocation(`/book/${id}`);
                    }}
                  >
                    {prop.instantBook ? t("property.bookNow") : t("property.requestBooking")}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please sign in first"); return; }
                      setLocation(`/messages?to=${prop.landlordId}&property=${id}`);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 me-2" />
                    {t("property.contactLandlord")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
