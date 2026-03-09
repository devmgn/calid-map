# カルディ店舗マップ 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** カルディコーヒーファームの全店舗をGoogle Mapsに表示し、セール開催中の店舗で絞り込めるWebアプリを構築する。

**Architecture:** スクレイピングスクリプトでカルディ公式サイトから店舗・セール情報を取得し、JSONファイルとして保存。Next.js SSGでJSONを読み込み、Google Mapsにピン表示。nuqsでセールフィルターのURL状態管理。

**Tech Stack:** Next.js 16, React 19, @vis.gl/react-google-maps, Cheerio, nuqs, tailwind-variants, Zod 4

---

## データソース詳細

### 全店舗一覧（accmd=0）

Ajax APIで全件取得可能:

```
GET https://map.kaldi.co.jp/kaldi/articleList?template=Ctrl/DispListArticle_g12&pageLimit=10000&pageSize=1000&account=kaldi&accmd=0&searchType=True&pg=1
```

HTMLフラグメントが返る。セレクタ:
| 要素 | セレクタ |
|---|---|
| テーブル | `table.cz_sp_table` |
| 店舗名リンク | `td[itemprop="name"] a` |
| 店舗ID | リンクhrefの `bid=` パラメータ |
| 住所 | `td[itemprop="address"]` |
| 取扱サービス | `td[aria-label="お取り扱い"] img` の `src` 属性 |

取扱サービス: 一覧ページの`img`の`src`ファイル名でマッピング。ラベルは詳細ページの表記に準拠:
| アイコン | サービス名（詳細ページ表記） |
|---|---|
| `icon_001.svg` | 酒類取扱 |
| `icon_002.svg` | カフェ併設 |
| `icon_006.svg` | Tax Free |

### セール情報（accmd=1）

```
GET https://map.kaldi.co.jp/kaldi/articleList?account=kaldi&accmd=1&ftop=1&kkw001={ISO日時}
```

全件1ページ表示。セレクタ:
| 要素 | セレクタ |
|---|---|
| セール状態 | `span.saleicon` （"開催中" / "予告"） |
| セール種別 | `span.saletitle` |
| 店舗名 | `span.salename a` |
| 店舗ID | リンクhrefの `bid=` |
| 住所 | `span.saleadress` |
| セール期間 | `p.saledate` |
| セール内容 | `p.saledetail` |

---

## Task 1: 型定義とデータモデル

**Files:**

- Create: `src/features/map/types.ts`

**Step 1: 型定義ファイルを作成**

```typescript
export type Sale = {
  type: string;
  status: "開催中" | "予告";
  startDate: string;
  endDate: string;
  detail: string;
};

export type StoreService = "酒類取扱" | "カフェ併設" | "Tax Free";

export type Store = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  url: string;
  services: StoreService[];
  sales: Sale[];
};

export type StoresData = {
  updatedAt: string;
  stores: Store[];
};
```

**Step 2: Commit**

```bash
git add src/features/map/types.ts
git commit -m "feat: add store and sale type definitions"
```

---

## Task 2: スクレイピングスクリプト — 店舗一覧取得

**Files:**

- Create: `scripts/scrape-stores.ts`

**Step 1: cheerioをインストール**

```bash
pnpm add -D cheerio
```

**Step 2: スクレイピングスクリプトを作成**

