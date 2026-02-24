/**
 * LEAFLET MAP INTEGRATION (OpenStreetMap - Free, no API key required)
 *
 * Replaces Google Maps Forge proxy with Leaflet + OpenStreetMap tiles.
 * Works on any deployment (Railway, Vercel, etc.) without API keys.
 *
 * USAGE:
 * <MapView
 *   initialCenter={{ lat: 24.7136, lng: 46.6753 }}
 *   initialZoom={12}
 *   onMapReady={(map) => { mapRef.current = map; }}
 * />
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons (they break with bundlers)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 24.7136, lng: 46.6753 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
    });

    // OpenStreetMap tiles (free, no API key)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setReady(true);

    // Notify parent
    if (onMapReady) {
      onMapReady(map);
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-[500px] rounded-lg overflow-hidden", className)}
      style={{ zIndex: 0 }}
    />
  );
}

// ============================================================
// Utility: Create a custom colored marker for property pins
// ============================================================
export function createPropertyMarker(
  lat: number,
  lng: number,
  options: {
    color?: string;
    label?: string;
    title?: string;
  } = {}
): L.Marker {
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
      ">${label}</div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  return L.marker([lat, lng], { icon, title });
}

// ============================================================
// Utility: Create a cluster icon
// ============================================================
export function createClusterIcon(count: number): L.DivIcon {
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
