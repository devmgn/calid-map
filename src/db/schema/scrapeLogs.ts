import { integer, pgTable, serial, timestamp } from "drizzle-orm/pg-core";

export const scrapeLogs = pgTable("scrape_logs", {
  id: serial("id").primaryKey(),
  scrapedAt: timestamp("scraped_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  storeCount: integer("store_count").notNull(),
});
