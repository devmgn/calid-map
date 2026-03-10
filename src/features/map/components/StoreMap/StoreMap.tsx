"use client";

import type { Sale, Store } from "../../types";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useState } from "react";
import { ENV } from "@/config/env";

interface StoreMapProps {
  stores: Store[];
}

const JAPAN_CENTER = { lat: 36.5, lng: 137.5 };
const DEFAULT_ZOOM = 14;
const FALLBACK_ZOOM = 11;

type SaleStatus = "active" | "upcoming" | "none";

function getSaleStatus(sales: Sale[]): SaleStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let hasUpcoming = false;

  for (const sale of sales) {
    const start = new Date(sale.startDate);
    const end = new Date(sale.endDate);
    end.setHours(23, 59, 59, 999);

    if (start <= today && today <= end) {
      return "active";
    }
    if (start > today) {
      hasUpcoming = true;
    }
  }

  return hasUpcoming ? "upcoming" : "none";
}

const MARKER_COLORS: Record<SaleStatus, string> = {
  active: "#dc2626",
  upcoming: "#f59e0b",
  none: "#6b7280",
};

function StoreMarker({
  store,
  isSelected,
  onSelect,
}: {
  store: Store;
  isSelected: boolean;
  onSelect: (store: Store | null) => void;
}) {
  const saleStatus = getSaleStatus(store.sales);

  return (
    <>
      <AdvancedMarker
        position={{ lat: store.lat, lng: store.lng }}
        onClick={() => {
          onSelect(store);
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: MARKER_COLORS[saleStatus],
            border: "2px solid white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </AdvancedMarker>
      {isSelected && (
        <InfoWindow
          position={{ lat: store.lat, lng: store.lng }}
          onCloseClick={() => {
            onSelect(null);
          }}
        >
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
        </InfoWindow>
      )}
    </>
  );
}

function useCurrentPosition() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
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
    map?.panTo(position);
    map?.setZoom(DEFAULT_ZOOM);
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
        zIndex: 1,
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

function StoreMap({ stores }: StoreMapProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const { position: currentPosition, resolved } = useCurrentPosition();

  const handleSelect = useCallback((store: Store | null) => {
    setSelectedStore(store);
  }, []);

  if (!resolved) {
    return null;
  }

  const center = currentPosition ?? JAPAN_CENTER;
  const zoom = currentPosition ? DEFAULT_ZOOM : FALLBACK_ZOOM;

  return (
    <APIProvider apiKey={ENV.GOOGLE_MAPS_API_KEY}>
      <Map
        defaultCenter={center}
        defaultZoom={zoom}
        mapId="kaldi-store-map"
        style={{ width: "100%", height: "100%" }}
        gestureHandling="greedy"
        disableDefaultUI
      >
        {currentPosition && (
          <>
            <AdvancedMarker position={currentPosition}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#4285F4",
                  border: "3px solid white",
                  boxShadow: "0 0 6px rgba(66,133,244,0.6)",
                }}
              />
            </AdvancedMarker>
            <MyLocationButton position={currentPosition} />
          </>
        )}
        {stores.map((store) => (
          <StoreMarker
            key={store.id}
            store={store}
            isSelected={selectedStore?.id === store.id}
            onSelect={handleSelect}
          />
        ))}
      </Map>
    </APIProvider>
  );
}

export { StoreMap };