```typescript
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://map.kaldi.co.jp/kaldi/articleList";
const DATA_DIR = resolve(import.meta.dirname, "../src/data");
const OUTPUT_PATH = resolve(DATA_DIR, "stores.json");

type RawStore = {
  id: string;
  name: string;
  address: string;
  url: string;
  services: string[];
};

const ICON_TO_SERVICE: Record<string, string> = {
  icon_001: "酒類取扱",
  icon_002: "カフェ併設",
  icon_006: "Tax Free",
};

function parseServiceIcons(
  $: cheerio.CheerioAPI,
  row: cheerio.Element,
): string[] {
  const services: string[] = [];
  $(row)
    .find('td[aria-label="お取り扱い"] img')
    .each((_, img) => {
      const src = $(img).attr("src") ?? "";
      const match = src.match(/(icon_\d+)/);
      if (match && ICON_TO_SERVICE[match[1]]) {
        services.push(ICON_TO_SERVICE[match[1]]);
      }
    });
  return services;
}

type RawSale = {
  storeId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  detail: string;
};

async function fetchStores(): Promise<RawStore[]> {
  const url = `${BASE_URL}?template=Ctrl/DispListArticle_g12&pageLimit=10000&pageSize=1000&account=kaldi&accmd=0&searchType=True&pg=1`;
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const stores: RawStore[] = [];

  $("table.cz_sp_table tbody tr").each((_, row) => {
    const nameEl = $(row).find('td[itemprop="name"] a');
    const addressEl = $(row).find('td[itemprop="address"]');

    const name = nameEl.text().trim();
    const href = nameEl.attr("href") ?? "";
    const address = addressEl.text().trim();

    const bidMatch = href.match(/bid=(\d+)/);
    if (!bidMatch || !name) return;

    const services = parseServiceIcons($, row);

    stores.push({
      id: bidMatch[1],
      name,
      address,
      url: `https://map.kaldi.co.jp${href}`,
      services,
    });
  });

  console.log(`Fetched ${stores.length} stores`);
  return stores;
}

async function fetchSales(): Promise<RawSale[]> {
  const now = new Date().toISOString().slice(0, 19);
  const url = `${BASE_URL}?account=kaldi&accmd=1&ftop=1&kkw001=${encodeURIComponent(now)}`;
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const sales: RawSale[] = [];

  $("table.cz_sp_table tbody tr").each((_, row) => {
    const status = $(row).find("span.saleicon").text().trim();
    const type = $(row).find("span.saletitle").text().trim();
    const storeLink = $(row).find("span.salename a");
    const dateText = $(row).find("p.saledate").text().trim();
    const detail = $(row).find("p.saledetail").text().trim();

    const href = storeLink.attr("href") ?? "";
    const bidMatch = href.match(/bid=(\d+)/);
    if (!bidMatch) return;

    const { startDate, endDate } = parseDateRange(dateText);

    sales.push({
      storeId: bidMatch[1],
      type,
      status,
      startDate,
      endDate,
      detail,
    });
  });

  console.log(`Fetched ${sales.length} sales`);
  return sales;
}

function parseDateRange(text: string): { startDate: string; endDate: string } {
  // "2026年3月5日(木) ～ 2026年3月9日(月)"
  const pattern =
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*?～\s*(\d{4})年(\d{1,2})月(\d{1,2})日/;
  const m = text.match(pattern);
  if (!m) return { startDate: "", endDate: "" };

  const pad = (n: string) => n.padStart(2, "0");
  return {
    startDate: `${m[1]}-${pad(m[2])}-${pad(m[3])}`,
    endDate: `${m[4]}-${pad(m[5])}-${pad(m[6])}`,
  };
}

async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=ja`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status === "OK" && data.results.length > 0) {
    return data.results[0].geometry.location;
  }
  console.warn(`Geocoding failed for: ${address} (${data.status})`);
  return null;
}

async function main() {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_GEOCODING_API_KEY is required");
    process.exit(1);
  }

  const [rawStores, sales] = await Promise.all([fetchStores(), fetchSales()]);

  // Load existing data if available (to reuse geocoded coordinates)
  let existingStores = new Map<string, { lat: number; lng: number }>();
  if (existsSync(OUTPUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    for (const s of existing.stores) {
      existingStores.set(s.id, { lat: s.lat, lng: s.lng });
    }
  }

  // Group sales by store ID
  const salesByStore = new Map<string, RawSale[]>();
  for (const sale of sales) {
    const list = salesByStore.get(sale.storeId) ?? [];
    list.push(sale);
    salesByStore.set(sale.storeId, list);
  }

  // Geocode and merge
  const stores = [];
  for (const raw of rawStores) {
    let coords = existingStores.get(raw.id);
    if (!coords) {
      coords = await geocodeAddress(raw.address, apiKey);
      if (!coords) continue;
      // Rate limit: Google Geocoding API allows 50 req/s
      await new Promise((r) => setTimeout(r, 50));
    }

    const storeSales = salesByStore.get(raw.id) ?? [];

    stores.push({
      id: raw.id,
      name: raw.name,
      address: raw.address,
      lat: coords.lat,
      lng: coords.lng,
      url: raw.url,
      services: raw.services,
      sales: storeSales.map((s) => ({
        type: s.type,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        detail: s.detail,
      })),
    });
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const output = {
    updatedAt: new Date().toISOString(),
    stores,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Saved ${stores.length} stores to ${OUTPUT_PATH}`);
}

