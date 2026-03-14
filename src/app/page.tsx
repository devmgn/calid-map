import type { StoresData } from "@/features/map/types";
import { Suspense } from "react";
import { getStoresWithSales } from "@/db/queries/stores";
import { MapPage } from "@/features/map";

const EMPTY_DATA: StoresData = { updatedAt: "", stores: [] };

export default async function Home() {
  let data: StoresData;
  try {
    data = (await getStoresWithSales()) ?? EMPTY_DATA;
  } catch {
    data = EMPTY_DATA;
  }

  return (
    <Suspense>
      <MapPage data={data} />
    </Suspense>
  );
}
