"use client";

import type { StoresData } from "../../types";
import { useSaleFilter } from "../../hooks/useSaleFilter";
import { SaleFilter } from "../SaleFilter";
import { StoreMap } from "../StoreMap";

interface MapPageProps {
  data: StoresData;
}

function MapPage({ data }: MapPageProps) {
  const { saleTypes, selectedSales, toggleSale, filteredStores } =
    useSaleFilter(data.stores);

  return (
    <div className="relative h-dvh w-full">
      <StoreMap stores={filteredStores} />
      <div className="absolute top-4 left-4 z-[1000] w-56">
        <SaleFilter
          saleTypes={saleTypes}
          selectedSales={selectedSales}
          onToggle={toggleSale}
          totalCount={data.stores.length}
          filteredCount={filteredStores.length}
        />
      </div>
    </div>
  );
}

export { MapPage };
