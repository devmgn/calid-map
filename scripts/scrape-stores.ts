import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const { loadEnvConfig } = await import("@next/env");
loadEnvConfig(resolve(import.meta.dirname, ".."));

const DATA_DIR = resolve(import.meta.dirname, "../src/data");
const OUTPUT_PATH = resolve(DATA_DIR, "stores.json");

async function main() {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEOCODING_API_KEY is required");
  }

  const { buildStoresData } = await import("../src/lib/scraper");

  // Load coordinate cache from DB if available, fallback to local JSON
  let cachedCoords = new Map<string, { lat: number; lng: number }>();
  const hasDbConfig =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLED;

  if (hasDbConfig) {
    try {
      const { getStoreCoordsCache } = await import("../src/db/queries/stores");
      cachedCoords = await getStoreCoordsCache();
      console.warn(
        `Loaded ${cachedCoords.size} cached coordinates from database`,
      );
    } catch {
      console.warn("Failed to load coordinates from DB, falling back to JSON");
    }
  }

  if (cachedCoords.size === 0 && existsSync(OUTPUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
    for (const s of existing.stores) {
      cachedCoords.set(s.id, { lat: s.lat, lng: s.lng });
    }
    console.warn(
      `Loaded ${cachedCoords.size} cached coordinates from local JSON`,
    );
  }

  const output = await buildStoresData(cachedCoords, apiKey);

  // Save local JSON for development
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.warn(`Saved ${output.stores.length} stores to ${OUTPUT_PATH}`);

  // Write to database if configured
  if (hasDbConfig) {
    const { logScrape, upsertStoresAndSales } =
      await import("../src/db/queries/stores");
    await upsertStoresAndSales(output);
    await logScrape(output.stores.length);
    console.warn(`Upserted ${output.stores.length} stores to database`);
  }
}

await main();
