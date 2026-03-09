import type { CheerioAPI } from "cheerio";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "cheerio";

const BASE_URL = "https://map.kaldi.co.jp/kaldi/articleList";
const DATA_DIR = resolve(import.meta.dirname, "../src/data");
const OUTPUT_PATH = resolve(DATA_DIR, "stores.json");

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
    const status = $(row).find("span.saleicon").text().trim();
    const type = $(row).find("span.saletitle").text().trim();
    const storeLink = $(row).find("span.salename a");
    const dateText = $(row).find("p.saledate").text().trim();
    const detail = $(row).find("p.saledetail").text().trim();

    const href = storeLink.attr("href") ?? "";
    const bidMatch = /bid=(\d+)/.exec(href);
    if (!bidMatch) {
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
    throw new Error("GOOGLE_GEOCODING_API_KEY is required");
  }

  const [rawStores, sales] = await Promise.all([fetchStores(), fetchSales()]);

  // Load existing data if available (to reuse geocoded coordinates)
  const existingStores = new Map<string, { lat: number; lng: number }>();
  if (existsSync(OUTPUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
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
    let coords: { lat: number; lng: number } | null | undefined =
      existingStores.get(raw.id);
    if (!coords) {
      // oxlint-disable-next-line no-await-in-loop -- sequential geocoding with rate limit
      coords = await geocodeAddress(raw.address, apiKey);
      if (!coords) {
        continue;
      }
      // Rate limit: Google Geocoding API allows 50 req/s
      // oxlint-disable-next-line no-await-in-loop -- intentional delay between API calls
      await new Promise((_resolve) => {
        setTimeout(_resolve, 50);
      });
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

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.warn(`Saved ${stores.length} stores to ${OUTPUT_PATH}`);
}

await main();
