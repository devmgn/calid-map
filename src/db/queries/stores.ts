import type { Store, StoresData } from "@/features/map/types";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "..";
import { sales } from "../schema/sales";
import { scrapeLogs } from "../schema/scrapeLogs";
import { stores } from "../schema/stores";

export async function getStoresWithSales(): Promise<StoresData | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: stores.id,
      name: stores.name,
      address: stores.address,
      lat: stores.lat,
      lng: stores.lng,
      url: stores.url,
      services: stores.services,
      saleId: sales.id,
      saleType: sales.type,
      saleStatus: sales.status,
      saleStartDate: sales.startDate,
      saleEndDate: sales.endDate,
      saleDetail: sales.detail,
    })
    .from(stores)
    .leftJoin(sales, eq(stores.id, sales.storeId));

  if (rows.length === 0) {
    return null;
  }

  const storeMap = new Map<string, Store>();
  for (const row of rows) {
    const existing = storeMap.get(row.id);
    const store = existing ?? {
      id: row.id,
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      url: row.url,
      services: row.services,
      sales: [],
    };

    if (!existing) {
      storeMap.set(row.id, store);
    }

    if (
      row.saleId !== null &&
      row.saleType !== null &&
      row.saleStatus !== null &&
      row.saleStartDate !== null &&
      row.saleEndDate !== null &&
      row.saleDetail !== null
    ) {
      store.sales.push({
        type: row.saleType,
        status: row.saleStatus,
        startDate: row.saleStartDate,
        endDate: row.saleEndDate,
        detail: row.saleDetail,
      });
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    stores: [...storeMap.values()],
  };
}

export async function getStoreCoordsCache(): Promise<
  Map<string, { lat: number; lng: number }>
> {
  const db = getDb();
  const rows = await db
    .select({ id: stores.id, lat: stores.lat, lng: stores.lng })
    .from(stores);

  const cache = new Map<string, { lat: number; lng: number }>();
  for (const row of rows) {
    cache.set(row.id, { lat: row.lat, lng: row.lng });
  }
  return cache;
}

export async function upsertStoresAndSales(data: StoresData): Promise<void> {
  const storeList = data.stores;

  // Flatten sales with storeId
  const saleList = storeList.flatMap((s) =>
    s.sales.map((sale) => ({ ...sale, storeId: s.id })),
  );

  const db = getDb();
  await db.transaction(async (tx) => {
    // Upsert stores
    if (storeList.length > 0) {
      await tx
        .insert(stores)
        .values(
          storeList.map((s) => ({
            id: s.id,
            name: s.name,
            address: s.address,
            lat: s.lat,
            lng: s.lng,
            url: s.url,
            services: s.services,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: stores.id,
          set: {
            name: sql`excluded.name`,
            address: sql`excluded.address`,
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            url: sql`excluded.url`,
            services: sql`excluded.services`,
            updatedAt: new Date(),
          },
        });
    }

    // Delete existing sales for these stores, then insert fresh
    const storeIds = storeList.map((s) => s.id);
    if (storeIds.length > 0) {
      await tx.delete(sales).where(inArray(sales.storeId, storeIds));
    }

    if (saleList.length > 0) {
      await tx.insert(sales).values(
        saleList.map((s) => ({
          storeId: s.storeId,
          type: s.type,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          detail: s.detail,
        })),
      );
    }
  });
}

export async function logScrape(storeCount: number): Promise<void> {
  await getDb().insert(scrapeLogs).values({ storeCount });
}
