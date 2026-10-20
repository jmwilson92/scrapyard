"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { ShopPin } from "@/lib/shops";
import "leaflet/dist/leaflet.css";

const SAN_DIEGO: [number, number] = [32.7157, -117.1611];

let pinIcon: L.DivIcon | null = null;

function getPinIcon(): L.DivIcon {
  pinIcon ??= L.divIcon({
    className: "skrappily-pin",
    html: '<span class="skrappily-pin-dot"></span>',
    iconSize: [28, 36],
    iconAnchor: [14, 32],
    popupAnchor: [0, -28],
  });
  return pinIcon;
}

export default function ShopMap({ pins }: { pins: ShopPin[] }) {
  const icon = useMemo(() => getPinIcon(), []);

  return (
    <MapContainer
      center={SAN_DIEGO}
      zoom={10}
      scrollWheelZoom
      className="skrappily-map w-full rounded-2xl"
      style={{ height: "min(70vh, 640px)", minHeight: "420px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitPins pins={pins} />
      {pins.map((pin) => (
        <Marker key={pin.sellerId} position={[pin.lat, pin.lng]} icon={icon}>
          <Popup>
            <strong className="block text-sm">{pin.shopName}</strong>
            <span className="mt-1 block text-sm">
              {pin.count} active {pin.count === 1 ? "listing" : "listings"}
            </span>
            <a href={`/shops/${pin.sellerId}`} className="mt-1 inline-block text-sm font-semibold">
              View shop
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function FitPins({ pins }: { pins: ShopPin[] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (pins.length === 0) {
      map.setView(SAN_DIEGO, 10);
      return;
    }
    const bounds = L.latLngBounds(pins.map((pin) => [pin.lat, pin.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, pins]);
  return null;
}
