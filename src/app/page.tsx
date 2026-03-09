import { Suspense } from "react";
import storesData from "@/data/stores.json";
import { MapPage } from "@/features/map";

export default function Home() {
  return (
    <Suspense>
      <MapPage data={storesData} />
    </Suspense>
  );
}
