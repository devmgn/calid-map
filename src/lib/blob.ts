import type { StoresData } from "@/features/map/types";
import { list, put } from "@vercel/blob";
import { z } from "zod/v4";

const BLOB_PATHNAME = "stores.json";

const saleSchema = z.object({
  type: z.string(),
  status: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  detail: z.string(),
});

const storeSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  url: z.string(),
  services: z.array(z.string()),
  sales: z.array(saleSchema),
});

const storesDataSchema = z.object({
  updatedAt: z.string(),
  stores: z.array(storeSchema),
});

export async function getStoresData(): Promise<StoresData | null> {
  const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
  if (blobs.length === 0) {
    return null;
  }

  const res = await fetch(blobs[0].url);
  const json: unknown = await res.json();
  return storesDataSchema.parse(json);
}

export async function putStoresData(data: StoresData): Promise<string> {
  const blob = await put(BLOB_PATHNAME, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return blob.url;
}
