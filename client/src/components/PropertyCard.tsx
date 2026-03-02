import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, MapPin, BedDouble, Bath, Maximize2, CheckCircle, Building2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { normalizeImageUrl } from "@/lib/image-utils";

/**
 * PropertyCard — public listing card.
 *
 * P0 FIX: Added strong bottom gradient scrim (45% height, 80% opacity)
 * that is ALWAYS visible regardless of image brightness.
 * Text uses text-shadow for extra legibility. All text/badges sit at z-10
 * above the scrim (z-[5]).
 */

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

  // Simple image: use R2 photo if available
  const originalPhoto = property.photos?.[0];
  const imgSrc = originalPhoto ? normalizeImageUrl(originalPhoto) : "";

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
        {/* ── Image Container ── */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-muted">
          {/* No-photo placeholder */}
          {!imgSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              <Building2 className="h-12 w-12 text-[#3ECFC0]/40 mb-2" />
              <span className="text-xs text-muted-foreground/60 font-medium">
                {lang === "ar" ? "صورة قريباً" : "Photo coming soon"}
              </span>
            </div>
          )}

          {/* Direct img — visible immediately */}
          {imgSrc && (
            <img
              src={imgSrc}
              alt={title}
              loading="eager"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
                console.error(`[PropertyCard] Image failed to load: ${imgSrc}`);
              }}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          )}

          {/* Error fallback (hidden by default) */}
          {imgSrc && (
            <div style={{ display: "none" }} className="absolute inset-0 flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
              <Building2 className="h-10 w-10 text-amber-500/60 mb-1" />
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                {lang === "ar" ? "فشل تحميل الصورة" : "Image failed to load"}
              </span>
            </div>
          )}

          {/* ── SCRIM OVERLAY — always visible, not dependent on hover ── */}
          {/* Bottom gradient: covers lower 50% of image, strong enough for any brightness */}
          <div
            className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none z-[5]"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.15) 75%, transparent 100%)",
            }}
          />
          {/* Top subtle vignette for top badges */}
          <div
            className="absolute inset-x-0 top-0 h-[30%] pointer-events-none z-[5]"
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)",
            }}
          />

          {/* ── Top Badges — z-10 above scrim ── */}
          <div className="absolute top-3 start-3 flex gap-1.5 z-10">
            {property.isVerified && (
              <Badge className="bg-[#3ECFC0] text-[#0B1E2D] text-[10px] gap-1 border-0 shadow-md font-semibold">
                <CheckCircle className="h-3 w-3" />
                {t("property.verified")}
              </Badge>
            )}
            {property.isFeatured && (
              <Badge className="bg-[#C9A96E] text-[#0B1E2D] text-[10px] border-0 shadow-md font-semibold">
                {t("property.featured")}
              </Badge>
            )}
          </div>

          {/* ── Favorite button — z-10 ── */}
          <button
            onClick={handleFavorite}
            className="absolute top-3 end-3 z-10 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-110 active:scale-90 transition-all duration-300 shadow-md"
          >
            <Heart
              className={`h-4 w-4 transition-all duration-300 ${
                favCheck.data?.isFavorite ? "fill-red-500 text-red-500 scale-110" : "text-gray-500"
              }`}
            />
          </button>

          {/* ── Manager overlay — z-10 ── */}
          {property.managerName && (
            <div className="absolute top-3 end-14 z-10 flex items-center gap-1.5 bg-white/90 dark:bg-black/60 backdrop-blur-sm rounded-full ps-2 pe-1 py-0.5 shadow-md">
              <span className="text-[10px] font-medium text-[#0B1E2D] dark:text-white max-w-[80px] truncate">
                {lang === "ar" ? (property.managerNameAr || property.managerName) : property.managerName}
              </span>
              {property.managerPhotoUrl ? (
                <img src={normalizeImageUrl(property.managerPhotoUrl)} alt="" className="w-6 h-6 rounded-full object-cover border border-[#3ECFC0]/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
              ) : null}
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br from-[#3ECFC0] to-[#2ab5a6] flex items-center justify-center text-white text-[8px] font-bold select-none ${property.managerPhotoUrl ? 'hidden' : ''}`}>
                {(property.managerName || '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'PM'}
              </div>
            </div>
          )}

          {/* ── Photo count badge — z-10 ── */}
          {property.photos && property.photos.length > 1 && (
            <div
              className="absolute bottom-3 end-3 z-10 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-md"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
              <span>+{property.photos.length}</span>
            </div>
          )}

          {/* ── Price tag — z-10, strong contrast ── */}
          <div
            className="absolute bottom-3 start-3 z-10 bg-[#0B1E2D]/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg group-hover:shadow-[#3ECFC0]/20 group-hover:shadow-xl transition-all duration-500"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
          >
            <span className="font-bold text-[#3ECFC0] text-base sm:text-lg tracking-tight">
              {Number(property.monthlyRent).toLocaleString()} {t("payment.sar")}
            </span>
            <span className="text-white text-xs ms-1 font-medium">{t("property.perMonth")}</span>
          </div>
        </div>

        {/* ── Content below image ── */}
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
