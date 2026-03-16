import type { StoresData } from "@/features/map/types";
import { Suspense } from "react";
import { getStoresWithSales } from "@/db/queries/stores";
import { MapPage } from "@/features/map";

export const dynamic = "force-dynamic";

const EMPTY_DATA: StoresData = { updatedAt: "", stores: [] };

export default async function Home() {
  const data: StoresData =
    (await getStoresWithSales().catch(() => null)) ?? EMPTY_DATA;

  return (
    <Suspense>
      <MapPage data={data} />
    </Suspense>
  );
}
