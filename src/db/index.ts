import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { sales } from "./schema/sales";
import { scrapeLogs } from "./schema/scrapeLogs";
import { stores } from "./schema/stores";

type Schema = typeof schema;
const schema = { stores, sales, scrapeLogs };

let instance: PostgresJsDatabase<Schema> | null = null;

export function getDb(): PostgresJsDatabase<Schema> {
  if (instance === null) {
    const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
    if (url === undefined || url === "") {
      throw new Error("DATABASE_URL or DATABASE_URL_POOLED is required");
    }
    instance = drizzle({ connection: { url }, schema });
  }
  return instance;
}
