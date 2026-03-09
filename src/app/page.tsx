import storesData from "@/data/stores.json";
import { MapPage } from "@/features/map";

export default function Home() {
  return <MapPage data={storesData} />;
}
