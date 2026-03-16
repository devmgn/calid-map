"use client";

import type { Sale, Store } from "../../types";
import {
  endOfDay,
  isFuture,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { useCallback, useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

interface StoreMapProps {
  stores: Store[];
}

const JAPAN_CENTER = { lat: 36.5, lng: 137.5 } as const;
const DEFAULT_ZOOM = 14;
const FALLBACK_ZOOM = 11;

type SaleCategory = "open" | "kansha";

type MarkerColor =
  | { category: SaleCategory; active: true }
  | { category: SaleCategory; active: false }
  | { category: "none" };

function getSaleCategory(type: string): SaleCategory {
  return type.includes("オープン") ? "open" : "kansha";
}

function getMarkerColor(sales: Sale[]): MarkerColor {
  const today = startOfDay(new Date());

  const active = sales.find((sale) =>
    isWithinInterval(today, {
      start: startOfDay(parseISO(sale.startDate)),
      end: endOfDay(parseISO(sale.endDate)),
    }),
  );

  if (active) {
    return { category: getSaleCategory(active.type), active: true };
  }

  const upcoming = sales.find((sale) => isFuture(parseISO(sale.startDate)));

  if (upcoming) {
    return { category: getSaleCategory(upcoming.type), active: false };
  }

  return { category: "none" };
}

const MARKER_COLORS: Record<string, string> = {
  "kansha-active": "#dc2626", // 赤: 通常セール開催中
  "kansha-upcoming": "#fca5a5", // 薄赤: 通常セール予定
  "open-active": "#2563eb", // 青: オープンセール開催中
  "open-upcoming": "#93c5fd", // 薄青: オープンセール予定
  none: "#9ca3af", // グレー: セールなし
};

function resolveMarkerColor(color: MarkerColor): string {
  if (color.category === "none") {
    return MARKER_COLORS.none;
  }
  const key = `${color.category}-${color.active ? "active" : "upcoming"}`;
  return MARKER_COLORS[key];
}

function StoreMarker({
  store,
  onSelect,
}: {
  store: Store;
  onSelect: (store: Store) => void;
}) {
  const markerColor = getMarkerColor(store.sales);
  const color = resolveMarkerColor(markerColor);

  return (
    <CircleMarker
      center={[store.lat, store.lng]}
      radius={10}
      pathOptions={{
        color: "white",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      }}
      eventHandlers={{
        click: () => {
          onSelect(store);
        },
      }}
    >
      <Popup>
        <div style={{ maxWidth: 250, padding: 4 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>
            {store.name}
          </h3>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#666" }}>
            {store.address}
          </p>
          {store.sales.map((sale, i) => (
            <div
              key={`${sale.type}-${i}`}
              style={{
                background: "#fef2f2",
                padding: "4px 8px",
                borderRadius: 4,
                marginBottom: 4,
                fontSize: 12,
              }}
            >
              <strong>{sale.type}</strong>
              <br />
              {sale.startDate} ~ {sale.endDate}
            </div>
          ))}
          <a
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#2563eb" }}
          >
            公式ページ →
          </a>
        </div>
      </Popup>
    </CircleMarker>
  );
}

function useCurrentPosition() {
  const [position, setPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => {
        setResolved(true);
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setResolved(true);
      },
      () => {
        setResolved(true);
      },
    );
  }, []);

  return { position, resolved };
}

function MyLocationButton({
  position,
}: {
  position: { lat: number; lng: number };
}) {
  const map = useMap();

  const handleClick = useCallback(() => {
    map.setView(position, DEFAULT_ZOOM);
  }, [map, position]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="現在位置に戻る"
      style={{
        position: "absolute",
        bottom: 24,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "white",
        border: "none",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4285F4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" fill="#4285F4" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    </button>
  );
}

function CurrentLocationMarker({
  position,
}: {
  position: { lat: number; lng: number };
}) {
  return (
    <CircleMarker
      center={[position.lat, position.lng]}
      radius={6}
      pathOptions={{
        color: "white",
        weight: 3,
        fillColor: "#4285F4",
        fillOpacity: 1,
      }}
    />
  );
}

function PanToStore({ store }: { store: Store | null }) {
  const map = useMap();

  useEffect(() => {
    if (store) {
      map.panTo([store.lat, store.lng]);
    }
  }, [map, store]);

  return null;
}

function StoreMap({ stores }: StoreMapProps) {
  const { position: currentPosition, resolved } = useCurrentPosition();
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  if (!resolved) {
    return null;
  }

  const center = currentPosition ?? JAPAN_CENTER;
  const zoom = currentPosition ? DEFAULT_ZOOM : FALLBACK_ZOOM;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      attributionControl
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PanToStore store={selectedStore} />
      {currentPosition && (
        <>
          <CurrentLocationMarker position={currentPosition} />
          <MyLocationButton position={currentPosition} />
        </>
      )}
      {stores.map((store) => (
        <StoreMarker key={store.id} store={store} onSelect={setSelectedStore} />
      ))}
    </MapContainer>
  );
}

export { StoreMap };