main().catch(console.error);
```

**Step 3: テスト実行**

```bash
GOOGLE_GEOCODING_API_KEY=your-key pnpm tsx scripts/scrape-stores.ts
```

`src/data/stores.json` が生成されることを確認。

**Step 4: .gitignoreにAPIキーが含まれないことを確認、dataディレクトリはコミット対象**

**Step 5: Commit**

```bash
git add scripts/scrape-stores.ts src/data/stores.json package.json pnpm-lock.yaml
git commit -m "feat: add store scraping script with geocoding"
```

---

## Task 3: 環境変数にGoogle Maps APIキーを追加

**Files:**

- Modify: `src/schemas/env.schema.ts`
- Modify: `src/config/env.ts`
- Modify: `.env.local`（ローカルのみ、コミットしない）

**Step 1: envスキーマにAPIキーを追加**

`src/schemas/env.schema.ts` に追加:

```typescript
GOOGLE_MAPS_API_KEY: z.string(),
```

**Step 2: env.tsにマッピングを追加**

`src/config/env.ts` に追加:

```typescript
GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
```

**Step 3: .env.localにキーを設定**

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

**Step 4: Commit**

```bash
git add src/schemas/env.schema.ts src/config/env.ts
git commit -m "feat: add Google Maps API key to env config"
```

---

## Task 4: Google Maps パッケージインストール

**Step 1: パッケージインストール**

```bash
pnpm add @vis.gl/react-google-maps
```

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add @vis.gl/react-google-maps"
```

---

## Task 5: StoreMap コンポーネント

**Files:**

- Create: `src/features/map/components/StoreMap/StoreMap.tsx`
- Create: `src/features/map/components/StoreMap/index.ts`

**Step 1: StoreMapコンポーネントを作成**

```typescript
// StoreMap.tsx
"use client";

import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { useState, useCallback } from "react";
import { ENV } from "@/config/env";
import type { Store } from "../../types";

type StoreMapProps = {
  stores: Store[];
};

const JAPAN_CENTER = { lat: 36.5, lng: 137.5 };
const DEFAULT_ZOOM = 6;

function StoreMarker({
  store,
  isSelected,
  onSelect,
}: {
  store: Store;
  isSelected: boolean;
  onSelect: (store: Store | null) => void;
}) {
  const hasSale = store.sales.length > 0;

  return (
    <>
      <AdvancedMarker
        position={{ lat: store.lat, lng: store.lng }}
        onClick={() => onSelect(store)}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: hasSale ? "#dc2626" : "#6b7280",
            border: "2px solid white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </AdvancedMarker>
      {isSelected && (
        <InfoWindow
          position={{ lat: store.lat, lng: store.lng }}
          onCloseClick={() => onSelect(null)}
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
                {sale.startDate} ～ {sale.endDate}
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

function StoreMap({ stores }: StoreMapProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const handleSelect = useCallback((store: Store | null) => {
    setSelectedStore(store);
  }, []);

  return (
    <APIProvider apiKey={ENV.GOOGLE_MAPS_API_KEY}>
      <Map
        defaultCenter={JAPAN_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapId="kaldi-store-map"
        style={{ width: "100%", height: "100%" }}
        gestureHandling="greedy"
      >
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
```

```typescript
// index.ts
export { StoreMap } from "./StoreMap";
```

**Step 2: Commit**

```bash
git add src/features/map/components/StoreMap/
git commit -m "feat: add StoreMap component with Google Maps"
```

---

## Task 6: SaleFilter コンポーネント

**Files:**

- Create: `src/features/map/hooks/useSaleFilter.ts`
- Create: `src/features/map/components/SaleFilter/SaleFilter.tsx`
- Create: `src/features/map/components/SaleFilter/index.ts`

**Step 1: nuqsベースのフィルターフックを作成**

