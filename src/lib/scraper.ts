import type { Store, StoresData } from "@/features/map/types";
import type { CheerioAPI } from "cheerio";
import { load } from "cheerio";
import { z } from "zod";

const BASE_URL = "https://map.kaldi.co.jp/kaldi/articleList";

interface RawStore {
  id: string;
  name: string;
  address: string;
  url: string;
  services: string[];
}

interface RawSale {
  storeId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  detail: string;
}

const ICON_TO_SERVICE: Record<string, string> = {
  icon_001: "酒類取扱",
  icon_002: "カフェ併設",
  icon_006: "Tax Free",
};

function parseServiceIcons(
  $: CheerioAPI,
  $row: ReturnType<CheerioAPI>,
): string[] {
  const services: string[] = [];
  $row.find('td[aria-label="お取り扱い"] img').each((_, img) => {
    const src = $(img).attr("src") ?? "";
    const match = /(icon_\d+)/.exec(src);
    if (match && ICON_TO_SERVICE[match[1]]) {
      services.push(ICON_TO_SERVICE[match[1]]);
    }
  });
  return services;
}

async function fetchStores(): Promise<RawStore[]> {
  const url = `${BASE_URL}?template=Ctrl/DispListArticle_g12&pageLimit=10000&pageSize=1000&account=kaldi&accmd=0&searchType=True&pg=1`;
  const res = await fetch(url);
  const html = await res.text();
  const $ = load(html);

  const stores: RawStore[] = [];

  $("table.cz_sp_table tbody tr").each((_, row) => {
    const nameEl = $(row).find('td[itemprop="name"] a');
    const addressEl = $(row).find('td[itemprop="address"]');

    const name = nameEl.text().trim();
    const href = nameEl.attr("href") ?? "";
    const address = addressEl.text().trim();

    const bidMatch = /bid=(\d+)/.exec(href);
    if (!bidMatch || !name) {
      return;
    }

    const services = parseServiceIcons($, $(row));

    stores.push({
      id: bidMatch[1],
      name,
      address,
      url: `https://map.kaldi.co.jp${href}`,
      services,
    });
  });

  console.warn(`Fetched ${stores.length} stores`);
  return stores;
}

async function fetchSales(): Promise<RawSale[]> {
  const now = new Date().toISOString().slice(0, 19);
  const url = `${BASE_URL}?account=kaldi&accmd=1&ftop=1&kkw001=${encodeURIComponent(now)}`;
  const res = await fetch(url);
  const html = await res.text();
  const $ = load(html);

  const sales: RawSale[] = [];

  $("table.cz_sp_table tbody tr").each((_, row) => {
    const status = $(row).find("span.saleicon, span.saleicon_f").text().trim();
    const type = $(row).find("span.saletitle, span.saletitle_f").text().trim();
    const storeLink = $(row).find("span.salename a");
    const dateText = $(row).find("p.saledate, p.saledate_f").text().trim();
    const detail = $(row).find("p.saledetail").text().trim();

    const href = storeLink.attr("href") ?? "";
    const bidMatch = /bid=(\d+)/.exec(href);
    if (!bidMatch || !type) {
      return;
    }

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

  console.warn(`Fetched ${sales.length} sales`);
  return sales;
}

function padZero(n: string): string {
  return n.padStart(2, "0");
}

function parseDateRange(text: string): { startDate: string; endDate: string } {
  // "2026年3月5日(木) ～ 2026年3月9日(月)"
  const pattern =
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*?～\s*(\d{4})年(\d{1,2})月(\d{1,2})日/;
  const m = pattern.exec(text);
  if (!m) {
    return { startDate: "", endDate: "" };
  }

  return {
    startDate: `${m[1]}-${padZero(m[2])}-${padZero(m[3])}`,
    endDate: `${m[4]}-${padZero(m[5])}-${padZero(m[6])}`,
  };
}

const gsiGeocodeResponseSchema = z.array(
  z.object({
    geometry: z.object({
      coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
    }),
  }),
);

async function fetchGsi(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  const parsed = gsiGeocodeResponseSchema.safeParse(await res.json());

  if (!parsed.success || parsed.data.length === 0) {
    return null;
  }

  const [lng, lat] = parsed.data[0].geometry.coordinates;
  return { lat, lng };
}

// 京都の通り名表記（例: 三条通寺町東入）を除去して町名だけにする
const KYOTO_STREET_PATTERN = /.+[区郡].+[通り].*[入ル]/;

function simplifyAddress(address: string): string | null {
  if (!KYOTO_STREET_PATTERN.test(address)) {
    return null;
  }
  // 「〇〇区」の後ろから「入」「ル」までを除去し、残りの町名を直結
  return address.replace(/([区郡])[^区郡]+?[入ル]/, "$1");
}

async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const result = await fetchGsi(address);
  if (result) {
    return result;
  }

  const simplified = simplifyAddress(address);
  if (simplified !== null) {
    console.warn(`Retrying with simplified address: ${simplified}`);
    const retry = await fetchGsi(simplified);
    if (retry) {
      return retry;
    }
  }

  console.warn(`Geocoding failed for: ${address}`);
  return null;
}

async function resolveAllCoords(
  rawStores: RawStore[],
  cachedCoords: Map<string, { lat: number; lng: number }>,
): Promise<Map<string, { lat: number; lng: number }>> {
  const result = new Map(cachedCoords);

  const uncached = rawStores.filter((raw) => !cachedCoords.has(raw.id));

  await uncached.reduce(async (prev, raw) => {
    await prev;
    const coords = await geocodeAddress(raw.address);
    if (coords) {
      result.set(raw.id, coords);
    }
  }, Promise.resolve());

  return result;
}

export async function buildStoresData(
  cachedCoords: Map<string, { lat: number; lng: number }>,
): Promise<StoresData> {
  const [rawStores, sales] = await Promise.all([fetchStores(), fetchSales()]);

  // Group sales by store ID
  const salesByStore = new Map<string, RawSale[]>();
  for (const sale of sales) {
    const list = salesByStore.get(sale.storeId) ?? [];
    list.push(sale);
    salesByStore.set(sale.storeId, list);
  }

  // Geocode uncached stores sequentially
  const resolvedCoords = await resolveAllCoords(rawStores, cachedCoords);

  // Merge
  const stores: Store[] = rawStores.flatMap((raw) => {
    const coords = resolvedCoords.get(raw.id);
    if (!coords) {
      return [];
    }

    const storeSales = salesByStore.get(raw.id) ?? [];

    return {
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
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    stores,
  };
}
