import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, MapPin, BedDouble, Bath, Maximize2, CheckCircle, UserCog } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface PropertyCardProps {
  property: {
    id: number;
    titleEn: string;
    titleAr: string;
    propertyType: string;
    city?: string | null;
    cityAr?: string | null;
    district?: string | null;
    districtAr?: string | null;
    monthlyRent: string;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sizeSqm?: number | null;
    photos?: string[] | null;
    isVerified?: boolean | null;
    isFeatured?: boolean | null;
    furnishedLevel?: string | null;
    managerName?: string | null;
    managerNameAr?: string | null;
    managerPhotoUrl?: string | null;
  };
  compact?: boolean;
}

export default function PropertyCard({ property, compact }: PropertyCardProps) {
  const { t, lang } = useI18n();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const favCheck = trpc.favorite.check.useQuery(
    { propertyId: property.id },
    { enabled: isAuthenticated }
  );
  const toggleFav = trpc.favorite.toggle.useMutation({
    onSuccess: () => {
      utils.favorite.check.invalidate({ propertyId: property.id });
      utils.favorite.list.invalidate();
    },
  });

  const title = lang === "ar" ? property.titleAr : property.titleEn;
  const city = lang === "ar" ? property.cityAr : property.city;
  const district = lang === "ar" ? property.districtAr : property.district;
  const typeKey = `type.${property.propertyType}` as any;
  const photo = property.photos?.[0] || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop";

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error(lang === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please sign in first");
      return;
    }
    toggleFav.mutate({ propertyId: property.id });
  };

  return (
    <Link href={`/property/${property.id}`}>
      <Card className="group overflow-hidden hover:shadow-xl hover:shadow-[#3ECFC0]/10 transition-all duration-500 cursor-pointer border-border/50 py-0 gap-0 bg-white hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={photo}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
          {/* Badges */}
          <div className="absolute top-3 start-3 flex gap-1.5">
            {property.isVerified && (
              <Badge className="bg-[#3ECFC0] text-[#0B1E2D] text-[10px] gap-1 border-0">
                <CheckCircle className="h-3 w-3" />
                {t("property.verified")}
              </Badge>
            )}
            {property.isFeatured && (
              <Badge className="bg-[#C9A96E] text-[#0B1E2D] text-[10px] border-0">
                {t("property.featured")}
              </Badge>
            )}
          </div>
          {/* Favorite */}
          <button
            onClick={handleFavorite}
            className="absolute top-3 end-3 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white hover:scale-110 active:scale-95 transition-all duration-300"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                favCheck.data?.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"
              }`}
            />
          </button>
          {/* Manager overlay */}
          {property.managerName && (
            <div className="absolute top-3 end-12 flex items-center gap-1.5 bg-white/90 backdrop-blur rounded-full ps-2 pe-1 py-0.5 shadow-sm">
              <span className="text-[10px] font-medium text-[#0B1E2D] max-w-[80px] truncate">
                {lang === "ar" ? (property.managerNameAr || property.managerName) : property.managerName}
              </span>
              {property.managerPhotoUrl ? (
                <img src={property.managerPhotoUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-[#3ECFC0]/30" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#3ECFC0]/20 flex items-center justify-center">
                  <UserCog className="h-3 w-3 text-[#3ECFC0]" />
                </div>
              )}
            </div>
          )}
          {/* Price tag */}
          <div className="absolute bottom-2 sm:bottom-3 start-2 sm:start-3 bg-[#0B1E2D]/90 backdrop-blur rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-sm group-hover:bg-[#0B1E2D] transition-colors duration-300">
            <span className="font-bold text-[#3ECFC0] text-base sm:text-lg">
              {Number(property.monthlyRent).toLocaleString()} {t("payment.sar")}
            </span>
            <span className="text-white/60 text-xs ms-1">{t("property.perMonth")}</span>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-3 sm:p-4">
          <div className="mb-2">
            <Badge variant="secondary" className="text-[10px] mb-2 bg-[#3ECFC0]/10 text-[#3ECFC0] border-0">
              {t(typeKey)}
            </Badge>
            <h3 className="font-heading font-semibold text-sm line-clamp-1 group-hover:text-[#3ECFC0] transition-colors">
              {title}
            </h3>
          </div>

          {(city || district) && (
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-3">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">
                {district && `${district}، `}{city}
              </span>
            </div>
          )}

          {!compact && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-3 border-t border-border/50">
              {property.bedrooms != null && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" />
                  {property.bedrooms}
                </span>
              )}
              {property.bathrooms != null && (
                <span className="flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5" />
                  {property.bathrooms}
                </span>
              )}
              {property.sizeSqm != null && (
                <span className="flex items-center gap-1">
                  <Maximize2 className="h-3.5 w-3.5" />
                  {property.sizeSqm} {t("property.sqm")}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
