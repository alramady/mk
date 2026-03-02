/**
 * MAP COMPONENT - Dual Provider Support
 *
 * Supports two map providers:
 * 1. Google Maps - when VITE_GOOGLE_MAPS_API_KEY env var is set
 * 2. Leaflet/OpenStreetMap - free fallback when no API key
 *
 * To enable Google Maps:
 * 1. Get an API key from https://console.cloud.google.com/apis/credentials
 * 2. Enable "Maps JavaScript API" in Google Cloud Console
 * 3. Add VITE_GOOGLE_MAPS_API_KEY=your_key to Railway environment variables
 * 4. Redeploy
 *
 * The component auto-detects which provider to use based on the env var.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Provider Detection
// ============================================================
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const USE_GOOGLE_MAPS = !!GOOGLE_MAPS_API_KEY;

// ============================================================
// Unified Map Interface
// ============================================================
export interface MapInstance {
  provider: "google" | "leaflet";
  google?: google.maps.Map;
  leaflet?: any; // L.Map
  setCenter: (lat: number, lng: number) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: { north: number; south: number; east: number; west: number }) => void;
  addMarker: (lat: number, lng: number, options?: MarkerOptions) => any;
  removeAllMarkers: () => void;
  onMarkerClick: (marker: any, callback: () => void) => void;
  addPopup: (marker: any, content: string) => void;
}

export interface MarkerOptions {
  color?: string;
  label?: string;
  title?: string;
  icon?: string;
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: MapInstance) => void;
}

// ============================================================
// Google Maps Loader
// ============================================================
let googleMapsLoaded = false;
let googleMapsLoading = false;
const googleMapsCallbacks: (() => void)[] = [];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (googleMapsLoaded) {
      resolve();
      return;
    }
    googleMapsCallbacks.push(resolve);
    if (googleMapsLoading) return;
    googleMapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,marker&language=ar&region=SA`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsLoaded = true;
      googleMapsCallbacks.forEach((cb) => cb());
      googleMapsCallbacks.length = 0;
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps API. Falling back to Leaflet.");
      googleMapsLoading = false;
      googleMapsCallbacks.forEach((cb) => cb());
      googleMapsCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

// ============================================================
// Leaflet Loader (dynamic import)
// ============================================================
let leafletModule: any = null;

async function loadLeaflet() {
  if (leafletModule) return leafletModule;
  const L = await import("leaflet");
  await import("leaflet/dist/leaflet.css");

  // Fix default marker icons (broken with bundlers)
  const markerIcon2x = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
  const markerIcon = (await import("leaflet/dist/images/marker-icon.png")).default;
  const markerShadow = (await import("leaflet/dist/images/marker-shadow.png")).default;

  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  leafletModule = L;
  return L;
}

export function getLeafletModule() {
  return leafletModule;
}

// ============================================================
// Create Unified Map Instance - Google Maps
// ============================================================
function createGoogleMapInstance(map: google.maps.Map): MapInstance {
  const markers: google.maps.marker.AdvancedMarkerElement[] = [];

  return {
    provider: "google",
    google: map,
    setCenter(lat, lng) {
      map.setCenter({ lat, lng });
    },
    setZoom(zoom) {
      map.setZoom(zoom);
    },
    fitBounds(bounds) {
      map.fitBounds(new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east }
      ));
    },
    addMarker(lat, lng, options = {}) {
      const { color = "#3ECFC0", label = "", title = "" } = options;

      const pinEl = document.createElement("div");
      pinEl.style.cssText = `
        background: ${color};
        color: #fff;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        font-family: Tajawal, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        cursor: pointer;
        white-space: nowrap;
        border: 2px solid #fff;
        text-align: center;
      `;
      pinEl.textContent = label || title;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng },
        content: pinEl,
        title,
      });
      markers.push(marker);
      return marker;
    },
    removeAllMarkers() {
      markers.forEach((m) => (m.map = null));
      markers.length = 0;
    },
    onMarkerClick(marker, callback) {
      marker.addListener("click", callback);
    },
    addPopup(marker, content) {
      const infoWindow = new google.maps.InfoWindow({ content });
      marker.addListener("click", () => {
        infoWindow.open({ anchor: marker, map });
      });
    },
  };
}

// ============================================================
// Create Unified Map Instance - Leaflet
// ============================================================
function createLeafletMapInstance(map: any, L: any): MapInstance {
  const markers: any[] = [];

  return {
    provider: "leaflet",
    leaflet: map,
    setCenter(lat, lng) {
      map.setView([lat, lng]);
    },
    setZoom(zoom) {
      map.setZoom(zoom);
    },
    fitBounds(bounds) {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]);
    },
    addMarker(lat, lng, options = {}) {
      const { color = "#3ECFC0", label = "", title = "" } = options;
      const icon = L.divIcon({
        className: "custom-map-marker",
        html: `
          <div style="
            background: ${color};
            color: #fff;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            font-family: Tajawal, sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            cursor: pointer;
            white-space: nowrap;
            border: 2px solid #fff;
            text-align: center;
            display: inline-block;
          ">${label || title}</div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const marker = L.marker([lat, lng], { icon, title }).addTo(map);
      markers.push(marker);
      return marker;
    },
    removeAllMarkers() {
      markers.forEach((m) => map.removeLayer(m));
      markers.length = 0;
    },
    onMarkerClick(marker, callback) {
      marker.on("click", callback);
    },
    addPopup(marker, content) {
      marker.bindPopup(content, {
        className: "custom-leaflet-popup",
        maxWidth: 300,
      });
    },
  };
}

// ============================================================
// MapView Component
// ============================================================
export function MapView({
  className,
  initialCenter = { lat: 24.7136, lng: 46.6753 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerUsed, setProviderUsed] = useState<"google" | "leaflet" | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    let cancelled = false;

    async function initMap() {
      if (!containerRef.current) return;

      // Try Google Maps first if API key is available
      if (USE_GOOGLE_MAPS) {
        try {
          await loadGoogleMaps();
          if (cancelled || !containerRef.current) return;

          if (window.google?.maps) {
            const map = new google.maps.Map(containerRef.current, {
              center: { lat: initialCenter.lat, lng: initialCenter.lng },
              zoom: initialZoom,
              mapId: "monthly-key-map",
              language: "ar",
              gestureHandling: "greedy",
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              zoomControl: true,
            });

            const instance = createGoogleMapInstance(map);
            mapInstanceRef.current = instance;
            setProviderUsed("google");
            setLoading(false);
            onMapReady?.(instance);
            return;
          }
        } catch (e) {
          console.warn("Google Maps failed, falling back to Leaflet:", e);
        }
      }

      // Fallback to Leaflet/OpenStreetMap
      try {
        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          center: [initialCenter.lat, initialCenter.lng],
          zoom: initialZoom,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(containerRef.current);

        const instance = createLeafletMapInstance(map, L);
        mapInstanceRef.current = instance;
        setProviderUsed("leaflet");
        setLoading(false);
        onMapReady?.(instance);
      } catch (e) {
        console.error("Failed to initialize any map provider:", e);
        setLoading(false);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current?.provider === "leaflet" && mapInstanceRef.current.leaflet) {
        mapInstanceRef.current.leaflet.remove();
      }
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ zIndex: 0, minHeight: "400px" }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">جاري تحميل الخريطة...</span>
          </div>
        </div>
      )}
      {!loading && providerUsed === "leaflet" && !USE_GOOGLE_MAPS && (
        <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-xs text-muted-foreground px-2 py-1 rounded z-[1000]">
          OpenStreetMap • Google Maps غير مُفعّل حالياً
        </div>
      )}
    </div>
  );
}

// ============================================================
// Utility: Create cluster icon for Leaflet MarkerCluster
// ============================================================
export function createClusterIcon(count: number): any {
  if (!leafletModule) return null;
  const L = leafletModule;
  const size = count < 10 ? 40 : count < 50 ? 50 : count < 100 ? 60 : 70;
  const bgColor = count < 10 ? "#3ECFC0" : count < 50 ? "#E8B931" : count < 100 ? "#F97316" : "#EF4444";
  return L.divIcon({
    className: "custom-cluster-icon",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${bgColor};
        border: 3px solid #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 800;
        font-size: ${size < 50 ? 14 : 16}px;
        font-family: Tajawal, sans-serif;
        box-shadow: 0 3px 12px rgba(0,0,0,0.3);
        cursor: pointer;
      ">${count}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default MapView;
