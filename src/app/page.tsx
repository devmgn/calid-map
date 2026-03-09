import type { StoresData } from "@/features/map/types";
import { Suspense } from "react";
import { MapPage } from "@/features/map";
import { getStoresData } from "@/lib/blob";

const EMPTY_DATA: StoresData = { updatedAt: "", stores: [] };

export default async function Home() {
  const data = (await getStoresData()) ?? EMPTY_DATA;

  return (
    <Suspense>
      <MapPage data={data} />
    </Suspense>
  );
}
