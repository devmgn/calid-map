import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sales } from "./schema/sales";
import { scrapeLogs } from "./schema/scrapeLogs";
import { stores } from "./schema/stores";

type Schema = typeof schema;
const schema = { stores, sales, scrapeLogs };

let client: Sql | null = null;
let instance: PostgresJsDatabase<Schema> | null = null;

export function getDb(): PostgresJsDatabase<Schema> {
  if (instance === null) {
    const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
    if (url === undefined || url === "") {
      throw new Error("DATABASE_URL or DATABASE_URL_POOLED is required");
    }
    client = postgres(url);
    instance = drizzle({ client, schema });
  }
  return instance;
}

/** @public - called from scripts/scrape-stores.ts via dynamic import */
export async function closeDb(): Promise<void> {
  if (client !== null) {
    await client.end();
    client = null;
    instance = null;
  }
}
