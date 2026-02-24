import { Card, CardContent } from "@/components/ui/card";

export default function PropertyCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border/40 bg-white dark:bg-card rounded-xl py-0 gap-0 animate-pulse">
      {/* Image skeleton */}
      <div className="aspect-[4/3] bg-muted" />
      {/* Content skeleton */}
      <CardContent className="p-3.5 sm:p-4 space-y-3">
        <div className="space-y-2">
          <div className="h-4 w-16 bg-muted rounded-full" />
          <div className="h-5 w-3/4 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 bg-muted rounded-full" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-border/30">
          <div className="h-3.5 w-10 bg-muted rounded" />
          <div className="h-3.5 w-10 bg-muted rounded" />
          <div className="h-3.5 w-16 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertyCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}
