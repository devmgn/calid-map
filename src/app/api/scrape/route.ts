import type { NextRequest } from "next/server";
import {
  getStoreCoordsCache,
  logScrape,
  upsertStoresAndSales,
} from "@/db/queries/stores";
import { buildStoresData } from "@/lib/scraper";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (
    cronSecret === undefined ||
    cronSecret === "" ||
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    return Response.json(
      { error: "GOOGLE_GEOCODING_API_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const cachedCoords = await getStoreCoordsCache();
    const data = await buildStoresData(cachedCoords, apiKey);
    await upsertStoresAndSales(data);
    await logScrape(data.stores.length);

    return Response.json({
      success: true,
      storeCount: data.stores.length,
    });
  } catch (error) {
    console.error("Scrape failed:", error);
    return Response.json({ error: "Scrape failed" }, { status: 500 });
  }
}
