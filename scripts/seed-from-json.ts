import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const { loadEnvConfig } = await import("@next/env");
loadEnvConfig(resolve(import.meta.dirname, ".."));

const JSON_PATH = resolve(import.meta.dirname, "../src/data/stores.json");

async function main() {
  if (!existsSync(JSON_PATH)) {
    throw new Error(`JSON file not found: ${JSON_PATH}`);
  }

  const { upsertStoresAndSales } = await import("../src/db/queries/stores");

  const data = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  console.warn(`Seeding ${data.stores.length} stores from ${JSON_PATH}...`);

  await upsertStoresAndSales(data);

  console.warn("Seed completed successfully");
}

await main();
