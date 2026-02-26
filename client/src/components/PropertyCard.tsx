import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, MapPin, BedDouble, Bath, Maximize2, CheckCircle, Building2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

// Helper: wrap external URLs through our image proxy to avoid CORS/CSP issues
function proxyUrl(url: string): string {
  if (!url) return "";
  // Already a relative URL or data URL — leave as-is
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  // External URL — proxy through our server
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

// Reliable fallback images by property type (CDN via proxy)
const FALLBACK_IMAGES: Record<string, string> = {
  apartment: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/sKmnJUKXqXLRtgLT.jpg"),
  villa: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/aQahktKcFBRaoOks.jpg"),
  studio: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/mONAuqBKEeQxVXtD.jpg"),
  duplex: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/sKmnJUKXqXLRtgLT.jpg"),
  furnished_room: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/CmMNTcoDQOUOOgeL.jpg"),
  compound: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/bzChzmxFKBEOPglq.jpg"),
  hotel_apartment: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/sKmnJUKXqXLRtgLT.jpg"),
  default: proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/sKmnJUKXqXLRtgLT.jpg"),
};

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

  const fallbackImg = FALLBACK_IMAGES[property.propertyType] || FALLBACK_IMAGES.default;
  const originalPhoto = property.photos?.[0];
  // Proxy all external URLs; skip broken /uploads/ paths
  const resolvedPhoto = originalPhoto
    ? originalPhoto.includes("/uploads/")
      ? "" // broken Railway upload — skip
      : originalPhoto.startsWith("http")
        ? proxyUrl(originalPhoto)
        : originalPhoto
    : "";

  const [imgSrc, setImgSrc] = useState(resolvedPhoto || fallbackImg);
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">("loading");

  const handleLoad = useCallback(() => {
    setImgStatus("loaded");
  }, []);

  const handleError = useCallback(() => {
    if (imgSrc !== fallbackImg) {
      setImgSrc(fallbackImg);
      setImgStatus("loading");
    } else {
      setImgStatus("error");
    }
  }, [imgSrc, fallbackImg]);

  // Safety timeout
  useEffect(() => {
    if (imgStatus !== "loading") return;
    const timer = setTimeout(() => {
      if (imgStatus === "loading") {
        if (imgSrc !== fallbackImg) {
          setImgSrc(fallbackImg);
        } else {
          setImgStatus("error");
        }
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [imgStatus, imgSrc, fallbackImg]);

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
      <Card className="property-card group overflow-hidden cursor-pointer border-border/40 py-0 gap-0 bg-white dark:bg-card rounded-xl">
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-muted">
          {/* Skeleton shimmer while loading */}
          {imgStatus === "loading" && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted/70 to-muted" />
          )}
          {/* Clean error fallback — building icon, no broken image icon */}
          {imgStatus === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              <Building2 className="h-12 w-12 text-[#3ECFC0]/40 mb-2" />
              <span className="text-xs text-muted-foreground/60 font-medium">
                {lang === "ar" ? "صورة قريباً" : "Photo coming soon"}
              </span>
            </div>
          )}
          <img
            src={imgSrc}
            alt={title}
            loading="lazy"
            decoding="async"
            width={400}
            height={300}
            onLoad={handleLoad}
            onError={handleError}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 ${imgStatus === "loaded" ? "opacity-100" : "opacity-0"}`}
          />
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40 group-hover:opacity-70 transition-opacity duration-500" />

          {/* Badges */}
          <div className="absolute top-3 start-3 flex gap-1.5">
            {property.isVerified && (
              <Badge className="bg-[#3ECFC0] text-[#0B1E2D] text-[10px] gap-1 border-0 shadow-sm">
                <CheckCircle className="h-3 w-3" />
                {t("property.verified")}
              </Badge>
            )}
            {property.isFeatured && (
              <Badge className="bg-[#C9A96E] text-[#0B1E2D] text-[10px] border-0 shadow-sm">
                {t("property.featured")}
              </Badge>
            )}
          </div>

          {/* Favorite */}
          <button
            onClick={handleFavorite}
            className="absolute top-3 end-3 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-110 active:scale-90 transition-all duration-300 shadow-sm"
          >
            <Heart
              className={`h-4 w-4 transition-all duration-300 ${
                favCheck.data?.isFavorite ? "fill-red-500 text-red-500 scale-110" : "text-gray-500"
              }`}
            />
          </button>

          {/* Manager overlay */}
          {property.managerName && (
            <div className="absolute top-3 end-14 flex items-center gap-1.5 bg-white/90 dark:bg-black/60 backdrop-blur-sm rounded-full ps-2 pe-1 py-0.5 shadow-sm">
              <span className="text-[10px] font-medium text-[#0B1E2D] dark:text-white max-w-[80px] truncate">
                {lang === "ar" ? (property.managerNameAr || property.managerName) : property.managerName}
              </span>
              {property.managerPhotoUrl ? (
                <img src={property.managerPhotoUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-[#3ECFC0]/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
              ) : null}
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br from-[#3ECFC0] to-[#2ab5a6] flex items-center justify-center text-white text-[8px] font-bold select-none ${property.managerPhotoUrl ? 'hidden' : ''}`}>
                {(property.managerName || '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'PM'}
              </div>
            </div>
          )}

          {/* Photo count badge */}
          {property.photos && property.photos.length > 1 && (
            <div className="absolute bottom-3 end-3 z-10 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
              <span>+{property.photos.length}</span>
            </div>
          )}

          {/* Price tag */}
          <div className="absolute bottom-3 start-3 bg-[#0B1E2D]/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg group-hover:shadow-[#3ECFC0]/20 group-hover:shadow-xl transition-all duration-500">
            <span className="font-bold text-[#3ECFC0] text-base sm:text-lg tracking-tight">
              {Number(property.monthlyRent).toLocaleString()} {t("payment.sar")}
            </span>
            <span className="text-white/80 text-xs ms-1">{t("property.perMonth")}</span>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-3.5 sm:p-4">
          <div className="mb-2">
            <Badge variant="secondary" className="text-[10px] mb-2 bg-[#3ECFC0]/10 text-[#3ECFC0] border-0 dark:bg-[#3ECFC0]/20">
              {t(typeKey)}
            </Badge>
            <h3 className="font-heading font-semibold text-sm line-clamp-1 group-hover:text-[#3ECFC0] transition-colors duration-300">
              {title}
            </h3>
          </div>

          {(city || district) && (
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-3">
              <MapPin className="h-3 w-3 shrink-0 text-[#C9A96E]" />
              <span className="line-clamp-1">
                {district && `${district}، `}{city}
              </span>
            </div>
          )}

          {!compact && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/30">
              {property.bedrooms != null && (
                <span className="flex items-center gap-1.5 group-hover:text-[#3ECFC0] transition-colors duration-300">
                  <BedDouble className="h-3.5 w-3.5" />
                  <span className="font-medium">{property.bedrooms}</span>
                </span>
              )}
              {property.bathrooms != null && (
                <span className="flex items-center gap-1.5 group-hover:text-[#3ECFC0] transition-colors duration-300">
                  <Bath className="h-3.5 w-3.5" />
                  <span className="font-medium">{property.bathrooms}</span>
                </span>
              )}
              {property.sizeSqm != null && (
                <span className="flex items-center gap-1.5 group-hover:text-[#3ECFC0] transition-colors duration-300">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="font-medium">{property.sizeSqm} {t("property.sqm")}</span>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
