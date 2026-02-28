/**
 * PinPickerMap — Admin-only map component for placing property pins
 * Uses Leaflet/OpenStreetMap (free, no API key needed) for the admin pin picker
 * This is separate from the public-facing Map component
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PinPickerMapProps {
  lat?: number;
  lng?: number;
  onPinSet: (lat: number, lng: number) => void;
  className?: string;
}

let leafletModule: any = null;
let leafletLoaded = false;

async function loadLeaflet() {
  if (leafletModule) return leafletModule;
  const L = await import("leaflet");
  await import("leaflet/dist/leaflet.css");
  // Fix default marker icons
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  leafletModule = L;
  leafletLoaded = true;
  return L;
}

export default function PinPickerMap({ lat, lng, onPinSet, className }: PinPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const defaultLat = lat || 24.7136;
  const defaultLng = lng || 46.6753;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      // Destroy existing map if any
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: lat && lng ? 16 : 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add existing marker if coordinates exist
      if (lat && lng) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getLatLng();
          onPinSet(pos.lat, pos.lng);
        });
      }

      // Click to place/move pin
      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current.getLatLng();
            onPinSet(pos.lat, pos.lng);
          });
        }
        onPinSet(clickLat, clickLng);
      });

      mapRef.current = map;
      setReady(true);

      // Force resize after render
      setTimeout(() => map.invalidateSize(), 100);
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Only init once

  // Update marker when lat/lng props change externally
  useEffect(() => {
    if (!mapRef.current || !leafletLoaded) return;
    const L = leafletModule;
    if (lat && lng) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getLatLng();
          onPinSet(pos.lat, pos.lng);
        });
      }
      mapRef.current.setView([lat, lng], 16);
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-[300px] rounded-lg border bg-muted", className)}
      style={{ minHeight: 300 }}
    />
  );
}
