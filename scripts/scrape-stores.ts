import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { loadEnvConfig } = await import("@next/env");
loadEnvConfig(resolve(import.meta.dirname, ".."));

const DATA_DIR = resolve(import.meta.dirname, "../src/data");
const OUTPUT_PATH = resolve(DATA_DIR, "stores.json");

const { values } = parseArgs({
  options: { "no-cache": { type: "boolean", default: false } },
});

async function loadCoordsCache(): Promise<
  Map<string, { lat: number; lng: number }>
> {
  const hasDbConfig =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLED;

  if (hasDbConfig) {
    try {
      const { getStoreCoordsCache } = await import("../src/db/queries/stores");
      const coords = await getStoreCoordsCache();
      console.warn(`Loaded ${coords.size} cached coordinates from database`);
      return coords;
    } catch {
      console.warn("Failed to load coordinates from DB, falling back to JSON");
    }
  }

  if (existsSync(OUTPUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
    const coords = new Map<string, { lat: number; lng: number }>();
    for (const s of existing.stores) {
      coords.set(s.id, { lat: s.lat, lng: s.lng });
    }
    console.warn(`Loaded ${coords.size} cached coordinates from local JSON`);
    return coords;
  }

  return new Map();
}

async function main() {
  const { buildStoresData } = await import("../src/lib/scraper");

  const skipCache = values["no-cache"];
  const cachedCoords = skipCache
    ? new Map<string, { lat: number; lng: number }>()
    : await loadCoordsCache();

  if (skipCache) {
    console.warn("Cache skipped (--no-cache)");
  }

  const output = await buildStoresData(cachedCoords);

  // Save local JSON for development
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.warn(`Saved ${output.stores.length} stores to ${OUTPUT_PATH}`);

  // Write to database if configured
  if (process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLED) {
    const { logScrape, upsertStoresAndSales } =
      await import("../src/db/queries/stores");
    await upsertStoresAndSales(output);
    await logScrape(output.stores.length);
    console.warn(`Upserted ${output.stores.length} stores to database`);

    const { closeDb } = await import("../src/db");
    await closeDb();
  }
}

await main();
