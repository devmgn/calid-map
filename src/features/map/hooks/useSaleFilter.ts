"use client";

import type { Store } from "../types";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";

function useSaleFilter(stores: Store[]) {
  const [selectedSales, setSelectedSales] = useQueryState(
    "sales",
    parseAsArrayOf(parseAsString, ",").withDefault([]),
  );

  const saleTypes = useMemo(() => {
    const types = new Set<string>();
    for (const store of stores) {
      for (const sale of store.sales) {
        if (sale.type) {
          types.add(sale.type);
        }
      }
    }
    return [...types].toSorted();
  }, [stores]);

  const filteredStores = useMemo(() => {
    if (selectedSales.length === 0) {
      return stores;
    }
    return stores.filter((store) =>
      store.sales.some((sale) => selectedSales.includes(sale.type)),
    );
  }, [selectedSales, stores]);

  function toggleSale(saleType: string) {
    void setSelectedSales((prev) =>
      prev.includes(saleType)
        ? prev.filter((s) => s !== saleType)
        : [...prev, saleType],
    );
  }

  return { saleTypes, selectedSales, toggleSale, filteredStores };
}

export { useSaleFilter };