```typescript
// useSaleFilter.ts
"use client";

import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import type { Store } from "../types";

function useSaleFilter(stores: Store[]) {
  const [selectedSales, setSelectedSales] = useQueryState(
    "sales",
    parseAsArrayOf(parseAsString, ",").withDefault([]),
  );

  const saleTypes = useMemo(() => {
    const types = new Set<string>();
    for (const store of stores) {
      for (const sale of store.sales) {
        types.add(sale.type);
      }
    }
    return Array.from(types).sort();
  }, [stores]);

  const filteredStores = useMemo(() => {
    if (selectedSales.length === 0) return stores;
    return stores.filter((store) =>
      store.sales.some((sale) => selectedSales.includes(sale.type)),
    );
  }, [stores, selectedSales]);

  function toggleSale(saleType: string) {
    setSelectedSales((prev) =>
      prev.includes(saleType)
        ? prev.filter((s) => s !== saleType)
        : [...prev, saleType],
    );
  }

  return { saleTypes, selectedSales, toggleSale, filteredStores };
}

export { useSaleFilter };
```

**Step 2: SaleFilterコンポーネントを作成**

```typescript
// SaleFilter.tsx
"use client";

type SaleFilterProps = {
  saleTypes: string[];
  selectedSales: string[];
  onToggle: (saleType: string) => void;
  totalCount: number;
  filteredCount: number;
};

function SaleFilter({
  saleTypes,
  selectedSales,
  onToggle,
  totalCount,
  filteredCount,
}: SaleFilterProps) {
  if (saleTypes.length === 0) return null;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold">セール絞り込み</h2>
      <div className="flex flex-col gap-2">
        {saleTypes.map((type) => (
          <label key={type} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedSales.includes(type)}
              onChange={() => onToggle(type)}
              className="rounded"
            />
            {type}
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {filteredCount} / {totalCount} 店舗表示中
      </p>
    </div>
  );
}

export { SaleFilter };
```

```typescript
// index.ts
export { SaleFilter } from "./SaleFilter";
```

**Step 3: Commit**

```bash
git add src/features/map/hooks/ src/features/map/components/SaleFilter/
git commit -m "feat: add SaleFilter component with nuqs URL state"
```

---

## Task 7: メインページの組み立て

**Files:**

- Modify: `src/app/page.tsx`
- Create: `src/features/map/index.ts`

**Step 1: featureのバレルエクスポートを作成**

```typescript
// src/features/map/index.ts
export { StoreMap } from "./components/StoreMap";
export { SaleFilter } from "./components/SaleFilter";
export { useSaleFilter } from "./hooks/useSaleFilter";
export type { Store, Sale, StoresData } from "./types";
```

**Step 2: page.tsxを実装**

```typescript
// src/app/page.tsx
import storesData from "@/data/stores.json";
import { MapPage } from "@/features/map/components/MapPage/MapPage";
import type { StoresData } from "@/features/map/types";

export default function Home() {
  return <MapPage data={storesData as StoresData} />;
}
```

**Step 3: MapPageクライアントコンポーネントを作成**

Create: `src/features/map/components/MapPage/MapPage.tsx`

```typescript
"use client";

import { StoreMap } from "../StoreMap";
import { SaleFilter } from "../SaleFilter";
import { useSaleFilter } from "../../hooks/useSaleFilter";
import type { StoresData } from "../../types";

type MapPageProps = {
  data: StoresData;
};

function MapPage({ data }: MapPageProps) {
  const { saleTypes, selectedSales, toggleSale, filteredStores } =
    useSaleFilter(data.stores);

  return (
    <div className="relative h-dvh w-full">
      <StoreMap stores={filteredStores} />
      <div className="absolute left-4 top-4 z-10 w-56">
        <SaleFilter
          saleTypes={saleTypes}
          selectedSales={selectedSales}
          onToggle={toggleSale}
          totalCount={data.stores.length}
          filteredCount={filteredStores.length}
        />
      </div>
    </div>
  );
}

export { MapPage };
```

Create: `src/features/map/components/MapPage/index.ts`

```typescript
export { MapPage } from "./MapPage";
```

**Step 4: Commit**

```bash
git add src/app/page.tsx src/features/map/
git commit -m "feat: assemble map page with store data and filters"
```

---

## Task 8: lint & build 確認

**Step 1: lint**

```bash
pnpm check
```

**Step 2: build**

```bash
pnpm build
```

**Step 3: 修正があればfix & commit**

---

## 実行順序

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8
```

全てシーケンシャル。Task 2はGoogle Geocoding APIキーが必要。
